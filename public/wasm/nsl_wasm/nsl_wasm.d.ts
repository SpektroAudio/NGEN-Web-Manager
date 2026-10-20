/* tslint:disable */
/* eslint-disable */

export function command_description(cmd_json: string): string | undefined;

/**
 * Maximum value per destination type
 */
export function data_source_dest_max(type_name: string): number | undefined;

export function data_source_max(type_name: string, kind: string): number | undefined;

export function data_source_text(ds_json: string): string | undefined;

export function decode(bytes: Uint8Array): string | undefined;

export function encode(commands_json: string): Uint8Array | undefined;

/**
 * Validates a script and returns a JSON result
 */
export function validate(commands_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly command_description: (a: number, b: number) => [number, number];
    readonly data_source_dest_max: (a: number, b: number) => number;
    readonly data_source_max: (a: number, b: number, c: number, d: number) => number;
    readonly data_source_text: (a: number, b: number) => [number, number];
    readonly decode: (a: number, b: number) => [number, number];
    readonly encode: (a: number, b: number) => [number, number];
    readonly validate: (a: number, b: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
