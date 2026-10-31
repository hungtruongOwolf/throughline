import { z } from "zod";

/** Every aggregate and event carries this flag (spec 0, rule 2). */
export const Synthetic = z.literal(true);

/** Sim-clock timestamps always carry an offset, e.g. 2026-11-17T09:12:00-06:00. */
export const IsoTime = z.iso.datetime({ offset: true });
export const IsoDate = z.iso.date();

export const Id = z.string().min(1);
export const NodeId = z
  .string()
  .regex(/^[a-z0-9]+\.[A-Za-z0-9_]+$/, "node ids look like mp1.lobby");
export const StationId = z.enum([
  "registration",
  "lab_draw",
  "imaging_ct",
  "imaging_xray",
  "vitals",
  "clinic_2a",
  "clinic_2b",
  "infusion",
  "pharmacy",
  "financial",
]);
export type StationId = z.infer<typeof StationId>;

export const Language = z.enum(["en", "es"]);
export type Language = z.infer<typeof Language>;

export const Mobility = z.enum(["walking", "wheelchair"]);
export type Mobility = z.infer<typeof Mobility>;
