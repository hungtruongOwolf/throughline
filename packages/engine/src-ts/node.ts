import { createRequire } from "node:module";
import { wrapEngine, type Engine, type RawEngine } from "./core";

export * from "./core";

let engine: Engine | undefined;

/** Loads the nodejs wasm-pack build (synchronous instantiation). Run `pnpm build:engine` first. */
export function loadEngine(): Engine {
  if (!engine) {
    const require = createRequire(import.meta.url);
    const raw = require("../pkg-node/throughline_engine.js") as RawEngine;
    engine = wrapEngine(raw);
  }
  return engine;
}
