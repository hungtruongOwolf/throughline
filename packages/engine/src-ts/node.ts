import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { wrapEngine, type Engine, type RawEngine } from "./core";

export * from "./core";

const BINDING = "packages/engine/pkg-node/throughline_engine.js";

/**
 * Finds the nodejs wasm-pack build: next to this file in the repo, or by walking up from a
 * bundled copy (the runtime bundles this module into apps/runtime/dist).
 */
function bindingPath(): string {
  if (process.env.ENGINE_PKG_NODE) return process.env.ENGINE_PKG_NODE;
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    const candidate = join(dir, BINDING);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return join(dirname(fileURLToPath(import.meta.url)), "../pkg-node/throughline_engine.js");
}

let engine: Engine | undefined;

/** Loads the nodejs wasm-pack build (synchronous instantiation). Run `pnpm build:engine` first. */
export function loadEngine(): Engine {
  if (!engine) {
    const require = createRequire(import.meta.url);
    engine = wrapEngine(require(bindingPath()) as RawEngine);
  }
  return engine;
}
