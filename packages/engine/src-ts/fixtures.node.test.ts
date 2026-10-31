import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { EngineCallError, type EngineFunction } from "./core";
import { loadEngine } from "./node";

interface Case {
  name: string;
  fn: EngineFunction;
  request: unknown;
  expected: unknown;
}

const engine = loadEngine();
const load = (file: string) =>
  (
    JSON.parse(readFileSync(new URL(`../fixtures/${file}`, import.meta.url), "utf8")) as {
      cases: Case[];
    }
  ).cases;

function run(fn: EngineFunction, request: unknown): unknown {
  try {
    return (engine[fn] as (r: unknown) => unknown)(request);
  } catch (e) {
    if (e instanceof EngineCallError)
      return { error: { code: e.code, message: e.message.slice(e.code.length + 2) } };
    // The wrapper validates requests before they reach WASM, so some bad inputs stop here.
    if (e instanceof ZodError) return { rejected_by_wrapper: true };
    throw e;
  }
}

describe.each(["routes.json", "waits.json"])(
  "golden fixtures %s through the wrapper (tests 17, 19)",
  (file) => {
    it.each(load(file).map((c) => [c.name, c] as const))("%s", (_, c) => {
      const first = run(c.fn, c.request);
      expect(JSON.stringify(run(c.fn, c.request))).toBe(JSON.stringify(first));
      if ((first as { rejected_by_wrapper?: boolean }).rejected_by_wrapper) {
        expect(c.expected).toHaveProperty("error");
      } else {
        expect(first).toEqual(c.expected);
      }
    });
  },
);
