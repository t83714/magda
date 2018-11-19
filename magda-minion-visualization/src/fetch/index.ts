import retryBackoff from "@magda/typescript-common/dist/retryBackoff";

import { canParse } from "../parse/index";
import { FetchOptions, FetchedData } from "./base";

/**
 * Will return true if we should be fetching this resource
 */
export function canFetch(resouceURI: string, resouceFormat: string): boolean {
    if (!resouceURI) {
        return false;
    }
    if (!canParse(resouceFormat)) {
        return false;
    }
    return !!findFetcher(resouceURI, resouceFormat);
}

/**
 * Will fetch resource
 */
export function doFetch(fetch: FetchOptions): Promise<FetchedData> {
    const fetcher: any = findFetcher(fetch.uri, fetch.format);
    return fetcher(fetch);
}

/**
 * Will fetch resource and retry if it fails for the wrong reasons
 */
export function doFetchRetry(
    fetch: FetchOptions,
    delaySeconds: number,
    retries: number
): Promise<FetchedData> {
    console.log(`Downloading ${fetch.uri}`);
    const operation = doFetch.bind(null, fetch);
    return retryBackoff(operation, delaySeconds, retries, (err, retries) => {
        console.log(
            `Downloading ${fetch.uri} failed: ${err.errorDetails ||
                err.httpStatusCode ||
                err} (${retries} retries remaining)`
        );
    });
}

export { FetchOptions, FetchedData } from "./base";

function findFetcher(uri: string, format: string): any {
    const found = fetchers.filter(fetcher => fetcher.canFetch(uri, format));
    if (found.length) {
        return found[0].doFetch;
    } else {
        return false;
    }
}

const fetchers = [require("./fetch-http")];
