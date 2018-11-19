import { ProcessColumnIO } from "./base";
import * as moment from "moment";

const NUMBER_FORMAT = /^([+-])?([0-9]+)([.][0-9]+)?([e][+-]?[0-9]+)?$/i;
const NO_SPACES = /^[^\s]*$/;
const OF_ID_LENGTH = /^.{1,128}$/;
import { matchesRegex, getValuesFrequency } from "./helpers";

const DATE_TIME_FORMATS = [
    moment.ISO_8601,
    "D-M-YYYY",
    "D-M-YY",
    "D/M/YYYY",
    "D/M/YY",
    "YYYY-[Q]Q"
];

export async function doProcessColumn(params: ProcessColumnIO): Promise<void> {
    const { input, output } = params;
    const data = input.data;
    const { informationGain, values } = getValuesFrequency(data);
    output.informationGain = informationGain;
    output.values = values;

    output.type = getType(input.name, values, data);
}

function getType(name: string, values: any, data: any): string {
    // if this is just a column of nulls, get rid of it
    if (values.length === 1 && values[0][0] === "null") {
        return "null";
    }

    // if all values are unique
    // if there are no nulls
    // if there are no spaces (could also be a description)
    // if between certain length
    if (
        values.length === data.length &&
        values[0][0] !== "null" &&
        matchesRegex(data, NO_SPACES) &&
        matchesRegex(data, OF_ID_LENGTH)
    ) {
        return "id";
    }

    if (name.match(/(date|time)/gi) && isDateTime(data)) {
        return "dateTime";
    }

    if (matchesRegex(data, NUMBER_FORMAT)) {
        return "number";
    }

    return "string";
}

function isDateTime(data: any) {
    data = data.filter((item: string) => item !== null);
    if (data.length === 0) {
        return false;
    }
    const valid = data
        .map((item: string) => moment(item, DATE_TIME_FORMATS, true).isValid())
        .filter((i: boolean) => i);
    return valid.length > data.length / 4;
}
