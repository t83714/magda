import Registry from "@magda/typescript-common/dist/registry/AuthorizedRegistryClient";
//
import { Record } from "@magda/typescript-common/dist/generated/registry/api";

import * as fetch from "./fetch/index";
import * as parse from "./parse/index";
import * as process from "./process/index";

export async function onRecordFound(
    record: Record,
    registry: Registry
): Promise<void> {
    const { downloadURL, format } = record.aspects["dcat-distribution-strings"];

    // fetch
    if (!fetch.canFetch(downloadURL, format)) {
        return;
    }

    let fetched = await fetch.doFetchRetry(
        {
            uri: downloadURL,
            limit: "5mb",
            format
        },
        1,
        5
    );

    // parse
    if (!fetched || !fetched.success) {
        return;
    }
    let parsed = await parse.doParse(fetched);

    // process
    let visualizationInfo = await process.doProcess(parsed);

    // update
    await registry.putRecordAspect(record.id, ASPECT_NAME, visualizationInfo);

    return undefined;
}

export const ASPECT_NAME = "visualization-info-v0";
