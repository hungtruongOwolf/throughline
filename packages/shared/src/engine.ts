import { z } from "zod";
import { Mobility, NodeId, StationId } from "./common";

/**
 * Request/response shapes of the Engine interface (spec 7.2). The Rust crate mirrors them in
 * packages/engine/src/types.rs; the wrapper validates every WASM output against these.
 */

export const EngineErrorEnvelope = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export const WalkingRouteRequest = z.object({ from: NodeId, to: NodeId, mobility: Mobility });
export type WalkingRouteRequest = z.infer<typeof WalkingRouteRequest>;

export const RouteStep = z.object({
  kind: z.enum(["walk", "elevator", "stairs"]),
  to_node_id: NodeId,
  to_label: z.string(),
  seconds: z.number().positive(),
  floor: z.number().int().optional(),
});
export type RouteStep = z.infer<typeof RouteStep>;

export const WalkingRoute = z.object({
  nodes: z.array(NodeId).min(1),
  seconds: z.number().nonnegative(),
  steps: z.array(RouteStep),
});
export type WalkingRoute = z.infer<typeof WalkingRoute>;

export const WalkingMatrixRequest = z.object({
  node_ids: z.array(NodeId).min(1),
  mobility: Mobility,
});
export type WalkingMatrixRequest = z.infer<typeof WalkingMatrixRequest>;
export const WalkingMatrix = z.object({
  node_ids: z.array(NodeId),
  seconds: z.array(z.array(z.number().nonnegative())),
});
export type WalkingMatrix = z.infer<typeof WalkingMatrix>;

export const WaitRequest = z.object({
  station_id: StationId,
  count: z.number().nonnegative(),
  open_servers: z.number().int().nonnegative().optional(),
  minutes_until_close: z.number().optional(),
});
export type WaitRequest = z.infer<typeof WaitRequest>;
export const WaitEstimate = z.object({
  est_wait_min: z.number().nonnegative(),
  open_servers: z.number().int().positive(),
});
export type WaitEstimate = z.infer<typeof WaitEstimate>;

export const FuseRequest = z.object({
  sensed: z.number().nonnegative().optional(),
  ticketed: z.number().nonnegative(),
  frame_age_min: z.number().nonnegative().optional(),
});
export type FuseRequest = z.infer<typeof FuseRequest>;
export const FuseResult = z.object({
  count_fused: z.number().nonnegative(),
  source: z.enum(["fused", "tickets"]),
});
export type FuseResult = z.infer<typeof FuseResult>;
