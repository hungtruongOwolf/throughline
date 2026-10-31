import { z } from "zod";
import { StationId } from "./common";

/** API contracts between the runtime and the web app (spec 4.2: shared is the single source). */

export const BoardRow = z.object({
  key: z.string(),
  initials: z.string(),
  ticket: z.number().int(),
  /** Arrival for people walking here, otherwise the expected start. */
  eta: z.string(),
  status: z.enum(["walking", "waiting", "in_service"]),
  from: z.string().optional(),
  room: z.string().optional(),
  simulated: z.boolean(),
  journey_id: z.string().optional(),
  order_id: z.string().optional(),
});
export type BoardRow = z.infer<typeof BoardRow>;

export const BoardTask = z.object({
  key: z.string(),
  kind: z.enum(["lost", "handoff", "task"]),
  ticket: z.number().int(),
  initials: z.string(),
  journey_id: z.string(),
  order_id: z.string().optional(),
  review_id: z.string().optional(),
  minutes: z.number().optional(),
  reason: z.string(),
});
export type BoardTask = z.infer<typeof BoardTask>;

export const BoardView = z.object({
  station_id: StationId,
  name: z.string(),
  floor: z.number().int(),
  zone: z.enum(["blue", "gold", "green", "rose", "violet"]),
  now: z.string(),
  arriving: z.array(BoardRow),
  waiting_now: z.number().int().nonnegative(),
  series: z.array(z.object({ at: z.string(), count: z.number().nonnegative() })),
  /** Where the counts come from; the board always says so (spec 0, rule 5). */
  source: z.enum(["sim", "sensed", "tickets"]),
  tasks: z.array(BoardTask),
});
export type BoardView = z.infer<typeof BoardView>;

export const OpsStation = z.object({
  id: StationId,
  name: z.string(),
  node_id: z.string(),
  waiting_node: z.string().nullable(),
  count: z.number().nonnegative(),
  open_servers: z.number().int().nonnegative(),
  servers: z.number().int().positive(),
  est_wait_min: z.number().nonnegative(),
  source: z.enum(["sim", "sam", "tickets", "fused"]),
  series: z.array(z.number().nonnegative()),
});
export type OpsStation = z.infer<typeof OpsStation>;

export const OpsJourney = z.object({
  id: z.string(),
  initials: z.string(),
  ticket: z.number().int(),
  current: z.string().optional(),
  minutes_behind: z.number(),
  mobility: z.enum(["walking", "wheelchair"]),
  last_node: z.string(),
  stops: z.array(z.object({ station_id: StationId, node_id: z.string(), status: z.string() })),
});
export type OpsJourney = z.infer<typeof OpsJourney>;

export const OpsProposal = z.object({
  review_id: z.string(),
  status: z.enum(["pending", "resolved", "rejected"]),
  resolved_by: z.string().optional(),
  action: z.object({
    id: z.string(),
    kind: z.string(),
    title: z.string(),
    predicted_effect: z.object({
      station_id: StationId,
      wait_before_min: z.number(),
      wait_after_min: z.number(),
      affected_journeys: z.number().int(),
    }),
    evidence: z.object({
      run_id: z.string(),
      seed: z.number().int(),
      replicates: z.number().int(),
      horizon_min: z.number().int(),
    }),
  }),
});
export type OpsProposal = z.infer<typeof OpsProposal>;

export const OpsOverview = z.object({
  now: z.string(),
  speed: z.number(),
  running: z.boolean(),
  in_house: z.number().int(),
  stations: z.array(OpsStation),
  journeys: z.array(OpsJourney),
  proposals: z.array(OpsProposal),
  /** Stretches of the simulated day where a station's wait exceeded 15 minutes. */
  bottlenecks: z.array(z.object({ station_id: StationId, from: z.string(), to: z.string() })),
});
export type OpsOverview = z.infer<typeof OpsOverview>;
