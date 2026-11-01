/* tslint:disable */
/* eslint-disable */

export function campusVersion(): string;

export function estimateWait(request_json: string): string;

export function fuseQueue(request_json: string): string;

export function planItinerary(request_json: string): string;

export function replanItinerary(request_json: string): string;

export function schedule(request_json: string): string;

export function simulate(request_json: string): string;

/**
 * Crate version, so the proof panel can say "engine: rust-wasm 0.x".
 */
export function version(): string;

export function walkingMatrix(request_json: string): string;

export function walkingRoute(request_json: string): string;

export function whatIf(request_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly campusVersion: () => [number, number];
    readonly estimateWait: (a: number, b: number) => [number, number];
    readonly fuseQueue: (a: number, b: number) => [number, number];
    readonly planItinerary: (a: number, b: number) => [number, number];
    readonly replanItinerary: (a: number, b: number) => [number, number];
    readonly schedule: (a: number, b: number) => [number, number];
    readonly simulate: (a: number, b: number) => [number, number];
    readonly version: () => [number, number];
    readonly walkingMatrix: (a: number, b: number) => [number, number];
    readonly walkingRoute: (a: number, b: number) => [number, number];
    readonly whatIf: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
