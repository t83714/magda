import {} from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import * as nock from "nock";
import jsc from "@magda/typescript-common/dist/test/jsverify";
import * as express from "express";
import * as _ from "lodash";
import { Server } from "http";

import {
    lcAlphaNumStringArbNe,
    lcAlphaNumStringArb,
    recordArb
} from "@magda/typescript-common/dist/test/arbitraries";

import minion from "../index";
import MinionOptions from "../MinionOptions";
import fakeArgv from "./fakeArgv";
import makePromiseQueryable from "./makePromiseQueryable";
import baseSpec from "./baseSpec";

baseSpec(
    "on startup",
    (
        expressApp: () => express.Express,
        expressServer: () => Server,
        listenPort: () => number,
        beforeEachProperty: () => void
    ) => {
        jsc.property(
            "should properly crawl existing records if no webhook was found",
            lcAlphaNumStringArbNe,
            jsc.array(jsc.nestring),
            jsc.array(jsc.nestring),
            jsc.array(recordArb),
            jsc.suchthat(jsc.integer, int => int > 0),
            lcAlphaNumStringArbNe,
            lcAlphaNumStringArbNe,
            (
                registryHost,
                aspects,
                optionalAspects,
                records,
                pageSize,
                jwtSecret,
                userId
            ) => {
                beforeEachProperty();
                const registryUrl = `http://${registryHost}.com`;
                const registryScope = nock(registryUrl);
                registryScope.get(/\/hooks\/.*/).reply(404);
                registryScope.put(/\/hooks\/.*/).reply(201);

                let index = 0;
                const pages = _.groupBy(records, (element: any) => {
                    return Math.floor(index++ / pageSize);
                });
                pages[index + 1] = [];

                _.forEach(pages, (pageRecords: any, index: string) => {
                    registryScope
                        .get("/records")
                        .query((actualQuery: any) => {
                            const makeArray = (maybeArray: any | any[]) => {
                                if (!maybeArray) {
                                    return [];
                                } else if (Array.isArray(maybeArray)) {
                                    return maybeArray;
                                } else {
                                    return [maybeArray];
                                }
                            };

                            return (
                                index === "0" ||
                                    actualQuery.pageToken === index,
                                actualQuery.dereference &&
                                    arraysEqual(
                                        aspects,
                                        makeArray(actualQuery.aspect)
                                    ) &&
                                    arraysEqual(
                                        optionalAspects,
                                        makeArray(actualQuery.optionalAspect)
                                    )
                            );
                        })
                        .reply(200, {
                            totalCount: records.length,
                            hasMore: false,
                            nextPageToken: parseInt(index) + 1,
                            records: pageRecords
                        });
                });

                const options: MinionOptions = {
                    argv: fakeArgv({
                        internalUrl: `http://example.com`,
                        registryUrl,
                        jwtSecret,
                        userId,
                        listenPort: listenPort()
                    }),
                    id: "id",
                    aspects: aspects,
                    optionalAspects: optionalAspects,
                    writeAspectDefs: [],
                    express: expressApp,
                    maxRetries: 0,
                    onRecordFound: sinon
                        .stub()
                        .callsFake(() => Promise.resolve())
                };

                const minionPromise = makePromiseQueryable(minion(options));

                return minionPromise.then(() => {
                    records.forEach((record: object) => {
                        expect(
                            (options.onRecordFound as sinon.SinonSpy).calledWith(
                                record
                            )
                        );
                    });

                    return true;
                });
            }
        );

        const containsBlanks = (strings: string[]) =>
            strings.some(string => string === "");

        type input = {
            port: number;
            internalUrl: string;
            id: string;
            jwtSecret: string;
            userId: string;
            registryUrl: string;
            aspects: string[];
            optionalAspects: string[];
            concurrency: number;
        };

        jsc.property(
            "should handle bad inputs",
            jsc.suchthat(
                jsc.record({
                    port: jsc.integer,
                    internalUrl: lcAlphaNumStringArb,
                    id: lcAlphaNumStringArb,
                    aspects: jsc.array(lcAlphaNumStringArb),
                    optionalAspects: jsc.array(lcAlphaNumStringArb),
                    jwtSecret: lcAlphaNumStringArb,
                    userId: lcAlphaNumStringArb,
                    registryUrl: lcAlphaNumStringArb,
                    concurrency: jsc.integer(0, 10)
                }),
                (record: input) =>
                    record.port <= 0 ||
                    record.port >= 65535 ||
                    record.internalUrl === "" ||
                    record.id === "" ||
                    containsBlanks(record.aspects) ||
                    containsBlanks(record.optionalAspects) ||
                    record.jwtSecret === "" ||
                    record.userId === "" ||
                    record.registryUrl === ""
            ),
            ({
                port,
                internalUrl,
                id,
                aspects,
                optionalAspects,
                jwtSecret,
                userId,
                concurrency
            }: input) => {
                beforeEachProperty();

                const options: MinionOptions = {
                    argv: fakeArgv({
                        internalUrl: internalUrl,
                        listenPort: port,
                        registryUrl: "",
                        jwtSecret,
                        userId
                    }),
                    id: id,
                    aspects: aspects,
                    optionalAspects: optionalAspects,
                    writeAspectDefs: [],
                    express: expressApp,
                    concurrency,
                    onRecordFound: sinon
                        .stub()
                        .callsFake(record => Promise.resolve())
                };

                return minion(options)
                    .then(() => false)
                    .catch(() => true);
            }
        );
    }
);

function arraysEqual(a: any[], b: any[]) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}
