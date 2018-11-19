import { MockRegistry } from "@magda/typescript-common/dist/test/connectors/MockRegistry";
import { MockFileServer } from "@magda/typescript-common/dist/test/connectors/MockFileServer";
import RegistryClient from "@magda/typescript-common/dist/registry/AuthorizedRegistryClient";
import { Record } from "@magda/typescript-common/dist/generated/registry/api";
import * as assert from "assert";

export function testOnRecordFoundAspect(testCases: any[], onRecordFound: any) {
    describe("MINION", function() {
        const registryPort = 5000 + Math.round(5000 * Math.random());
        const fileServerPort = registryPort + 1;

        let registry: MockRegistry;
        let registryClient: RegistryClient;
        let servers: any[] = [];

        beforeEach(async function() {
            servers.push(
                await (registry = new MockRegistry()).run(registryPort)
            );
            registry.aspects["visualization-info-v0"] = {
                jsonSchema: require("@magda/registry-aspects/visualization-info-v0.schema.json")
            };
            registryClient = new RegistryClient({
                jwtSecret: "test",
                userId: "test",
                baseUrl: `http://localhost:${registryPort}`
            });
        });

        afterEach(function() {
            servers.forEach(server => server.server.close());
        });

        testCases.forEach((testCase, index) => {
            it(`case ${index + 1}`, async function() {
                const { input, output } = testCase;

                servers.push(
                    await new MockFileServer(input).run(fileServerPort)
                );

                const record: Record = {
                    id: "record-id",
                    name: "record-name",
                    aspects: {
                        "dcat-distribution-strings": {
                            downloadURL: `http://localhost:${fileServerPort}/${
                                input.path
                            }`,
                            format: input.format
                        }
                    },
                    sourceTag: "record-source-tag"
                };

                await onRecordFound(record, registryClient);

                const actual =
                    registry.records["record-id"].aspects[
                        "visualization-info-v0"
                    ];

                // console.log(JSON.stringify(actual, null, 2));
                assert.deepEqual(actual, output);
            });
        });
    });
}
