import { ParseOptions } from "../parse/index";

export interface FetchOptions {
    uri: string;
    format: string;
    limit: string;
}

export interface FetchedData extends ParseOptions {
    success: boolean;
    limit: number;
}
