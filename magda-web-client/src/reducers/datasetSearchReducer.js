// @flow
import type {
    SearchState,
    DataSearchJson,
    Dataset,
    Query,
    FacetOption,
    Region,
    SearchAction
} from "../helpers/datasetSearch";

import findIndex from "lodash.findindex";
import findMatchingObjs from "../helpers/findMatchingObjs";
import queryFilterFormat from "../helpers/queryFilterFormat";
import regionToObject from "../helpers/regionToObject";

const initialData = {
    isFetching: false,
    datasets: [],
    hitCount: 0,
    progress: 0,
    activePublishers: [],
    activeFormats: [],
    activeRegion: {
        regionId: undefined,
        regionType: undefined,
        boundingBox: {
            west: 105,
            south: -45,
            east: 155,
            north: -5
        }
    },
    activeDateFrom: null,
    activeDateTo: null,
    freeText: "",
    publisherOptions: [],
    formatOptions: [],
    temporalRange: null,
    apiQuery: "",
    strategy: "match-all",
    error: null,
    queryObject: null
};

const datasetSearchReducer = (
    state: SearchState = initialData,
    action: SearchAction
) => {
    switch (action.type) {
        case "REQUEST_RESULTS":
            let queryObject = action.queryObject;
            let activePub = queryFilterFormat(queryObject.organisation);
            let activeFormat = queryFilterFormat(queryObject.format);
            let regionSelected = regionToObject(queryObject);
            return Object.assign({}, state, {
                isFetching: true,
                error: null,
                apiQuery: action.apiQuery && action.apiQuery,
                queryObject,
                temporalRange: [
                    new Date(queryObject.dateFrom),
                    new Date(queryObject.dateTo)
                ],
                publisherOptions: initialData.publisherOptions,
                formatOptions: initialData.formatOptions,
                activePublishers: activePub,
                activeRegions: regionSelected,
                activeDateFrom: queryObject.dateFrom
                    ? queryObject.dateFrom
                    : initialData.activeDateFrom,
                activeDateTo: queryObject.dateTo
                    ? queryObject.activeDateTo
                    : initialData.activeDateTo,
                activeFormats: activeFormat
            });
        case "FETCH_ERROR":
            return Object.assign({}, state, {
                isFetching: false,
                error: action.error
            });
        case "RESET_DATASET_SEARCH":
            return Object.assign({}, state, {
                isFetching: false,
                error: null,
                datasets: [],
                hitCount: 0,
                apiQuery: ""
            });
        case "RECEIVE_RESULTS":
            const defaultJson = {
                query: {
                    quotes: [],
                    freeText: "",
                    regions: [null],
                    formats: [],
                    publishers: []
                },
                hitCount: 0,
                dataSets: [],
                strategy: "",
                facets: []
            };
            let data: DataSearchJson = action.json ? action.json : defaultJson;
            let query: Query = data && data.query && data.query;
            let datasets: Array<Dataset> =
                data && data.dataSets && data.dataSets;
            let hitCount: number = data && data.hitCount && data.hitCount;
            let temporalRange: Array<Object> =
                data &&
                data.temporal &&
                data.temporal.start &&
                data.temporal.end
                    ? [
                          new Date(data.temporal.start.date),
                          new Date(data.temporal.end.date)
                      ]
                    : initialData.temporalRange;

            let publisherOptions: Array<FacetOption> =
                data && data.facets && data.facets[0]
                    ? data.facets[0].options
                    : initialData.publisherOptions;
            let formatOptions: Array<FacetOption> =
                data && data.facets && data.facets[1]
                    ? data.facets[1].options
                    : initialData.formatOptions;

            let freeText: string = data.query.freeText;
            let activePublishers: Array<FacetOption> = findMatchingObjs(
                query.publishers,
                publisherOptions
            );
            let activeDateFrom: ?string = query.dateFrom
                ? query.dateFrom
                : initialData.activeDateFrom;
            let activeDateTo: ?string = query.dateTo
                ? query.dateTo
                : initialData.activeDateTo;
            let activeFormats: Array<FacetOption> = findMatchingObjs(
                query.formats,
                formatOptions
            );

            let activeRegion: Region =
                query.regions[0] || initialData.activeRegion;
            return Object.assign({}, state, {
                isFetching: false,
                apiQuery: action.apiQuery && action.apiQuery,
                strategy: data.strategy && data.strategy,
                datasets,
                hitCount,
                publisherOptions,
                formatOptions,
                temporalRange,
                freeText,
                activePublishers,
                activeRegion,
                activeDateFrom,
                activeDateTo,
                activeFormats,
                error: null
            });

        case "UPDATE_PUBLISHERS":
            return Object.assign({}, state, {
                activePublishers: action.items
            });

        case "RESET_PUBLISHER":
            return Object.assign({}, state, {
                activePublishers: initialData.activePublishers
            });

        case "ADD_REGION":
            return Object.assign({}, state, {
                activeRegion: action.item
            });

        case "RESET_REGION":
            return Object.assign({}, state, {
                activeRegion: initialData.activeRegion
            });

        case "SET_DATE_FROM":
            return Object.assign({}, state, {
                activeDateFrom: action.item
            });

        case "SET_DATE_TO":
            return Object.assign({}, state, {
                activeDateTo: action.item
            });

        case "RESET_DATE_FROM":
            return Object.assign({}, state, {
                activeDateFrom: initialData.activeDateFrom
            });

        case "RESET_DATE_TO":
            return Object.assign({}, state, {
                activeDateTo: initialData.activeDateTo
            });

        case "UPDATE_FORMATS":
            return Object.assign({}, state, {
                activeFormats: action.items
            });

        case "REMOVE_FORMAT":
            let formatIndex = findIndex(
                state.activeFormats,
                item => item.value === (action.item && action.item.value)
            );
            return Object.assign({}, state, {
                activeFormats: [
                    ...state.activeFormats.slice(0, formatIndex),
                    ...state.activeFormats.slice(formatIndex + 1)
                ]
            });

        case "RESET_FORMAT":
            return Object.assign({}, state, {
                activeFormats: initialData.activeFormats
            });

        default:
            return state;
    }
};
export default datasetSearchReducer;
