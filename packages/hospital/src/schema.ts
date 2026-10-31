import { z } from "zod";
import { NodeId, StationId } from "@throughline/shared";

export const Zone = z.enum(["blue", "gold", "green", "rose", "violet"]);
export type Zone = z.infer<typeof Zone>;

export const NodeKind = z.enum([
  "entrance",
  "lobby",
  "station",
  "amenity",
  "elevator",
  "junction",
  "waiting",
  "door",
  "bridge",
  "parking",
  "walkway",
  "staff",
]);

export const CampusNode = z.object({
  id: NodeId,
  building: z.enum(["MP", "G", "GL", "CC"]),
  /** Floor index; meters plus floor keep the model 3D-ready (spec 3.5). */
  floor: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  kind: NodeKind,
  zone: Zone,
  label: z.string().min(1),
});
export type CampusNode = z.infer<typeof CampusNode>;

export const EdgeKind = z.enum(["walk", "elevator", "stairs"]);
export const CampusEdge = z.object({
  a: NodeId,
  b: NodeId,
  seconds: z.number().positive(),
  kind: EdgeKind,
});
export type CampusEdge = z.infer<typeof CampusEdge>;

const HHMM = z.string().regex(/^\d\d:\d\d$/);
const Weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export const Station = z.object({
  id: StationId,
  name: z.string(),
  nodes: z.array(NodeId).min(1),
  waiting_node: NodeId.nullable(),
  servers: z.number().int().positive(),
  service_min: z.object({ mean: z.number().positive(), sd: z.number().nonnegative() }),
  hours: z.object({
    days: z.array(Weekday),
    open: HHMM,
    close: HHMM,
    saturday: z.object({ open: HHMM, close: HHMM }).optional(),
  }),
  result_turnaround_min: z.record(z.string(), z.number().positive()).optional(),
  lead_after_signoff_min: z.number().positive().optional(),
  notes: z.string().optional(),
});
export type Station = z.infer<typeof Station>;

export const WaitingArea = z.object({
  node_id: NodeId,
  seats: z.number().int().positive(),
  camera_id: z.string(),
});

export const SignArrow = z.object({
  target_node_id: NodeId,
  direction: z.enum(["left", "right", "ahead", "back", "up", "down"]),
});

export const Sign = z.object({
  sign_id: z.string(),
  node_id: NodeId,
  lines: z.array(z.string().min(1)).min(1),
  arrows: z.array(SignArrow),
  zone: Zone,
});
export type Sign = z.infer<typeof Sign>;

export const Campus = z.object({
  version: z.string(),
  synthetic: z.literal(true),
  name: z.string(),
  note: z.string(),
  walking_speed_mps: z.number().positive(),
  elevator_seconds: z.number().positive(),
  stairs_seconds_per_floor: z.number().positive(),
  nodes: z.array(CampusNode),
  edges: z.array(CampusEdge),
  stations: z.array(Station),
  waiting_areas: z.array(WaitingArea),
  /** People waiting at the top of each hour, index 0..23. Assumptions, not measurements. */
  queue_baselines: z.record(StationId, z.array(z.number().nonnegative()).length(24)),
  signs: z.array(Sign),
});
export type Campus = z.infer<typeof Campus>;
