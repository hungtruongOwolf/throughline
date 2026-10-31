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
