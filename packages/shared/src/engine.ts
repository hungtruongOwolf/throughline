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

export const SimPatient = z.object({
  id: z.string(),
  arrive: SimTime,
  entrance: NodeId.optional(),
  mobility: Mobility,
  stops: z.array(z.object({ station_id: StationId, node_id: NodeId.optional() })),
});
export type SimPatient = z.infer<typeof SimPatient>;

export const OpsActionLite = z.object({
  id: z.string(),
  kind: z.enum(["open_server", "divert", "call_volunteer", "close_station"]),
  station_id: StationId,
  at: SimTime,
  count: z.number().int().positive().optional(),
  to_station: StationId.optional(),
});
export type OpsActionLite = z.infer<typeof OpsActionLite>;

export const SimRequest = z.object({
  seed: z.number().int().nonnegative(),
  start: SimTime,
  end: SimTime,
  patients: z.array(SimPatient),
  disruptions: z
    .array(
      z.object({
        station_id: StationId,
        from: SimTime,
        to: SimTime,
        servers_down: z.number().int().positive(),
      }),
    )
    .optional(),
  actions: z.array(OpsActionLite).optional(),
  snapshot_every_min: z.number().nonnegative().optional(),
});
export type SimRequest = z.infer<typeof SimRequest>;

export const SimResult = z.object({
  snapshots: z.array(
    z.object({
      at: SimTime,
      station_id: StationId,
      count: z.number().int().nonnegative(),
      open_servers: z.number().int().nonnegative(),
      est_wait_min: z.number().nonnegative(),
    }),
  ),
  per_patient: z.array(
    z.object({
      id: z.string(),
      minutes_on_site: z.number().nonnegative(),
      walking_seconds: z.number().nonnegative(),
      wait_minutes: z.number().nonnegative(),
      finished: z.boolean(),
    }),
  ),
  kpis: z.object({
    patients: z.number().int(),
    finished: z.number().int(),
    mean_minutes_on_site: z.number(),
    p90_minutes_on_site: z.number(),
    stations: z.array(
      z.object({
        station_id: StationId,
        served: z.number().int(),
        mean_wait_min: z.number(),
        p90_wait_min: z.number(),
      }),
    ),
  }),
});
export type SimResult = z.infer<typeof SimResult>;

export const WhatIfRequest = SimRequest.extend({
  candidates: z.array(OpsActionLite).min(1),
  replicates: z.number().int().min(1).max(200),
  horizon_min: z.number().positive(),
});
export type WhatIfRequest = z.infer<typeof WhatIfRequest>;

export const WhatIfResult = z.object({
  baseline: z.array(
    z.object({ station_id: StationId, mean_wait_min: z.number(), p90_wait_min: z.number() }),
  ),
  per_action: z.array(
    z.object({
      action_id: z.string(),
      station_id: StationId,
      mean_wait_min: z.number(),
      p90_wait_min: z.number(),
      delta_min: z.number(),
      affected_journeys: z.number().int(),
    }),
  ),
});
export type WhatIfResult = z.infer<typeof WhatIfResult>;
