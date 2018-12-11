package au.csiro.data61.magda.api

import java.io.File
import java.time.{ Instant, OffsetDateTime }
import java.util.Properties
import java.util.concurrent.ConcurrentHashMap

import akka.actor.{ ActorSystem, Scheduler }
import akka.event.{ Logging, LoggingAdapter }
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import akka.http.scaladsl.model.ContentTypes.`application/json`
import akka.http.scaladsl.model.StatusCodes.{ InternalServerError, OK }
import akka.http.scaladsl.server.Route
import akka.http.scaladsl.testkit.{ RouteTestTimeout, ScalatestRouteTest }
import au.csiro.data61.magda.AppConfig
import au.csiro.data61.magda.api.model.{ Protocols, SearchResult }
import au.csiro.data61.magda.model.misc.{ DataSet, _ }
import au.csiro.data61.magda.search.elasticsearch.ElasticSearchImplicits._
import au.csiro.data61.magda.search.elasticsearch._
import au.csiro.data61.magda.test.util.ApiGenerators._
import com.typesafe.config.{ Config, ConfigFactory }
import org.elasticsearch.common.settings.Settings
import org.scalacheck.Shrink
import org.scalacheck._
import org.scalactic.anyvals.PosInt
import org.scalatest.{ BeforeAndAfter, Matchers, _ }
import org.scalatest.prop.GeneratorDrivenPropertyChecks
import spray.json._

import scala.collection.JavaConverters._
import scala.concurrent.{ ExecutionContext, Future }
import scala.concurrent.duration.DurationInt
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicInteger
import java.util.function.Consumer
import au.csiro.data61.magda.util.SetExtractor
import org.scalacheck.Arbitrary._
import au.csiro.data61.magda.model.Temporal.PeriodOfTime
import au.csiro.data61.magda.search.SearchStrategy.{ MatchAll, MatchPart }
import java.util.HashMap
import com.sksamuel.elastic4s.http.HttpClient
import org.elasticsearch.cluster.health.ClusterHealthStatus
import au.csiro.data61.magda.test.util.testkit.LocalNode
import au.csiro.data61.magda.api.model.SearchResult
import au.csiro.data61.magda.api.model.Protocols
import au.csiro.data61.magda.util.SetExtractor
import au.csiro.data61.magda.test.util.Generators
import scala.reflect.internal.util.Statistics.View
import au.csiro.data61.magda.search.SearchStrategy

class FacetSpec extends BaseSearchApiSpec {

  blockUntilNotRed()

  describe("facets") {
    def checkFacetsNoQuery(indexGen: Gen[(String, List[DataSet], Route)] = mediumIndexGen, facetSizeGen: Gen[Int] = Gen.posNum[Int])(inner: (List[DataSet], Int) ⇒ Unit) = {
      try {
        forAll(indexGen, facetSizeGen, Gen.posNum[Int], Gen.posNum[Int]) { (tuple, rawFacetSize, start, limit) ⇒
          val (indexName, dataSets, routes) = tuple
          val facetSize = Math.max(rawFacetSize, 1)

          whenever(start >= 0 && limit >= 0) {
            Get(s"/v0/datasets?query=*&start=$start&limit=$limit&facetSize=$facetSize") ~> routes ~> check {
              status shouldBe OK
              inner(dataSets, facetSize)
            }
          }
        }
      } catch {
        case e: Throwable =>
          e.printStackTrace
          throw e
      }
    }

    val defaultGen = for {
      tuple <- mediumIndexGen
      query <- textQueryGen(queryGen(tuple._2))
    } yield (tuple, query, Seq())

    def checkFacetsWithQueryGen(gen: Gen[((String, List[DataSet], Route), (String, Query), Seq[String])] = defaultGen, facetSizeGen: Gen[Int] = Gen.choose(1, 20))(inner: (List[DataSet], Int, Query, List[DataSet], Route) ⇒ Unit): Unit = {
      forAll(gen, facetSizeGen) {
        case ((tuple, query, facetValues), rawFacetSize) ⇒
          val (indexName, dataSets, routes) = tuple
          val (textQuery, objQuery) = query
          val facetSize = Math.max(rawFacetSize, 1)

          Get(s"/v0/datasets?${textQuery}&start=0&limit=${dataSets.size}&facetSize=$facetSize") ~> routes ~> check {
            status shouldBe OK
            inner(responseAs[SearchResult].dataSets, facetSize, objQuery, dataSets, routes)
          }
      }
    }

    def checkFacetsWithQuery(thisTextQueryGen: List[DataSet] => Gen[(String, Query)] = dataSets => textQueryGen(queryGen(dataSets)), thisIndexGen: Gen[((String, List[DataSet], Route))] = indexGen, facetSizeGen: Gen[Int] = Gen.choose(0, 20))(inner: (List[DataSet], Int, Query, List[DataSet], Route) ⇒ Unit): Unit = {
      val gen: Gen[((String, List[DataSet], Route), (String, Query), Seq[String])] = for {
        tuple <- thisIndexGen
        query <- thisTextQueryGen(tuple._2)
      } yield (tuple, query, Seq[String]())
      checkFacetsWithQueryGen(gen, facetSizeGen)(inner)
    }

    def checkFacetsBoth(facetSizeGen: Gen[Int] = Gen.posNum[Int])(inner: (List[DataSet], Int) ⇒ Unit) = {
      it("with no query and various pagination values") {
        checkFacetsNoQuery(facetSizeGen = facetSizeGen)(inner(_, _))
      }
      it("with a query") {
        checkFacetsWithQueryGen(facetSizeGen = facetSizeGen)((dataSets, facetSize, _, _, _) ⇒ inner(dataSets, facetSize))
      }
    }

    def searchWithoutFacetFilter(query: Query, facetType: FacetType, routes: Route, outerResult: SearchResult, allDataSets: List[DataSet])(inner: (SearchResult, List[DataSet]) => Unit) = {
      val queryWithoutFilter = FacetDefinition.facetDefForType(facetType).removeFromQuery(query)
      whenever(!queryWithoutFilter.equals(Query())) {
        val textQueryWithoutFacet = queryToText(queryWithoutFilter)

        Get(s"/v0/datasets?${textQueryWithoutFacet}&start=0&limit=${allDataSets.size}&facetSize=1") ~> routes ~> check {
          status shouldBe OK
          val innerResult = responseAs[SearchResult]
          val innerDataSets = innerResult.dataSets
          whenever(innerResult.strategy.get.equals(outerResult.strategy.get) && innerResult.strategy.get.equals(MatchAll)) {
            inner(innerResult, innerDataSets)
          }
        }
      }
    }

    def genericFacetSpecs(facetType: FacetType, reducer: DataSet ⇒ Set[String], queryCounter: Query ⇒ Int, filterQueryGen: List[DataSet] => Gen[Query], specificGen: List[DataSet] => Gen[Query]) = {
      def filter(dataSet: DataSet, facetOption: FacetOption) = {
        val facetValue = reducer(dataSet)

        facetValue.exists(_.equalsIgnoreCase(facetOption.value))
      }

      def groupResult(dataSets: Seq[DataSet]): Map[String, Set[DataSet]] = {
        dataSets.foldRight(Map[String, Set[DataSet]]()) { (currentDataSet, aggregator) ⇒
          val reduced = reducer(currentDataSet)

          reduced.foldRight(aggregator) { (string, aggregator) ⇒
            aggregator + (string -> (aggregator.get(string) match {
              case Some(existingDataSets) ⇒ existingDataSets + currentDataSet
              case None                   ⇒ Set(currentDataSet)
            }))
          }
        }
      }

      def getFacet(result: SearchResult) = result.facets.get.find(_.id.equals(facetType.id)).get

      describe("all facet options should correspond with grouping the datasets for that query") {
        it("without query") {
          checkFacetsNoQuery() { (dataSets: List[DataSet], facetSize: Int) ⇒
            val result = responseAs[SearchResult]

            val groupedResult = groupResult(dataSets)
            val facet = getFacet(result)

            whenever(!facet.options.isEmpty) {
              facet.options.foreach { facetOption ⇒
                withClue(s"With reduced values (${groupedResult.mapValues(_.size)}) and facetOption ${facetOption}: ") {
                  if (facetOption.hitCount != 0) {
                    groupedResult.contains(facetOption.value) should be(true)
                    facetOption.hitCount should be(groupedResult(facetOption.value).size)
                  } else {
                    groupedResult.contains(facetOption.value) should be(false)
                  }
                }
              }
            }
          }
        }

        describe("with query") {
          it("with matched facet options") {
            checkFacetsWithQuery(dataSets => textQueryGen(filterQueryGen(dataSets)), mediumIndexGen) { (dataSets, facetSize, query, allDataSets, routes) ⇒
              val outerResult = responseAs[SearchResult]
              val facet = getFacet(outerResult)

              val matched = facet.options.filter(_.matched)
              whenever(matched.size > 0 && outerResult.strategy.get == MatchAll) {
                val groupedResults = groupResult(dataSets).mapValues(_.size)
                matched.foreach { option ⇒

                  withClue(s"For option ${option} and grouped datasets ${groupedResults} and all options ${facet.options}") {
                    groupedResults(option.value).toLong should equal(option.hitCount)
                  }
                }
              }
            }
          }

          it("matched facets should come above unmatched") {
            checkFacetsWithQuery(dataSets => textQueryGen(filterQueryGen(dataSets)), mediumIndexGen) { (dataSets, facetSize, query, allDataSets, routes) ⇒
              val outerResult = responseAs[SearchResult]
              val facet = getFacet(outerResult)

              val (matched, unmatched) = facet.options.partition(_.matched)
              whenever(matched.size > 0 && unmatched.size > 0) {
                facet.options should equal(matched ++ unmatched)
              }
            }
          }

          it("with unmatched facet options") {
            checkFacetsWithQuery(dataSets => textQueryGen(queryGen(dataSets)), mediumIndexGen) { (dataSets, facetSize, query, allDataSets, routes) ⇒
              val outerResult = responseAs[SearchResult]
              val facet = getFacet(outerResult)

              searchWithoutFacetFilter(query, facetType, routes, outerResult, allDataSets) { (innerResult, innerDataSets) =>
                val unmatched = facet.options.filter(!_.matched)

                whenever(!unmatched.isEmpty) {
                  unmatched.foreach { option ⇒
                    val grouped = groupResult(innerDataSets)

                    withClue(s"For option ${option} and grouped datasets ${grouped.mapValues(_.size)}") {
                      grouped(option.value).size shouldEqual option.hitCount
                    }
                  }
                }
              }
            }
          }
        }

        describe("exact match facets") {
          it("should not show filters that do not have records") {
            def exactGen(dataSets: List[DataSet]) = for {
              baseQuery <- specificGen(dataSets)
              uuid <- Gen.uuid
              query = baseQuery.copy(freeText = Some(baseQuery.freeText + s""""${uuid.toString}""""))
            } yield query

            checkFacetsWithQuery(dataSets => textQueryGen(exactGen(dataSets)), mediumIndexGen) { (dataSets, facetSize, query, allDataSets, routes) ⇒
              val outerResult = responseAs[SearchResult]
              val facet = getFacet(outerResult)

              val exactMatchFacets = facet.options.filter(option => option.matched && option.hitCount == 0)

              whenever(exactMatchFacets.size > 0) {
                val grouped = groupResult(allDataSets)

                exactMatchFacets.foreach { option =>
                  val globalDataSets = allDataSets.filter(filter(_, option))

                  withClue(s"with option $option and $grouped") {
                    globalDataSets.size should be > 0
                  }
                }
              }
            }
          }
        }
      }

      def getFormats(dataSets: List[DataSet]) = dataSets.map(_.distributions.flatMap(_.format)).groupBy(identity).mapValues(_.size)

      describe("each dataset should be aggregated into a facet unless facet size was too small to accommodate it") {
        it("without query") {
          checkFacetsNoQuery(indexGen = smallIndexGen, facetSizeGen = Gen.choose(10, 100)) { (dataSets: List[DataSet], facetSize: Int) ⇒
            val result = responseAs[SearchResult]
            val groupedResult = groupResult(dataSets)

            whenever(facetSize >= groupedResult.size + queryCounter(result.query)) {
              val facet = getFacet(result)

              withClue(s"With grouped result ${groupedResult}") {
                groupedResult.mapValues(_.size).foreach {
                  case (facetValue, hitCount) ⇒
                    val option = facet.options.find(_.value.equals(facetValue))
                    withClue(s" and facetValue $facetValue and option $option: ") {
                      option.isDefined should be(true)
                      hitCount should equal(option.get.hitCount)
                    }
                }
              }
            }
          }
        }

        describe("with query") {
          it("for matched facet options") {
            def queryGen(dataSets: List[DataSet]) = Generators.nonEmptyListOf(specifiedPublisherQueryGen(dataSets)).flatMap(publishers => Query(publishers = publishers.map(Specified.apply).toSet))

            checkFacetsWithQuery(dataSets => textQueryGen(queryGen(dataSets)), facetSizeGen = Gen.const(Int.MaxValue)) { (dataSets, facetSize, query, allDataSets, routes) ⇒
              val outerResult = responseAs[SearchResult]
              val outerDataSets = outerResult.dataSets
              val facet = getFacet(outerResult)

              val outerGroupedResults = groupResult(outerDataSets)
              whenever(facetSize == Int.MaxValue && outerResult.strategy.get == MatchAll) {
                withClue(s"With grouped results ${outerGroupedResults.mapValues(_.size)} and options ${facet.options}") {
                  outerGroupedResults.mapValues(_.size).foreach {
                    case (facetValue, hitCount) ⇒
                      val option = facet.options.find(_.value.equals(facetValue))
                      withClue(s" and option $facetValue: ") {
                        option.isDefined should be(true)
                        if (option.get.matched) {
                          hitCount should equal(option.get.hitCount)
                        }
                      }
                  }
                }
              }
            }
          }

          it("for unmatched facet options") {
            checkFacetsWithQuery(dataSets => textQueryGen(unspecificQueryGen(dataSets)), mediumIndexGen, facetSizeGen = Gen.const(Int.MaxValue)) { (dataSets, facetSize, query, allDataSets, routes) ⇒
              val outerResult = responseAs[SearchResult]
              val facet = getFacet(outerResult)

              searchWithoutFacetFilter(query, facetType, routes, outerResult, allDataSets) { (innerResult, innerDataSets) =>
                val innerGroupedResult = groupResult(innerDataSets)

                whenever(facetSize == Int.MaxValue) {
                  withClue(s"With grouped results ${innerGroupedResult.mapValues(_.size)} ") {
                    innerGroupedResult.mapValues(_.size).foreach {
                      case (facetValue, hitCount) ⇒
                        val option = facet.options.find(_.value.equals(facetValue))
                        withClue(s" and option $option: ") {
                          option.isDefined should be(true)
                          if (!option.get.matched) {
                            hitCount should equal(option.get.hitCount)
                          }
                        }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    describe("should never generate a facet size bigger than what was asked for") {
      checkFacetsBoth() { (dataSets: List[DataSet], facetSize: Int) ⇒
        val result = responseAs[SearchResult]
        val facets = FacetType.all.flatMap(facetType ⇒ result.facets.get.find(facet => facetType.id.equals(facet.id)))

        whenever(!facets.isEmpty) {
          facets.foreach { facet ⇒
            facet.options.size should be <= facetSize
          }
        }
      }
    }

    describe("publisher") {
      def reducer(dataSet: DataSet) = Set(dataSet.publisher.flatMap(_.name)).flatten
      def queryToInt(query: Query) = query.publishers.size

      def queryGen(dataSets: List[DataSet]) = for {
        publishers <- Generators.smallSet(publisherQueryGen(dataSets))
      } yield new Query(publishers = publishers)

      def specificBiasedQueryGen(dataSets: List[DataSet]) = Query(publishers = dataSets.flatMap(_.publisher.flatMap(_.name)).map(Specified.apply).toSet)

      genericFacetSpecs(Publisher, reducer, queryToInt, queryGen, specificBiasedQueryGen)

      describe("should have identifiers") {
        implicit val stringShrink: Shrink[List[Agent]] = Shrink { string =>
          Stream.empty
        }

        it("in general") {
          val gen = for {
            index <- indexGen
            textQuery <- textQueryGen(queryGen(index._2))
            facetSize <- Gen.posNum[Int]
          } yield (index, textQuery, facetSize)

          try {
            forAll(gen) {
              case (tuple, textQuery, facetSize) ⇒
                val (indexName, dataSets, routes) = tuple

                val publishers = dataSets.flatMap(_.publisher).distinct

                val publisherLookup = publishers
                  .groupBy(_.name.get.toLowerCase)

                Get(s"/v0/datasets?${textQuery._1}&start=0&limit=0&facetSize=${Math.max(facetSize, 1)}") ~> routes ~> check {
                  status shouldBe OK

                  val result = responseAs[SearchResult]

                  val facet = result.facets.get.find(_.id.equals(Publisher.id)).get

                  withClue("publishers " + publisherLookup) {
                    facet.options.foreach { x =>
                      val matchedPublishers = publisherLookup(x.value.toLowerCase)
                      matchedPublishers.exists(publisher => publisher.identifier.get.equals(x.identifier.get)) should be(true)
                    }
                  }
                }
            }
          } catch {
            case e: Throwable =>
              e.printStackTrace
              throw e
          }
        }

        it("for exact match facets") {
          implicit def indexShrinker(implicit a: Shrink[(String, List[DataSet], Route)], b: Shrink[Int], c: Shrink[(String, Query)], d: Shrink[Seq[Agent]]) = Shrink[((String, List[DataSet], Route), Int, (String, Query), Seq[Agent])] {
            case _ =>
              Stream.empty
          }

          val exactMatchMerges = for {
            tuple <- mediumIndexGen
            (indexName, dataSets, routes) = tuple
            facetSize <- Gen.posNum[Int]
            actualPublishers <- Gen.someOf(dataSets.flatMap(_.publisher))
            uuid <- Gen.uuid
            query = Query(freeText = Some(s""""${uuid.toString}""""), publishers = actualPublishers.flatMap(_.name).map(x => Specified(x)).toSet)
            textQuery <- textQueryGen(query)
          } yield (tuple, facetSize, textQuery, actualPublishers)

          forAll(exactMatchMerges) {
            case (tuple, facetSize, textQuery, publishers) ⇒
              val (indexName, dataSets, routes) = tuple

              Get(s"/v0/datasets?${textQuery._1}&start=0&limit=0&facetSize=${Math.max(facetSize, 1)}") ~> routes ~> check {
                status shouldBe OK

                val result = responseAs[SearchResult]

                val facet = result.facets.get.find(_.id.equals(Publisher.id)).get

                val exactMatchFacets = facet.options.filter(option => option.matched && option.hitCount == 0)

                val publisherLookup = dataSets
                  .flatMap(_.publisher)
                  .groupBy(_.name.get.toLowerCase)

                whenever(exactMatchFacets.size > 0) {
                  exactMatchFacets.foreach { filterValue =>
                    withClue(s"with publishers ${publisherLookup.map(x => (x._1, x._2.map(_.identifier)))} and facet ${filterValue.toString}") {
                      filterValue.identifier should not be (None)
                      publisherLookup.contains(filterValue.value.toLowerCase) should be(true)
                      val matchedPublishers = publisherLookup(filterValue.value.toLowerCase)
                      matchedPublishers.exists(publisher => publisher.identifier.get.equals(filterValue.identifier.get)) should be(true)
                    }
                  }
                }
              }
          }
        }
      }

    }

    describe("format") {
      def reducer(dataSet: DataSet) = dataSet.distributions.flatMap(_.format.map(_.toLowerCase)).toSet
      def queryToInt(query: Query) = query.formats.size

      def filterQueryGen(dataSets: List[DataSet]) = Generators.smallSet(formatQueryGen(dataSets)).flatMap(formats => Query(formats = formats))
      def specificBiasedQueryGen(dataSets: List[DataSet]) = Query(formats = dataSets.flatMap(_.distributions.flatMap(_.format)).map(Specified.apply).toSet)

      genericFacetSpecs(Format, reducer, queryToInt, filterQueryGen, specificBiasedQueryGen)
    }

    describe("year") {
      it("with no query") {
        checkFacetsNoQuery() { (dataSets, facetSize) =>
          checkDataSetResult(dataSets, responseAs[SearchResult])
        }
      }

      it("with a query") {
        val queryGen = for {
          dateFrom <- dateFromGen
          dateTo <- dateToGen
          result <- Gen.oneOf(Query(dateFrom = Some(dateFrom)), Query(dateTo = Some(dateTo)), Query(dateFrom = Some(dateFrom), dateTo = Some(dateTo)))
        } yield result

        checkFacetsWithQuery(dataSets => textQueryGen(queryGen)) { (dataSets, facetSize, query, allDataSets, routes) ⇒
          val result = responseAs[SearchResult]
          whenever(result.strategy.get == SearchStrategy.MatchAll) {
            val filteredDataSets = filterDataSetsForDateRange(dataSets, query.dateFrom, query.dateTo)
            checkDataSetResult(filteredDataSets, result)
          }
        }
      }

      def checkDataSetResult(dataSets: List[DataSet], result: SearchResult) = {
        dataSets match {
          case Nil =>
            result.temporal.flatMap(_.end) shouldEqual None
            result.temporal.flatMap(_.start) shouldEqual None
          case dataSets =>
            val expectedMax = dataSets.map(dataSet => dataSet.temporal.flatMap(_.end).flatMap(_.date)).flatten match {
              case Seq() => None
              case dates => Some(dates.max)
            }
            val expectedMin = dataSets.map(dataSet => dataSet.temporal.flatMap(_.start).flatMap(_.date)).flatten match {
              case Seq() => None
              case dates => Some(dates.min)
            }

            result.temporal.flatMap(_.end).flatMap(_.date).map(_.toEpochSecond()) shouldEqual expectedMax.map(_.toEpochSecond)
            result.temporal.flatMap(_.start).flatMap(_.date).map(_.toEpochSecond()) shouldEqual expectedMin.map(_.toEpochSecond)
        }
      }

      def filterDataSetsForDateRange(dataSets: List[DataSet], lowerBound: Option[FilterValue[OffsetDateTime]], upperBound: Option[FilterValue[OffsetDateTime]]) = dataSets
        .filter { dataSet =>
          (lowerBound, upperBound) match {
            case (Some(Unspecified()), Some(Unspecified())) | (Some(Unspecified()), None) | (None, Some(Unspecified())) =>
              dataSet.temporal.map(temporal => temporal.start.isEmpty && temporal.end.isEmpty).getOrElse(true)
            case _ =>
              val startOption = dataSet.temporal.flatMap(_.start).flatMap(_.date)
              val endOption = dataSet.temporal.flatMap(_.end).flatMap(_.date)

              val start = startOption.orElse(endOption).getOrElse(OffsetDateTime.MAX)
              val end = endOption.orElse(startOption).getOrElse(OffsetDateTime.MIN)

              val lower = lowerBound.flatMap(a => a).getOrElse(OffsetDateTime.MIN)
              val upper = upperBound.flatMap(a => a).getOrElse(OffsetDateTime.MAX)

              !(start.isAfter(upper) || end.isBefore(lower))
          }
        }
    }
  }
}
