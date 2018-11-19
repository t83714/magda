import minion from "@magda/minion-framework/dist/index";
import { onRecordFound, ASPECT_NAME } from "./onRecordFound";
import commonYargs from "@magda/minion-framework/dist/commonYargs";

const ID = "minion-visualization";
const argv = commonYargs(ID, 6311, "http://localhost:6311");

const aspectDefinition = {
    id: ASPECT_NAME,
    name:
        "Information to power smart visualisations for distributions in the front-end",
    jsonSchema: require(`@magda/registry-aspects/${ASPECT_NAME}.schema.json`)
};

minion({
    argv,
    aspects: ["dcat-distribution-strings"],
    async: true,
    id: ID,
    onRecordFound,
    optionalAspects: [],
    writeAspectDefs: [aspectDefinition]
}).catch((e: Error) => {
    console.error("Error: " + e.message, e);
    process.exit(1);
});
