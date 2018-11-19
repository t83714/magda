import { ProcessColumnIO } from "./base";
import { matchesRegex, getValuesFrequency, produceStatistics } from "./helpers";

const KEYWORDS_FORMAT = /^[\w\s;,#\-]+$/i;

export async function doProcessColumn(params: ProcessColumnIO): Promise<void> {
    const { input, output } = params;
    if (output.type !== "string") {
        return;
    }

    const { name, data } = input;

    output.subType = parseSubtype(name, output.values, data);

    if (output.subType === "keywords") {
        output.keywords = parseKeywords(data);
    }

    const lengths = data.filter(i => i !== null).map(i => i.length);
    output.lengthStatistics = produceStatistics(
        lengths,
        getValuesFrequency(lengths).values
    );
}

function parseSubtype(name: string, values: any, data: any): string {
    return matchesRegex(data, KEYWORDS_FORMAT) ? "keywords" : "text";
}

function parseKeywords(data: any): any {
    const keywords: any = {};

    for (const item of data) {
        if (item !== null) {
            for (const kw of item.split(/[;,#\-]+/gi)) {
                keywords[kw] = (keywords[kw] || 0) + 1;
            }
        }
    }

    return Object.entries(keywords);
}
