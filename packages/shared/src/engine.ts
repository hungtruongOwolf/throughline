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

const SimTime = z.iso.datetime({ offset: true });

export const StopReq = z.object({
  order_id: z.string().min(1),
  station_id: StationId,
  duration_min: z.number().positive(),
  node_id: NodeId.optional(),
  must_be_first: z.boolean().optional(),
  fasting: z.boolean().optional(),
  not_before: SimTime.optional(),
  status: z.enum(["pending", "in_service", "done"]).optional(),
});
export type StopReq = z.infer<typeof StopReq>;

export const QueueLite = z.object({
  station_id: StationId,
  count: z.number().nonnegative(),
  open_servers: z.number().int().nonnegative().optional(),
});

export const Constraint = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("before"),
    a: z.string(),
    b: z.string(),
    min_gap_min: z.number().nonnegative().optional(),
  }),
  z.object({
    kind: z.literal("after_event"),
    order: z.string(),
    event: z.enum(["result_ready", "provider_signoff"]),
    lead_min: z.number().nonnegative(),
    after_order: z.string().optional(),
    ready_at: SimTime.optional(),
  }),
]);
export type Constraint = z.infer<typeof Constraint>;

export const ItineraryRequest = z.object({
  now: SimTime,
  location: NodeId,
  mobility: Mobility,
  stops: z.array(StopReq).min(1).max(8),
  queues: z.array(QueueLite).optional(),
  constraints: z.array(Constraint).optional(),
});
export type ItineraryRequest = z.infer<typeof ItineraryRequest>;

export const PlannedStop = z.object({
  order_id: z.string(),
  station_id: StationId,
  node_id: NodeId,
  eta_arrive: SimTime,
  eta_start: SimTime,
  eta_end: SimTime,
  people_ahead: z.number().int().nonnegative(),
  est_wait_min: z.number().nonnegative(),
  walk_seconds: z.number().nonnegative(),
});
export type PlannedStop = z.infer<typeof PlannedStop>;

export const ItineraryPlan = z.object({
  stops: z.array(PlannedStop),
  total_minutes: z.number().nonnegative(),
  walking_seconds: z.number().nonnegative(),
  reason: z.array(z.string()),
});
export type ItineraryPlan = z.infer<typeof ItineraryPlan>;

export const ReplanRequest = ItineraryRequest.extend({ current: ItineraryPlan });
export type ReplanRequest = z.infer<typeof ReplanRequest>;

export const StopDiff = z.object({
  order_id: z.string(),
  change: z.enum(["moved_earlier", "moved_later", "swapped_station"]),
  from: z.string(),
  to: z.string(),
});
export const ReplanResult = z.object({
  plan: ItineraryPlan,
  diff: z.array(StopDiff),
  reason: z.array(z.string()),
});
export type ReplanResult = z.infer<typeof ReplanResult>;
