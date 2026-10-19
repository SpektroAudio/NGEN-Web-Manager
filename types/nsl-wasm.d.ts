/// Types for the WASM module (public/wasm/nsl_wasm).
declare module "/wasm/nsl_wasm/nsl_wasm.js" {
  export default function init(input?: unknown): Promise<void>;
  export function decode(bytes: Uint8Array | number[]): string | undefined;
  export function encode(commands_json: string): Uint8Array | undefined;
  export function validate(commands_json: string): string;
  export function command_description(cmd_json: string): string | undefined;
  export function data_source_text(ds_json: string): string | undefined;
  export function data_source_max(type: string, kind: string): number | undefined;
  export function data_source_dest_max(type: string): number | undefined;
}
