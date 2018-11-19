import { ParseOptions, ParsedData } from "./base";
export { ParseOptions, ParsedData } from "./base";

export function canParse(format: string): boolean {
    return !!findParser(format);
}

export async function doParse(parse: ParseOptions): Promise<ParsedData> {
    return findParser(parse.format)(parse);
}

function findParser(format: string): any {
    const found = parsers.filter(parser => parser.canParse(format));
    if (found.length) {
        return found[0].doParse;
    } else {
        return false;
    }
}

const parsers: any[] = [require("./parse-xlsx")];
