import type { z } from "zod";
import { EngineErrorEnvelope, WalkingRoute, WalkingRouteRequest } from "@throughline/shared";

/** The raw wasm-bindgen exports: JSON strings in, JSON strings out. */
export interface RawEngine {
  version(): string;
  campusVersion(): string;
  walkingRoute(requestJson: string): string;
}

export class EngineCallError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
  }
}

/** Engine interface (spec 7.2), identical for the Rust build and the TS fallback. */
export interface Engine {
  readonly implementation: "rust-wasm" | "ts";
  version(): string;
  campusVersion(): string;
  walkingRoute(req: WalkingRouteRequest): WalkingRoute;
}

function call<Req, Res>(
  fn: (json: string) => string,
  reqSchema: z.ZodType<Req>,
  resSchema: z.ZodType<Res>,
  req: Req,
): Res {
  const raw: unknown = JSON.parse(fn(JSON.stringify(reqSchema.parse(req))));
  const err = EngineErrorEnvelope.safeParse(raw);
  if (err.success) throw new EngineCallError(err.data.error.code, err.data.error.message);
  return resSchema.parse(raw);
}

/** Wraps the raw exports with zod validation on the way in and out. */
export function wrapEngine(raw: RawEngine): Engine {
  return {
    implementation: "rust-wasm",
    version: () => raw.version(),
    campusVersion: () => raw.campusVersion(),
    walkingRoute: (req) =>
      call((json) => raw.walkingRoute(json), WalkingRouteRequest, WalkingRoute, req),
  };
}
