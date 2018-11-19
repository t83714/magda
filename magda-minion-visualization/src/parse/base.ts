import { ProcessOptions } from "../process/base";

export interface ParseOptions {
    data: Buffer;
    mime: string;
    format: string;
    uri: string;
}

export interface ParsedData extends ProcessOptions {}
