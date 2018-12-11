// @flow
import defined from "./defined";
import flatten from "lodash.flatten";
import { defaultConfiguration } from "../config.js";

type Query = {
    q: string,
    dateFrom: string,
    dateTo: string,
    publisher: string | Array<string>,
    format: string | Array<string>,
    regionId: string,
    regionType: string,
    page: number
};

export default function buildSearchQueryString(
    query: Query,
    searchResultsPerPage
) {
    let keywords = queryToString("query", query.q);
    let dateFroms = queryToString("dateFrom", query.dateFrom);
    let dateTos = queryToString("dateTo", query.dateTo);
    let publishers = queryToString(
        "publisher",
        query.organisation || query.publisher
    );
    let formats = queryToString("format", query.format);
    let locations = queryToString(
        "region",
        queryToLocation(query.regionId, query.regionType)
    );

    searchResultsPerPage = defined(searchResultsPerPage)
        ? searchResultsPerPage
        : defined(query.limit)
            ? query.limit
            : defaultConfiguration.searchResultsPerPage;

    let startIndex = defined(query.page)
        ? (query.page - 1) * searchResultsPerPage
        : 0;

    let queryArr = flatten([
        keywords,
        dateFroms,
        dateTos,
        publishers,
        formats,
        locations,
        "start=" + startIndex,
        "limit=" + (searchResultsPerPage + 1) // we get one more than we need so we can see what the score of the item at the top of the next page is
    ]);

    return queryArr.join("&");
}

function queryToString(paramName, paramValue) {
    if (!defined(paramValue)) return [];

    if (Array.isArray(paramValue)) {
        return flatten(
            paramValue.map(value => queryToString(paramName, value))
        );
    } else {
        return [`${paramName}=${encodeURIComponent(paramValue)}`];
    }
}

function queryToLocation(regionId, regiontype) {
    if (!defined(regionId) || !defined(regiontype)) return;
    return `${regiontype}:${regionId}`;
}
