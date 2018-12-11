package au.csiro.data61.magda.indexer

import com.sksamuel.elastic4s.http.ElasticDsl._
import com.sksamuel.elastic4s.http.ElasticDsl
import java.time.temporal.ChronoUnit
import java.util.UUID

import com.typesafe.config.ConfigFactory

import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.HttpMethods.POST
import akka.http.scaladsl.model.StatusCodes.Accepted
import akka.http.scaladsl.model.StatusCodes.OK
import au.csiro.data61.magda.api.SearchApi
import au.csiro.data61.magda.api.model.{ Protocols => ApiProtocols }
import au.csiro.data61.magda.api.model.SearchResult
import au.csiro.data61.magda.indexer.external.registry.WebhookApi
import au.csiro.data61.magda.indexer.search.elasticsearch.ElasticSearchIndexer
import au.csiro.data61.magda.model.Registry._
import au.csiro.data61.magda.model.Registry.RegistryProtocols
import au.csiro.data61.magda.model.Registry.Record
import au.csiro.data61.magda.model.misc._
import au.csiro.data61.magda.model.misc.{ Protocols => ModelProtocols }
import au.csiro.data61.magda.model.Temporal.PeriodOfTime
import au.csiro.data61.magda.model.Temporal.Periodicity
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchQueryer
import au.csiro.data61.magda.search.elasticsearch.Indices
import au.csiro.data61.magda.test.api.BaseApiSpec
import au.csiro.data61.magda.test.util.Generators
import spray.json._
import spray.json.JsNull
import spray.json.JsObject
import au.csiro.data61.magda.model.Temporal.ApiDate
import scala.concurrent.duration._
import org.scalacheck.Gen
import org.scalacheck.Shrink
import au.csiro.data61.magda.search.SearchQueryer
import au.csiro.data61.magda.indexer.search.SearchIndexer
import akka.stream.scaladsl.Source
import scala.concurrent.Await
import au.csiro.data61.magda.model.Registry.RegistryConverters

class WebhookSpec extends BaseApiSpec with RegistryConverters with ModelProtocols with ApiProtocols {
  override def buildConfig = ConfigFactory.parseString("indexer.requestThrottleMs=1").withFallback(super.buildConfig)
  val cachedListCache: scala.collection.mutable.Map[String, List[_]] = scala.collection.mutable.HashMap.empty

  blockUntilNotRed()

  describe("when webhook received") {
    it("should index new datasets") {
      loadDatasetsThroughEvents() { (allDataSets: List[DataSet], response: SearchResult) =>
        val cleanedInputDataSets = allDataSets.map(dataSet => dataSet.copy(
          // The registry only looks for the duration text so copy the actual duration into the text
          accrualPeriodicity = dataSet.accrualPeriodicity.flatMap(_.duration).map(duration => Periodicity(text = Some(duration.get(ChronoUnit.SECONDS) * 1000 + " ms"))),

          publisher = dataSet.publisher.map(publisher =>
            Agent(
              identifier = publisher.identifier,
              aggKeywords =
                if (publisher.jurisdiction.isEmpty)
                  Some(publisher.name.getOrElse(publisher.identifier.get).toLowerCase)
                else
                  publisher.jurisdiction.map(publisher.name.getOrElse(publisher.identifier.get) + ":" + _).map(_.toLowerCase),
              name = publisher.name,
              acronym = getAcronymFromPublisherName(publisher.name),
              imageUrl = publisher.imageUrl)),

          quality = 0,

          distributions = dataSet.distributions.map(distribution => distribution.copy(
            // Distribution only takes into account the name
            license = distribution.license.flatMap(_.name).map(name => License(Some(name))),

            // Code derives media type from the format rather than reading it directly.
            mediaType = None)),

          // Contact points only look for name at the moment
          contactPoint = dataSet.contactPoint.flatMap(_.name).map(name => Agent(Some(name))),

          // Registry doesn't know how to do spatial extent yet, so just keep the text, no text == None
          spatial = dataSet.spatial match {
            case Some(Location(None, _)) => None
            case Some(spatial)           => Some(Location(spatial.text))
            case other                   => other
          },

          temporal = dataSet.temporal match {
            // The registry -> dataset converter rightly does this conversion.
            case Some(PeriodOfTime(None, None)) => None

            // The converter also filters out spatial extends that are a blank string, so we need to do that.
            case Some(PeriodOfTime(from, to)) => PeriodOfTime(filterDate(from), filterDate(to)) match {
              case PeriodOfTime(None, None) => None
              case other                    => Some(other)
            }
            case other => other
          }))

        val cleanedOutputDataSets = response.dataSets.map(dataSet => dataSet.copy(
          // We don't care about this.
          indexed = None,
          quality = 0,
          score = None,

          distributions = dataSet.distributions.map(distribution => distribution.copy(
            // This will be derived from the format so might not match the input
            mediaType = None))))

        withClue(cleanedOutputDataSets.toJson.prettyPrint + "\n should equal \n" + cleanedInputDataSets.toJson.prettyPrint) {
          cleanedOutputDataSets.toSet should equal(cleanedInputDataSets.toSet)

          val matched = cleanedOutputDataSets.map(input => input -> cleanedInputDataSets.find(_.identifier == input.identifier).get)
          val eps = 1e-3
          matched.foreach {
            case (input, output) =>
              input.quality should be(output.quality +- eps)
          }
        }

      }
    }

    it("should delete datasets mentioned in deletion events") {

      val gen = for {
        gennedDataSets <- dataSetsGen
        dataSets = gennedDataSets.map(_._1)
        dataSetsToDelete <- Generators.subListGen(dataSets)
      } yield (dataSets, dataSetsToDelete)

      forAll(gen) {
        case (dataSets, dataSetsToDelete) =>
          val builtIndex = buildIndex()
          Await.result(builtIndex.indexer.index(Source.fromIterator(() => dataSets.iterator)), 30 seconds)

          Await.result(builtIndex.indexer.ready, 120 seconds)
          builtIndex.indexNames.foreach{ idxName =>
            refresh(idxName)
          }
          blockUntilExactCount(dataSets.size, builtIndex.indexId)

          val events = dataSetsToDelete.map(dataSet =>
            RegistryEvent(
              id = None,
              eventTime = None,
              eventType = EventType.DeleteRecord,
              userId = 0,
              data = JsObject("recordId" -> JsString(dataSet.identifier))))

          val payload = WebHookPayload(
            action = "records.changed",
            lastEventId = 104856,
            events = Some(events.toList),
            records = None,
            aspectDefinitions = None,
            deferredResponseUrl = None)

          Post("/", payload) ~> builtIndex.webhookApi.routes ~> check {
            status shouldBe Accepted
          }

          val expectedDataSets = dataSets.filter(dataSet => !dataSetsToDelete.contains(dataSet))

          builtIndex.indexNames.foreach{ idxName =>
            refresh(idxName)
          }
          blockUntilExactCount(expectedDataSets.size, builtIndex.indexId)

          Get("/v0/datasets?query=*&limit=10000") ~> builtIndex.searchApi.routes ~> check {
            status shouldBe OK
            val result = responseAs[SearchResult]

            result.dataSets.length shouldEqual expectedDataSets.length
            result.dataSets.map(_.identifier).toSet shouldEqual expectedDataSets.map(_.identifier).toSet
          }

          builtIndex.indexNames.foreach{ idxName =>
            deleteIndex(idxName)
          }
      }
    }

    it("given a combination of deletions and insertions, it should not delete anything that was included as a record") {
      val gen = for {
        gennedDataSets <- dataSetsGen
        dataSets = gennedDataSets.map(_._1)
        dataSetsToDelete <- Generators.subListGen(dataSets)
        deletedDataSetsToSave <- Generators.subListGen(dataSetsToDelete)
      } yield (dataSetsToDelete, deletedDataSetsToSave)

      forAll(gen) {
        case (dataSetsToDelete, deletedDataSetsToSave) =>
          val builtIndex = buildIndex()
          Await.result(builtIndex.indexer.ready, 120 seconds)
          builtIndex.indexNames.foreach{ idxName =>
            refresh(idxName)
          }

          val events = dataSetsToDelete.map(dataSet =>
            RegistryEvent(
              id = None,
              eventTime = None,
              eventType = EventType.DeleteRecord,
              userId = 0,
              data = JsObject("recordId" -> JsString(dataSet.identifier))))

          val payload = WebHookPayload(
            action = "records.changed",
            lastEventId = 104856,
            events = Some(events.toList),
            records = Some(deletedDataSetsToSave.map(x => dataSetToRecord((x, Nil))).toList),
            aspectDefinitions = None,
            deferredResponseUrl = None)

          Post("/", payload) ~> builtIndex.webhookApi.routes ~> check {
            status shouldBe Accepted
          }

          val expectedDataSets = deletedDataSetsToSave

          builtIndex.indexNames.foreach{ idxName =>
            refresh(idxName)
          }
          blockUntilExactCount(expectedDataSets.size, builtIndex.indexId)

          Get("/v0/datasets?query=*&limit=10000") ~> builtIndex.searchApi.routes ~> check {
            status shouldBe OK
            val result = responseAs[SearchResult]

            result.dataSets.length shouldEqual expectedDataSets.length
            result.dataSets.map(_.identifier).toSet shouldEqual expectedDataSets.map(_.identifier).toSet
          }

          builtIndex.indexNames.foreach{ idxName =>
            deleteIndex(idxName)
          }
      }
    }
  }

  val dataSetsGen = Generators.listSizeBetween(0, 20, Generators.dataSetGen(cachedListCache)).flatMap { dataSets =>
    val qualityFacetGen = for {
      skewPrimary <- Generators.twoDigitDoubleGen
      weightingPrimary <- Generators.twoDigitDoubleGen
      skewOtherWay <- Generators.twoDigitDoubleGen
      name <- Gen.alphaNumStr
    } yield (name, skewPrimary, weightingPrimary, skewOtherWay)

    val qualityGen = Gen.listOfN(dataSets.size, Gen.nonEmptyListOf(qualityFacetGen))

    qualityGen.map { case x => dataSets.zip(x) }
  }

  case class TestIndex(indexId: String, indices: Indices, indexer: SearchIndexer, webhookApi: WebhookApi, searchQueryer: SearchQueryer, searchApi: SearchApi, indexNames: List[String])

  def buildIndex(): TestIndex = {
    val indexId = UUID.randomUUID().toString

    val indices = new FakeIndices(indexId.toString)
    val indexer = new ElasticSearchIndexer(MockClientProvider, indices)
    val webhookApi = new WebhookApi(indexer)
    val searchQueryer = new ElasticSearchQueryer(indices)
    val searchApi = new SearchApi(searchQueryer)(config, logger)

    val indexNames = List(
      indices.getIndex(config, Indices.DataSetsIndex),
      indices.getIndex(config, Indices.PublishersIndex),
      indices.getIndex(config, Indices.FormatsIndex)
    )

    indexer.ready.await(60 seconds)

    indexNames.foreach{ idxName =>
      blockUntilIndexExists(idxName)
    }

    TestIndex(indexNames(0), indices, indexer, webhookApi, searchQueryer, searchApi, indexNames)
  }

  def loadDatasetsThroughEvents()(fn: (List[DataSet], SearchResult) => Unit) {
    val dataSetsBatchesGen = Generators.listSizeBetween(0, 3, dataSetsGen)

    forAll(dataSetsBatchesGen) { dataSetsBatches =>
      val builtIndex = buildIndex()
      val routes = builtIndex.webhookApi.routes

      val payloads = dataSetsBatches.map(dataSets =>
        new WebHookPayload(
          action = "records.changed",
          lastEventId = 104856,
          events = None, // Not needed yet - soon?
          records = Some(dataSets.map(dataSetToRecord)),
          aspectDefinitions = None,
          deferredResponseUrl = None))

      val posts = payloads.map { payload =>
        new RequestBuilder(POST).apply("/", payload)
      }

      val responses = posts.map { post =>
        post ~> routes ~> check {
          status shouldBe Accepted
        }
      }
      val allDataSets = dataSetsBatches.flatten.map(_._1)

      builtIndex.indexNames.foreach{ idxName =>
        refresh(idxName)
      }

      blockUntilExactCount(allDataSets.size, builtIndex.indexId)

      Get(s"/v0/datasets?query=*&limit=${allDataSets.size}") ~> builtIndex.searchApi.routes ~> check {
        status shouldBe OK
        val response = responseAs[SearchResult]

        fn(allDataSets, response)
      }

      builtIndex.indexNames.foreach{ idxName =>
        deleteIndex(idxName)
      }
    }
  }

  def filterDate(input: Option[ApiDate]): Option[ApiDate] = input.flatMap {
    case ApiDate(None, "") => None
    case other             => Some(other)
  }

  def dataSetToRecord(input: (DataSet, List[(String, Double, Double, Double)])): Record = input match {
    case (dataSet, quality) =>
      def removeNulls(jsObject: JsObject) = JsObject(jsObject.fields.filter {
        case (_, value) => value match {
          case JsNull => false
          case JsObject(fields) if fields.filterNot(_._2 == JsNull).isEmpty =>
            false
          case _ => true
        }
      })
      def modifyJson(jsObject: JsObject, values: Map[String, JsValue]): JsObject = removeNulls(JsObject(jsObject.fields ++ values))

      val record = Record(
        id = dataSet.identifier,
        name = dataSet.title.getOrElse("No Title"),
        aspects = {
          val aspects: Map[String, JsObject] = Map(
            "dcat-dataset-strings" -> modifyJson(
              dataSet.copy(
                distributions = Seq(),
                publisher = None,
                accrualPeriodicity = None).toJson.asJsObject, Map(
                "accrualPeriodicity" -> dataSet.accrualPeriodicity.flatMap(_.duration).map(duration => duration.get(ChronoUnit.SECONDS) * 1000 + " ms").toJson,
                "contactPoint" -> dataSet.contactPoint.flatMap(_.name).map(_.toJson).getOrElse(JsNull),
                "temporal" -> dataSet.temporal.map {
                  case PeriodOfTime(None, None) => JsNull
                  case PeriodOfTime(start, end) =>
                    removeNulls(JsObject(
                      "start" -> start.map(_.text).toJson,
                      "end" -> end.map(_.text).toJson))
                }.getOrElse(JsNull),
                "spatial" -> dataSet.spatial.map(_.text).toJson)),
            "dataset-distributions" -> JsObject(
              "distributions" -> dataSet.distributions.map(dist =>
                JsObject(
                  "id" -> dist.identifier.toJson,
                  "name" -> dist.title.toJson,
                  "aspects" -> JsObject(
                    "dcat-distribution-strings" ->
                      modifyJson(dist.toJson.asJsObject, Map(
                        "license" -> dist.license.flatMap(_.name).map(_.toJson).getOrElse(JsNull)))))).toJson),
            "source" -> JsObject(
              "name" -> dataSet.catalog.toJson),
            "dataset-publisher" -> dataSet.publisher.map(publisher => JsObject(
              "publisher" -> JsObject(
                "id" -> publisher.identifier.toJson,
                "name" -> publisher.name.toJson,
                "aspects" -> JsObject(
                  "organization-details" -> removeNulls(JsObject(
                    "title" -> publisher.name.toJson,
                    "imageUrl" -> publisher.imageUrl.toJson)))))).toJson,
            "dataset-quality-rating" -> {
              if (!dataSet.hasQuality) {
                JsObject()
              } else if (dataSet.quality == 1) {
                JsObject()
              } else if (quality.isEmpty) {
                JsObject("x" -> JsObject("score" -> dataSet.quality.toJson, "weighting" -> 1.toJson))
              } else {
                quality.flatMap {
                  case (name, skewPrimaryRaw, weightingPrimaryRaw, skewOtherWayRaw) =>
                    def round(number: Double) = Math.round(number * 100).toDouble / 100
                    def sanitize(number: Double) = Math.max(0.01, number)

                    val skewPrimary = sanitize(skewPrimaryRaw)
                    val weightingPrimary = sanitize(weightingPrimaryRaw)
                    val skewOtherWay = sanitize(skewOtherWayRaw)

                    val weightingOtherWay = (skewPrimary * weightingPrimary) / skewOtherWay
                    List(
                      name -> JsObject(
                        "score" -> (dataSet.quality + skewPrimary).toJson,
                        "weighting" -> (weightingPrimary).toJson),
                      s"$name-alternate" -> JsObject(
                        "score" -> (dataSet.quality - skewOtherWay).toJson,
                        "weighting" -> (weightingOtherWay).toJson))
                }.toMap.toJson.asJsObject
              }
            })

            .filter { case (_, value) => value.isInstanceOf[JsObject] }
            .asInstanceOf[Map[String, JsObject]]

          val temporal = dataSet.temporal
            .map(temporal => (temporal.start.flatMap(_.date), temporal.end.flatMap(_.date)))
            .flatMap {
              case (None, None) => None
              case (from, to) =>
                Some(JsObject(
                  "intervals" -> Seq(
                    removeNulls(JsObject(
                      "start" -> from.toJson,
                      "end" -> to.toJson))).toJson))
            }.map(_.toJson.asJsObject)

          temporal match {
            case Some(innerTemporal) => aspects + (("temporal-coverage", innerTemporal))
            case None                => aspects
          }
        })

      record
  }
}
