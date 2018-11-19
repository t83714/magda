import { testOnRecordFoundAspect } from "./testOnRecordFoundAspect";
import { onRecordFound } from "../onRecordFound";

const fs = require("fs");
const path = require("path");

const TEST_CASES = [
    {
        input: {
            mime: "text/csv",
            data: fs.readFileSync(path.join(__dirname, "csv1.csv")),
            path: "csv.csv",
            format: "csv-geo-au"
        },
        output: JSON.parse(fs.readFileSync(path.join(__dirname, "csv1.json")))
    }
];

testOnRecordFoundAspect(TEST_CASES, onRecordFound);
