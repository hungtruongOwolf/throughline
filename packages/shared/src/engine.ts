import { z } from "zod";
import { Mobility, NodeId } from "./common";

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
