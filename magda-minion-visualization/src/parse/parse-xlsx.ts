import { ParseOptions, ParsedData } from "./base";
import { Sheet, Column } from "../process/base";

const XLSX = require("xlsx");
const escape = require("escape-html");

const formats: RegExp[] = [
    /xls[bx]?/i,
    /q[pb]./i,
    /wk\d./i,
    /uws/i,
    /eth/i,
    /prn/i,
    /dif/i,
    /dbf/i,
    /csv/i,
    /f?ods/i
];

export function canParse(format: string): boolean {
    return formats.filter(regex => regex.test(format)).length > 0;
}

export async function doParse(parse: ParseOptions): Promise<ParsedData> {
    const book = XLSX.read(parse.data, {
        cellFormula: false,
        cellHTML: false
    });
    let sheets: Sheet[] = [];
    for (const [name, sheet] of Object.entries(book.Sheets)) {
        let parsed = doParseSheet(name, sheet);
        if (parsed) {
            sheets.push(parsed);
        }
    }
    if (sheets.length > 0) {
        return {
            format: parse.format,
            sheets
        };
    }
    return null;
}

function doParseSheet(name: string, sheet: any): Sheet {
    let columns: any[] = readColumns(sheet);

    if (!columns.length || !columns[0].length) {
        return null;
    }

    // if there are more columns than rows, it is either
    // a very small dataset or it is likely to be a transposed daaset
    // TODO: see if additional checks can be added here for transposing
    if (columns.length > columns[0].length) {
        columns = transpose(columns);
    }

    let parsed = columns.map(doParseColumn).filter(i => i);

    if (columns.length > 0) {
        return {
            name,
            columns: parsed
        };
    }

    return null;
}

function doParseColumn(data: any[]): Column {
    const name = data.splice(0, 1)[0];
    return { name, data };
}

function transpose(columns: any[]): any[] {
    const rows = [];

    for (let rowIndex = 0; rowIndex < columns[0].length; rowIndex++) {
        rows[rowIndex] = [];
    }

    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
        for (let rowIndex = 0; rowIndex < columns[0].length; rowIndex++) {
            rows[rowIndex][columnIndex] = columns[columnIndex][rowIndex];
        }
    }
    return rows;
}

function readColumns(sheet: any): any[] {
    const columns: any[] = [];

    const range = XLSX.utils.decode_range(sheet["!ref"]);

    for (let row = range.s.r; row < range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cell = XLSX.utils.encode_cell({
                r: row,
                c: col
            });
            const rowIndex = row - range.s.r;
            const colIndex = col - range.s.c;
            if (sheet[cell] !== undefined) {
                let val = sheet[cell].w || sheet[cell].v;
                if (val) {
                    val = escape(val).trim();
                    if (val !== "") {
                        while (columns.length <= colIndex) {
                            columns.push([]);
                        }
                        for (let column of columns) {
                            while (column.length <= rowIndex) {
                                column.push(null);
                            }
                        }
                        columns[colIndex][rowIndex] = val;
                    }
                }
            }
        }
    }
    return columns;
}
