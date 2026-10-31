import init, * as raw from "../pkg-web/throughline_engine.js";
import { wrapEngine, type Engine } from "./core";

export * from "./core";

let loading: Promise<Engine> | undefined;

/**
 * Loads the web wasm-pack build once. The .wasm is served from apps/web/public by
 * `pnpm build:engine`, so no framework-specific WASM loader is involved (spec 7.1).
 */
export function loadEngine(wasmUrl = "/engine_bg.wasm"): Promise<Engine> {
  loading ??= init({ module_or_path: wasmUrl }).then(() => wrapEngine(raw));
  return loading;
}
