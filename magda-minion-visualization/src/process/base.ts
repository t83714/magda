export interface ProcessOptions {
    sheets: Array<Sheet>;
    format: string;
}

export interface Sheet {
    name: string;
    columns: Array<Column>;
}

export interface Column {
    name: string;
    data: ColumnVector;
}

export type ColumnVector = Array<any>;

export interface ProcessedData {
    format: ProcessedFormat;
    sheets: Array<ProcessedSheet>;
}

export interface ProcessedFormat {
    name: string;
    wellFormed: boolean;
}

export interface ProcessedSheet {
    name: string;
    fields?: Array<ProcessedField>;
    length?: number;
    sample?: any[];
}

export interface ProcessedField {
    name: string;
    values?: any;
    type?: string;
    informationGain?: number;
    nullCount?: number;
    subType?: string;
    statistics?: any;
    keywords?: any;
    lengthStatistics?: any;
}

export interface ProcessColumnIO {
    input: Column;
    output: ProcessedField;
}

export interface ProcessSheetIO {
    input: Sheet;
    output: ProcessedSheet;
}
