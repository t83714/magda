package au.csiro.data61.magda.search.elasticsearch

import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.{CreateIndexDefinition, ElasticClient}
import com.sksamuel.elastic4s.mappings.FieldType._
import com.sksamuel.elastic4s.analyzers._
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.spatial.RegionSource
import au.csiro.data61.magda.AppConfig
import spray.json._
import com.sksamuel.elastic4s.ElasticDsl
import akka.stream.Materializer

import scala.util.Failure
import akka.stream.scaladsl.Sink
import akka.stream.scaladsl.Source

import scala.util.Success
import akka.stream.scaladsl.Merge
import com.sksamuel.elastic4s.BulkResult
import akka.actor.ActorSystem

import scala.concurrent.Future
import scala.concurrent.ExecutionContext.Implicits.global
import au.csiro.data61.magda.search.elasticsearch.Queries.generateRegionId
import au.csiro.data61.magda.model.misc.Protocols._
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchImplicits._
import akka.stream.scaladsl.SourceQueueWithComplete
import com.sksamuel.elastic4s.BulkDefinition
import akka.stream.scaladsl.SourceQueue
import akka.stream.QueueOfferResult._
import akka.stream.scaladsl.Concat
import java.io.File
import akka.stream.scaladsl.FileIO
import akka.stream.scaladsl.JsonFraming

case class IndexDefinition(
  name: String,
  version: Int,
  definition: CreateIndexDefinition,
  create: (ElasticClient, Materializer, ActorSystem) => Future[Any] = (_, _, _) => Future(Unit))

object IndexDefinition {
  val indices = Seq(new IndexDefinition(
    name = "datasets",
    version = 10,
    definition =
      create.index("datasets")
        .indexSetting("recovery.initial_shards", 1)
        .mappings(
          mapping("datasets").fields(
            field("temporal").inner(
              field("start").inner(
                field("text").typed(StringType)),
              field("end").inner(
                field("text").typed(StringType))),
            field("publisher").inner(
              field("name").typed(StringType).fields(
                field("untouched").typed(StringType).index("not_analyzed"))),
            field("distributions").nested(
              field("format").typed(StringType).fields(
                field("untokenized").typed(StringType).analyzer("untokenized"))),
            field("spatial").inner(
              field("geoJson").typed(GeoShapeType))),
          mapping(Format.id),
          mapping(Year.id),
          mapping(Publisher.id)
        ).analysis(CustomAnalyzerDefinition("untokenized", KeywordTokenizer, LowercaseTokenFilter))),
    new IndexDefinition(
      name = "regions",
      version = 46,
      definition =
        create.index("regions")
          .indexSetting("recovery.initial_shards", 1)
          .mappings(
            mapping("regions").fields(
              field("type").typed(StringType),
              field("id").typed(StringType),
              field("name").typed(StringType),
              field("geometry").typed(GeoShapeType))),
      create = (client, materializer, actorSystem) => setupRegions(client)(materializer, actorSystem)))

  def setupRegions(client: ElasticClient)(implicit materializer: Materializer, system: ActorSystem): Future[Any] = {
    val logger = system.log
    val loader = new RegionLoader()

    loader.setupRegions
      .map {
        case (regionSource, jsonRegion) =>
          val properties = jsonRegion.fields("properties").asJsObject
          val name = if (regionSource.includeIdInName) {
            JsString(properties.fields(regionSource.nameProperty).convertTo[String] + " - " + properties.fields(regionSource.idProperty).convertTo[String])
          } else {
            properties.fields(regionSource.nameProperty)
          }
          ElasticDsl.index
            .into("regions" / "regions")
            .id(generateRegionId(regionSource.name, jsonRegion.getFields("properties").head.asJsObject.fields(regionSource.idProperty).convertTo[String]))
            .source(JsObject(
              "type" -> JsString(regionSource.name),
              "id" -> properties.fields(regionSource.idProperty),
              "name" -> name,
              "geometry" -> cleanGeoJson(jsonRegion.fields("geometry"))
            ).toJson)
      }
      // This creates a buffer of regionBufferMb (roughly) of indexed regions that will be bulk-indexed in the next ES request
      .batchWeighted(AppConfig.conf.getLong("regionBufferMb") * 1000000, defin => defin.build.source().length(), Seq(_))(_ :+ _)
      // This ensures that only one indexing request is executed at a time - while the index request is in flight, the entire stream backpressures
      // right up to reading from the file, so that new bytes will only be read from the file, parsed, turned into IndexDefinitions etc if ES is
      // available to index them right away
      .mapAsync(1) { values =>
        logger.debug("Indexing {} regions", values.length)
        client.execute(bulk(values))
      }
      .map { result =>
        if (result.hasFailures) {
          logger.error("Failure: {}", result.failureMessage)
        }

        result.items.length
      }
      .recover {
        case e: Throwable =>
          logger.error(e, "Encountered error while indexing regions")
          throw e
      }
      .runWith(Sink.reduce((oldLength: Int, latestValuesLength: Int) => oldLength + latestValuesLength))
      .map { count => logger.info("Successfully indexed {} regions", count) }
  }

  def cleanGeoJson(geojson: JsValue): JsValue = {
    // Make sure all linear rings are closed (first coordinates are exactly the same as the last coordinates)
    geojson match {
      case JsObject(fields) => {
        val cleanLinearRing = (linearRing: Vector[JsValue]) => {
          // Filter out duplicate points, except that the first and last point must be identical.
          val hash = new scala.collection.mutable.HashSet[JsValue]
          var result = Vector[JsValue]()

          for (i <- 0 until linearRing.length) {
            val value = linearRing(i)
            if (!hash.contains(value)) {
              result = result :+ value
              hash.add(value)
            }
          }

          result :+ linearRing.head
        }

        val cleanPolygon = (linearRings: Vector[JsValue]) => {
          linearRings.map {
            case JsArray(linearRing) => JsArray(cleanLinearRing(linearRing))
            case anythingElse => {println("*** not a JsArray"); anythingElse}
          }
        }

        if (fields("type").convertTo[String] == "Polygon") {
          JsObject(fields.map {
            case ("coordinates", JsArray(linearRings)) => ("coordinates", JsArray(cleanPolygon(linearRings)))
            case ("coordinates", anythingElse) => {println("**** coordinates is not a JsArray"); ("coordinates", anythingElse)}
            case (others, value) => (others, value)
          })
        } else if (fields("type").convertTo[String] == "MultiPolygon") {
          JsObject(fields.map {
            case ("coordinates", JsArray(polygons)) => ("coordinates", JsArray(polygons.map {
              case JsArray(linearRings) => JsArray(cleanPolygon(linearRings))
              case anythingElse => {println("*****not a JsArray2"); anythingElse}
            }))
            case ("coordinates", anythingElse) => {println("**** coordinates is not a JsArray2"); ("coordinates", anythingElse)}
            case (others, value) => (others, value)
          })
        } else {
          geojson
        }
      }
      case anythingElse => anythingElse
    }
  }
}