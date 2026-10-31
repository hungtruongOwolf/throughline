import { z } from "zod";
import { Id, IsoTime, StationId } from "./common";
import { AgentName, Capability } from "./capabilities";

export const QueueState = z.object({
  station_id: StationId,
  at: IsoTime,
  count_sensed: z.number().int().nonnegative().optional(),
  count_ticketed: z.number().int().nonnegative().optional(),
  count_fused: z.number().nonnegative(),
  est_wait_min: z.number().nonnegative(),
  source: z.enum(["sam", "tickets", "fused", "sim"]),
});
export type QueueState = z.infer<typeof QueueState>;

export const SimRunRef = z.object({
  run_id: Id,
  seed: z.number().int(),
  replicates: z.number().int().positive(),
  horizon_min: z.number().int().positive(),
});

export const OpsActionKind = z.enum(["open_server", "divert", "call_volunteer", "close_station"]);

export const OpsAction = z.object({
  id: Id,
  kind: OpsActionKind,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  title: z.string(),
  predicted_effect: z.object({
    station_id: StationId,
    wait_before_min: z.number().nonnegative(),
    wait_after_min: z.number().nonnegative(),
    affected_journeys: z.number().int().nonnegative(),
  }),
  evidence: SimRunRef,
  status: z.enum(["proposed", "approved", "rejected", "applied"]),
});
export type OpsAction = z.infer<typeof OpsAction>;

export const HumanReview = z.object({
  id: Id,
  kind: z.enum(["approval", "handoff", "task"]),
  journey_id: Id.optional(),
  station_id: StationId.optional(),
  reason: z.string(),
  capability: Capability,
  agent: AgentName,
  status: z.enum(["pending", "resolved", "rejected"]),
  /** The triggering event, parked verbatim for replay (spec 4.3 step 5). */
  pending_event: z.unknown().optional(),
  resolved_by: z.string().optional(),
  resolved_at: IsoTime.optional(),
  note: z.string().optional(),
});
export type HumanReview = z.infer<typeof HumanReview>;
