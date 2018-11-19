import { ProcessColumnIO } from "./base";

export async function doProcessColumn(params: ProcessColumnIO): Promise<void> {
    const { output } = params;

    output.values = undefined;
}
