package au.csiro.data61.magda.api

import java.io.File
import java.util.Properties
import java.util.concurrent.ConcurrentHashMap

import akka.actor.{ActorSystem, Scheduler}
import akka.event.{Logging, LoggingAdapter}
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.ContentTypes.`application/json`
import akka.http.scaladsl.model.StatusCodes.OK
import akka.http.scaladsl.server.Route
import akka.http.scaladsl.testkit.{RouteTestTimeout, ScalatestRouteTest}
import au.csiro.data61.magda.AppConfig
import au.csiro.data61.magda.api.model.{Protocols, SearchResult}
import au.csiro.data61.magda.model.misc.{DataSet, _}
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchImplicits._
import au.csiro.data61.magda.search.elasticsearch._
import au.csiro.data61.magda.test.util.Generators._
import com.sksamuel.elastic4s.ElasticDsl._
import com.sksamuel.elastic4s.testkit.ElasticSugar
import com.typesafe.config.{Config, ConfigFactory}
import org.elasticsearch.common.settings.Settings
import org.scalacheck.Shrink._
import org.scalacheck._
import org.scalactic.anyvals.PosInt
import org.scalatest.{BeforeAndAfter, Matchers, _}
import org.scalatest.prop.GeneratorDrivenPropertyChecks
import spray.json._

import scala.collection.JavaConverters._
import scala.concurrent.{ExecutionContext, Future}
import scala.concurrent.duration.DurationInt
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.function.Consumer

import au.csiro.data61.magda.model.temporal.PeriodOfTime

class ApiSpec extends FunSpec with Matchers with ScalatestRouteTest with ElasticSugar with BeforeAndAfter with BeforeAndAfterAll with Protocols with GeneratorDrivenPropertyChecks {
  override def testConfigSource = "akka.loglevel = WARN"
  val LUCENE_CONTROL_CHARACTER_REGEX = """[^.,\\/#!$%\\^&\\*;:{}=\\-_`~()\\[\\]"'\\+]*"""
  val INSERTION_WAIT_TIME = 60 seconds
  //  override def indexRefresh = - 1 seconds
  val logger = Logging(system, getClass)
  val processors = PosInt.from(Runtime.getRuntime().availableProcessors() / 2).get
  //      val processors = PosInt.from(1).get
  logger.info("Running with {} processors", processors.toString)
  implicit override val generatorDrivenConfig = PropertyCheckConfiguration(workers = processors)
  implicit def default(implicit system: ActorSystem) = RouteTestTimeout(5 seconds)
  override def httpEnabled = false

  val properties = new Properties()
  properties.setProperty("regionLoading.cachePath", new File("./src/test/resources").getAbsolutePath())
  val generatedConf = configWith(Map("regionLoading.cachePath" -> new File("./src/test/resources").getAbsolutePath()))
  implicit val config = generatedConf.withFallback(AppConfig.conf(Some("test")))
  override def testConfig = ConfigFactory.empty()

  implicit object MockClientProvider extends ClientProvider {
    override def getClient(implicit scheduler: Scheduler, logger: LoggingAdapter, ec: ExecutionContext): Future[ElasticClientTrait] = Future(new ElasticClientAdapter(client))
  }

  override def configureSettings(builder: Settings.Builder) =
    builder
      .put("cluster.routing.allocation.disk.watermark.high", "100%")
      .put("cluster.routing.allocation.disk.watermark.low", "100%")
      .put("discovery.zen.ping.multicast", "false")
      .put("index.store.fs.memory.enabled", "true")
      .put("index.gateway.type", "none")
      .put("index.store.throttle.type", "none")
      .put("index.translog.disable_flush", "true")
      .put("index.memory.index_buffer_size", "50%")
      .put("index.refresh_interval", "-1")

  override def blockUntil(explain: String)(predicate: () => Boolean): Unit = {

    var backoff = 0
    var done = false

    while (backoff <= 10 && !done) {
      backoff = backoff + 1
      try {
        done = predicate()

        if (!done) {
          logger.debug(s"Waiting another {}ms for {}", 200 * backoff, explain)
          Thread.sleep(200 * (backoff))
        } else {
          logger.debug(s"{} is true, proceeding.", explain)
        }
      } catch {
        case e: Throwable =>
          logger.error(e, "")
          throw e
      }
    }

    require(done, s"Failed waiting on: $explain")
  }

  def configWith(newProps: Map[String, String]): Config = {
    ConfigFactory.parseProperties(
      newProps.foldRight(new Properties()) { (current: (String, String), properties: Properties) =>
        properties.setProperty(current._1, current._2)
        properties
      }
    )
  }

  var generatedIndexCount = 0

  var genCache: ConcurrentHashMap[Int, Future[(String, List[DataSet], Route)]] = new ConcurrentHashMap()

  case class FakeIndices(rawIndexName: String) extends Indices {
    override def getIndex(config: Config, index: Indices.Index): String = rawIndexName
  }

  implicit def indexShrinker(implicit s: Shrink[String], s1: Shrink[List[DataSet]], s2: Shrink[Route]): Shrink[(String, List[DataSet], Route)] = Shrink[(String, List[DataSet], Route)] {
    case (indexName, dataSets, route) =>
      logger.debug("preshrink: {}", dataSets.size)
      shrink(dataSets).map(dataSets => {
        logger.debug("postshrink: {}", dataSets.size)
        val result = putDataSetsInIndex(dataSets).await(INSERTION_WAIT_TIME)

        cleanUpQueue.add(result._1)

        result
      })
  }

  def indexGen: Gen[(String, List[DataSet], Route)] =
    Gen.delay {
      Gen.size.flatMap { size =>
        val cacheKey = if (size < 10) size
        else if (size < 50) size - size % 5
        else size - size % 10

        Option(genCache.get(cacheKey)) match {
          //                  Option.empty[Future[(List[DataSet], Route)]] match {
          case None =>
            Gen.listOfN(size, dataSetGen).map { dataSetsRaw =>
              val dataSets = dataSetsRaw.groupBy(_.identifier).mapValues(_.head).values.toList
              val dataSetCount = dataSets.size
              logger.debug("Cache miss for {}", cacheKey)
              genCache.put(cacheKey, putDataSetsInIndex(dataSets))
              genCache.get(cacheKey).await(INSERTION_WAIT_TIME)
            }
          case Some(cachedValue) =>
            val value = cachedValue.await(INSERTION_WAIT_TIME)

            logger.debug("Cache hit for {}: {}", cacheKey, value._2.size)

            value
        }
      }
    }

  def putDataSetsInIndex(dataSets: List[DataSet]): Future[(String, List[DataSet], Route)] = {
    val rawIndexName = java.util.UUID.randomUUID.toString
    val fakeIndices = FakeIndices(rawIndexName)

    val indexName = fakeIndices.getIndex(config, Indices.DataSetsIndex)
    client.execute(IndexDefinition.datasets.definition(config, fakeIndices)).await
    blockUntilGreen()

    //                implicit val thisConf = configWith(Map(s"elasticsearch.indexes.$rawIndexName.version" -> "1")).withFallback(config)
    val searchQueryer = new ElasticSearchQueryer(fakeIndices)
    val api = new Api(logger, searchQueryer)

    if (!dataSets.isEmpty) {
      client.execute(bulk(
        dataSets.map(dataSet =>
          index into indexName / fakeIndices.getType(Indices.DataSetsIndexType) id dataSet.identifier source dataSet.toJson)
      )).flatMap { _ =>
        client.execute(refreshIndex(indexName))
      }.map { _ =>
        blockUntilCount(dataSets.size, indexName)
        (indexName, dataSets, api.routes)
      } recover {
        case e: Throwable =>
          logger.error(e, "")
          throw e
      }
    } else Future.successful((indexName, List[DataSet](), api.routes))
  }

  def encodeForUrl(query: String) = java.net.URLEncoder.encode(query, "UTF-8")

  describe("searching *") {
    it("should return all results") {
      forAll(indexGen) {
        case (indexName, dataSets, routes) =>
          Get(s"/datasets/search?query=*&limit=${dataSets.length}") ~> routes ~> check {
            status shouldBe OK
            contentType shouldBe `application/json`
            val response = responseAs[SearchResult]

            response.hitCount shouldEqual dataSets.length
            response.dataSets shouldEqual dataSets
          }
      }
    }

    it("hitCount should reflect all hits in the system, not just what is returned") {
      forAll(indexGen) {
        case (indexName, dataSets, routes) =>
          Get(s"/datasets/search?query=*&limit=${dataSets.length / 2}") ~> routes ~> check {
            val response = responseAs[SearchResult]

            response.hitCount shouldEqual dataSets.length
            response.dataSets should equal(dataSets.take(dataSets.length / 2))
          }
      }
    }
  }

  describe("querying a dataset's title") {
    it("should return that dataset") {
      forAll(indexGen) {
        case (indexName, dataSetsRaw, routes) =>
          val dataSets = dataSetsRaw.filter(dataSet => dataSet.title.isDefined && !dataSet.title.get.isEmpty())

          whenever(!dataSets.isEmpty) {
            val dataSetsPicker = for (dataset <- Gen.oneOf(dataSets)) yield dataset

            forAll(dataSetsPicker) { dataSet =>
              Get(s"""/datasets/search?query=${encodeForUrl(dataSet.title.get)}&limit=${dataSets.size}""") ~> routes ~> check {
                val result = responseAs[SearchResult]
                result.dataSets.exists(_.identifier.equals(dataSet.identifier)) shouldBe true
              }
            }
          }
      }
    }
  }

  describe("pagination") {
    it("should match the result of getting all datasets and using .drop(start).take(limit) to select a subset") {
      forAll(indexGen) {
        case (indexName, dataSets, routes) =>
          val dataSetCount = dataSets.size

          val starts = for (n <- Gen.choose(0, dataSetCount)) yield n
          val limits = for (n <- Gen.choose(0, dataSetCount)) yield n

          forAll(starts, limits) { (start, limit) =>
            whenever(start >= 0 && start <= dataSetCount && limit >= 0 && limit <= dataSetCount) {
              Get(s"/datasets/search?query=*&start=${start}&limit=${limit}") ~> routes ~> check {
                val result = responseAs[SearchResult]

                val expectedResultIdentifiers = dataSets.drop(start).take(limit).map(_.identifier)
                expectedResultIdentifiers shouldEqual result.dataSets.map(_.identifier)
              }
            }
          }
      }
    }
  }

  val queryGen = descWordGen.flatMap(Gen.oneOf(_))
  val facetSizes = for (n <- Gen.choose(1, 10)) yield n

  describe("facets") {
    def forAllNonEmptyFacets(inner: (String, Int, List[DataSet], Route) => Unit) = {
      forAll(indexGen, queryGen, facetSizes) { (tuple, query, facetSize) =>
        val (indexName, dataSets, routes) = tuple

        whenever(facetSize > 0 && query.matches(LUCENE_CONTROL_CHARACTER_REGEX)) {
          inner(query, facetSize, dataSets, routes)
        }
      }
    }

    describe("publisher") {
      it("should be consistent with grouping all the facet results by publisher id") {
        forAllNonEmptyFacets { (query, facetSize, dataSets, routes) =>
          Get(s"/datasets/search?query=${encodeForUrl(query)}&start=0&limit=${dataSets.size}&facetSize=$facetSize") ~> routes ~> check {

            val result = responseAs[SearchResult]
            val groupedResult = result.dataSets.groupBy(_.publisher.flatMap(_.name).getOrElse("Unspecified"))
            val publisherFacet = result.facets.get.find(_.id.equals(Publisher.id)).get

            publisherFacet.options.size should be <= facetSize

            val facetMinimal = publisherFacet.options.map(facet => (facet.value, facet.hitCount))

            facetMinimal shouldEqual groupedResult.mapValues(_.size).toList.sortBy(_._1).sortBy(-_._2).take(facetSize)
          }
        }
      }
    }

    describe("year") {

      it("should generate even, non-overlapping facets") {
        forAllNonEmptyFacets { (query, facetSize, dataSets, routes) =>
          Get(s"/datasets/search?query=${encodeForUrl(query)}&start=0&limit=${dataSets.size}&facetSize=$facetSize") ~> routes ~> check {

            val result = responseAs[SearchResult]
            val yearFacet = result.facets.get.find(_.id.equals(Year.id)).get
            yearFacet.options.size should be <= facetSize

            yearFacet.options.foreach { option =>
              val upperBound = option.upperBound.get.toInt
              val lowerBound = option.lowerBound.get.toInt
              val size = upperBound - lowerBound + 1

              option.value should equal(if (lowerBound == upperBound) lowerBound.toString else s"$lowerBound - " +
                s"$upperBound")
              YearFacetDefinition.YEAR_BIN_SIZES should contain(size)
              if (facetSize > 1) withClue(s"[$lowerBound-$upperBound with size $size]") {
                lowerBound % size shouldEqual 0
              }
            }

            val pairs = for {
              facet1 <- yearFacet.options
              facet2 <- yearFacet.options.filterNot(_ == facet1)
            } yield ((facet1.lowerBound.get, facet1.upperBound.get), (facet2.lowerBound.get, facet2.upperBound.get))

            pairs.foreach { tuple =>
              val options = yearFacet.options.map(_.value)
              val dataSetYears = dataSets.map(_.temporal.getOrElse("(no temporal)"))
              withClue(s"for options $options and dataSet years $dataSetYears") {
                overlaps(tuple) should be(false)
              }
            }
          }
        }
      }

      def overlaps(tuple: ((Int, Int), (Int, Int))) = {
        val ((lowerBound1, upperBound1), (lowerBound2, upperBound2)) = tuple
        (lowerBound1 <= lowerBound2 && upperBound1 > lowerBound2) || (upperBound1 >= upperBound2 && lowerBound1 < upperBound2)
      }

      def formatYears(dataSet: DataSet) = s"${dataSet.temporal.flatMap(_.start.flatMap(_.date.map(_.getYear))).getOrElse("n/a")}-${dataSet.temporal.flatMap(_.end.flatMap(_.date.map(_.getYear))).getOrElse("n/a")}"

      it("should be consistent with grouping all the facet results by temporal coverage year") {
        forAllNonEmptyFacets { (query, facetSize, dataSets, routes) =>
          Get(s"/datasets/search?query=${encodeForUrl(query)}&start=0&limit=${dataSets.size}&facetSize=$facetSize") ~> routes ~> check {
            val result = responseAs[SearchResult]
            val yearFacet = result.facets.get.find(_.id.equals(Year.id)).get

            yearFacet.options.foreach { option =>
              val matchingDataSets = result.dataSets
                .filter { dataSet =>
                  val start = dataSet.temporal.flatMap(_.start).flatMap(_.date)
                  val end = dataSet.temporal.flatMap(_.end).flatMap(_.date)

                  (start.orElse(end), end.orElse(start)) match {
                    case (Some(dataSetStart), Some(dataSetEnd)) =>
                      dataSetStart.getYear <= option.upperBound.get && dataSetEnd.getYear >= option.lowerBound.get
                    case _ => false
                  }
                }

              val years = dataSets.map(formatYears).mkString(",")
              withClue(s"For option ${option.value} and years $years") { matchingDataSets.size shouldEqual option.hitCount }
            }
          }
        }
      }
    }

    describe("format") {
      forAllNonEmptyFacets { (query, facetSize, dataSets, routes) =>

        whenever(facetSize > 0 && query.matches(LUCENE_CONTROL_CHARACTER_REGEX)) {
          Get(s"/datasets/search?query=${encodeForUrl(query)}&start=0&limit=${dataSets.size}&facetSize=$facetSize") ~> routes ~> check {
            val result = responseAs[SearchResult]
            val formatFacet = result.facets.get.find(_.id.equals(Format.id)).get

            formatFacet.options.foreach { option =>
              val matchingDataSets = if (!option.value.equals("Unspecified")) {
                result.dataSets
                  .filter(dataSet =>
                    dataSet.distributions.exists(distribution =>
                      distribution.format.map(format => format.equalsIgnoreCase(option.value))
                        .getOrElse(false)))
              } else {
                result.dataSets
                  .filter(dataSet =>
                    dataSet.distributions.exists(distribution =>
                      !distribution.format.isDefined))
              }

              val matchingFormats = for {
                dataSet <- dataSets
                distribution <- dataSet.distributions
              } yield distribution.format

              withClue(s"option: $option, matching dataSets: $matchingFormats") { matchingDataSets.size shouldEqual option.hitCount }
            }
          }
        }
      }
    }
  }

  val cleanUpQueue = new ConcurrentLinkedQueue[String]()

  def cleanUpIndexes() = {
    cleanUpQueue.iterator().forEachRemaining(
      new Consumer[String] {
        override def accept(indexName: String) = {
          logger.info(s"Deleting index $indexName")
          client.execute(deleteIndex(indexName)).await()
          cleanUpQueue.remove()
        }
      }
    )
  }

  after {
    cleanUpIndexes()
  }

  override def afterAll() = {
    super.afterAll()

    logger.info("cleaning up cache")

    Future.sequence((genCache.values).asScala.map(future =>
      future.flatMap {
        case (indexName, _, _) =>
          logger.debug("Deleting index {}", indexName)
          client.execute(deleteIndex(indexName))
      })).await(60 seconds)
  }
}
