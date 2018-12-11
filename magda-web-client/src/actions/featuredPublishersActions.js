// @flow
import fetch from "isomorphic-fetch";
import { config } from "../config";
import { actionTypes } from "../constants/ActionTypes";

export function requestPublishers(ids: Array<string>) {
    return {
        type: actionTypes.REQUEST_FEATURED_PUBLISHERS,
        ids
    };
}

export function receivePublishers(json: Array<Object>) {
    return {
        type: actionTypes.RECEIVE_FEATURED_PUBLISHERS,
        json
    };
}

export function fetchFeaturedPublishersFromRegistry(
    ids: Array<string>
): Object {
    return (dispatch: Function, getState: Function) => {
        if (getState().featuredPublishers.isFetching) {
            return false;
        }
        dispatch(requestPublishers(ids));
        const fetches = ids.map(id =>
            fetch(
                config.registryApiUrl +
                    `records/${id}?aspect=organization-details`,
                config.fetchOptions
            ).then(response => response.json())
        );
        Promise.all(fetches).then(jsons => dispatch(receivePublishers(jsons)));
    };
}
