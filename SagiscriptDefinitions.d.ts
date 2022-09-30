declare global {
    const HWGWOperation: HWGWOperation;
    const HWGWHeaders: HWGWHeaders;
}

// Executable objects for ns.exec()

export interface Executable<Data> {
    pid: number;
    host: string;
    script: string;
    threads: number;
    args: any[];
    data?: Data;
}

// HWGW data structures

export interface HWGWOperation extends Executable<HWGW> {

}

export interface HWGW {
    start: number;
    end: number;
    ram: number;
    money: number;
    security: number;
    growth: number;
}

export interface EstimatedTarget {
    name: string;
    start: number;
    money: {
        available: number;
        max: number;
        delta: number;
    };
    security: {
        level: number;
        min: number;
        delta: number;
    };
    hackable: boolean;
    optimized: number;
    operations: HWGWOperation[];
    productionPerMillisecond: number;
}

export interface AvailableHost {
    name: string;
    root: boolean;
    ram: {
        max: number;
        used: number;
        available: number;
    };
}

export interface HWGWBatch {
    target: EstimatedTarget;
    operations: HWGWOperation[];
    executed: HWGWOperation[];
}

// Print utility

export interface Header<Row, Column> {
    label: string;

    align?: Alignment;
    signed?: boolean;

    skip?(row: Row): boolean;
    format?(formmated: string, value: Column, row: Row): string;
    reduce?(current: Column, value: Column, row: Row): Column;
}

export interface Padding {
    length: number;
    align: Alignment;
    filler: string;
}

export type Alignment = 'start'|'end';

export type HWGWHeaders = { [Prop in keyof HWGWOperation]: Header<HWGWOperation, HWGWOperation[Prop]> };