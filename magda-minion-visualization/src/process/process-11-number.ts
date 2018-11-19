import { ProcessColumnIO } from "./base";
import { matchesRegex, isWithinRange, produceStatistics } from "./helpers";

const INTEGER_FORMAT = /^([+-])?([0-9]+)$/i;

export async function doProcessColumn(params: ProcessColumnIO): Promise<void> {
    const { input, output } = params;
    if (output.type !== "number") {
        return;
    }

    const { name, data } = input;

    output.subType = parseSubtype(name, output.values, data);

    output.statistics = produceStatistics(data, output.values);
}

function parseSubtype(name: string, values: any, data: any): string {
    let subType = matchesRegex(data, INTEGER_FORMAT) ? "integer" : "real";

    parseData(subType, data);

    if (name.match(/lat/i) && isLatitude(data)) {
        subType = "latitude";
    }
    if (name.match(/lon/i) && isLongitude(data)) {
        subType = "longitude";
    }

    return subType;
}

function parseData(type: string, data: any) {
    let parse = parseFloat;
    if (type === "integer") {
        parse = parseInt;
    }
    for (let index = 0; index < data.length; index++) {
        let value = data[index];
        data[index] = value !== null ? parse(value) : value;
    }
}

function isLatitude(data: any) {
    return isWithinRange(-90, 90, data);
}

function isLongitude(data: any) {
    return isWithinRange(-180, 180, data);
}
