import { ProcessColumnIO } from "./base";

export async function doProcessColumn(params: ProcessColumnIO): Promise<void> {
    const { output } = params;
    if (output.type === "null") {
        return;
    }

    if (output.values[0][0] === "null") {
        output.nullCount = output.values[0][1];
        output.values.splice(0, 1);
    }
}
