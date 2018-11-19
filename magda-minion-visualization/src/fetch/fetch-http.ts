const sizeParser = require("filesize-parser");
import * as URI from "urijs";
import * as request from "request";
import GenericError from "@magda/typescript-common/dist/authorization-api/GenericError";

import { FetchOptions, FetchedData } from "./base";

export function canFetch(resouceURI: string, resouceFormat: string) {
    const parsedURI = new URI(resouceURI);
    return /^https?$/i.test(parsedURI.protocol());
}

export function doFetch(fetch: FetchOptions): Promise<FetchedData> {
    const limit: number = sizeParser(fetch.limit);
    let aborted = false;
    let body: Buffer[] = [];
    let size = 0;
    let error: any = undefined;
    let mime: string = undefined;

    return new Promise((resolve, reject) => {
        let req = request.get({
            method: "GET",
            uri: fetch.uri,
            gzip: true,
            encoding: null
        });
        req = req
            .on("error", function(err) {
                console.log("ERROR", err);
                reject(err);
            })
            .on("aborted", function(data) {
                aborted = true;
            });
        req = req
            .on("response", response => {
                // check status code
                if (response.statusCode < 200 && response.statusCode > 299) {
                    req.abort();
                    reject(
                        new GenericError(
                            response.statusMessage,
                            response.statusCode
                        )
                    );
                    return;
                }
                mime = response.headers["content-type"];
                // check content-length
                if (response.headers["content-length"]) {
                    const size = parseInt(
                        response.headers["content-length"],
                        10
                    );
                    if (size > limit) {
                        error = `Went over limit ${size} > ${limit}`;
                        req.abort();
                        return;
                    }
                }
            })
            .on("data", function(data) {
                // check uncompressed length
                body.push(<Buffer>data);
                size += data.length;
                if (size > limit) {
                    error = `Went over limit ${size} > ${limit}`;
                    req.abort();
                }
            })
            .on("end", function() {
                // finish promise
                resolve(
                    Object.assign({
                        success: !aborted,
                        error,
                        mime,
                        data: Buffer.concat(body),
                        uri: fetch.uri,
                        limit,
                        format: fetch.format
                    })
                );
            });
    });
}
