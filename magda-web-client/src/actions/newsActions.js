import { config } from "../config";
import fetch from "isomorphic-fetch";
import { actionTypes } from "../constants/ActionTypes";
import type { Action } from "../types";
import parser from "rss-parser";
import type { Error } from "../types";

export function requestNews(): Action {
    return {
        type: actionTypes.REQUEST_NEWS
    };
}

export function receiveNews(news: Object): Action {
    return {
        type: actionTypes.RECEIVE_NEWS,
        news
    };
}

export function requestNewsError(error: Error): Action {
    return {
        type: actionTypes.REQUEST_NEWS_ERROR,
        error
    };
}

export function fetchNewsfromRss() {
    return (dispatch: Function, getState: Function) => {
        // check if we need to fetch
        if (getState().news.isFetching || getState().news.news.length > 0) {
            return false;
        }
        const url = config.rssUrl;
        fetch(url, config.fetchOptions)
            .then(response => {
                if (response.status === 200) {
                    return response.text();
                }
                throw new Error(response.statusText);
            })
            .then(text => {
                parser.parseString(text, (err, result) => {
                    if (err) {
                        console.warn(err);
                        dispatch(
                            requestNewsError({
                                title: "error",
                                detail: "can not get news"
                            })
                        );
                    } else {
                        dispatch(receiveNews(result.feed.entries));
                    }
                });
            })
            .catch(error =>
                dispatch(
                    requestNewsError({
                        title: error.name,
                        detail: error.message
                    })
                )
            );
    };
}
