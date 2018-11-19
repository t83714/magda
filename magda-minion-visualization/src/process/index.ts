import {
    Sheet,
    Column,
    ProcessOptions,
    ProcessedData,
    ProcessedSheet,
    ProcessedField
} from "./base";

export async function doProcess(
    options: ProcessOptions
): Promise<ProcessedData> {
    const sheets: Array<ProcessedSheet> = await Promise.all(
        options.sheets.map(doProcessSheet)
    );
    return {
        format: {
            name: options.format,
            wellFormed: true
        },
        sheets
    };
}

async function doProcessSheet(sheet: Sheet): Promise<ProcessedSheet> {
    const sheetOutput: ProcessedSheet = {
        name: sheet.name,
        length: sheet.columns[0].data.length,
        fields: []
    };
    for (let column of sheet.columns) {
        const field = await doProcessColumn(column);
        if (field) {
            sheetOutput.fields.push(field);
        }
    }
    for (const processor of processors) {
        if (processor.doProcessSheet) {
            await processor.doProcessSheet({
                input: sheet,
                output: sheetOutput
            });
        }
    }
    return sheetOutput;
}

async function doProcessColumn(input: Column): Promise<ProcessedField> {
    const output = {
        name: input.name
    };
    for (const processor of processors) {
        if (processor.doProcessColumn) {
            await processor.doProcessColumn({
                input,
                output
            });
        }
    }
    return output;
}

const processors = [
    require("./process-00-type"),
    require("./process-10-null"),
    require("./process-11-number"),
    require("./process-11-string"),
    require("./process-90-sample"),
    require("./process-99-values")
];
