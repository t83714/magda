import { ProcessSheetIO } from "./base";

const COLUMNS_TO_SAMPLE = 15;
const ROWS_TO_SAMPLE = 300;

export async function doProcessSheet(params: ProcessSheetIO): Promise<void> {
    const { input, output } = params;
    const sample: any[] = [];

    const columns = output.fields
        .slice(0)
        .sort((a, b) => b.informationGain - a.informationGain)
        .map(col => col.name)
        .slice(0, COLUMNS_TO_SAMPLE);

    const indices = getSampleIndices(output.length, ROWS_TO_SAMPLE);

    for (const column of input.columns) {
        if (columns.indexOf(column.name) === -1) {
            continue;
        }
        let { name, data } = column;
        data = indices.map(i => data[i]);
        sample.push({ name, data });
    }

    output.sample = sample;
}

function getSampleIndices(length: number, toSample: number): number[] {
    const indices = [];
    const ratio = toSample / length;
    for (let x = 0; x < length; x++) {
        if (indices.length / (x + 1) < ratio) {
            indices.push(x);
        }
    }
    return indices;
}
