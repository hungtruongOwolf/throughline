import type { z } from "zod";
import {
  EngineErrorEnvelope,
  FuseRequest,
  FuseResult,
  ItineraryPlan,
  ItineraryRequest,
  ReplanRequest,
  ReplanResult,
  WaitEstimate,
  WaitRequest,
  WalkingMatrix,
  WalkingMatrixRequest,
  WalkingRoute,
  WalkingRouteRequest,
} from "@throughline/shared";

/** The raw wasm-bindgen exports: JSON strings in, JSON strings out. */
export interface RawEngine {
  version(): string;
  campusVersion(): string;
  walkingRoute(requestJson: string): string;
  walkingMatrix(requestJson: string): string;
  estimateWait(requestJson: string): string;
  fuseQueue(requestJson: string): string;
  planItinerary(requestJson: string): string;
  replanItinerary(requestJson: string): string;
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
  walkingMatrix(req: WalkingMatrixRequest): WalkingMatrix;
  estimateWait(req: WaitRequest): WaitEstimate;
  fuseQueue(req: FuseRequest): FuseResult;
  planItinerary(req: ItineraryRequest): ItineraryPlan;
  replanItinerary(req: ReplanRequest): ReplanResult;
}

/** Function names usable by golden fixtures. */
export type EngineFunction =
  | "walkingRoute"
  | "walkingMatrix"
  | "estimateWait"
  | "fuseQueue"
  | "planItinerary"
  | "replanItinerary";

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
    walkingRoute: (req) => call((j) => raw.walkingRoute(j), WalkingRouteRequest, WalkingRoute, req),
    walkingMatrix: (req) =>
      call((j) => raw.walkingMatrix(j), WalkingMatrixRequest, WalkingMatrix, req),
    estimateWait: (req) => call((j) => raw.estimateWait(j), WaitRequest, WaitEstimate, req),
    fuseQueue: (req) => call((j) => raw.fuseQueue(j), FuseRequest, FuseResult, req),
    planItinerary: (req) => call((j) => raw.planItinerary(j), ItineraryRequest, ItineraryPlan, req),
    replanItinerary: (req) => call((j) => raw.replanItinerary(j), ReplanRequest, ReplanResult, req),
  };
}
