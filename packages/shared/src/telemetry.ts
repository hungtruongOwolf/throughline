import { z } from "zod";
import { Id, IsoTime } from "./common";
import { Capability } from "./capabilities";

export const ModelTier = z.enum(["cloud", "private", "engine", "none"]);
export const ModelProvider = z.enum([
  "meta",
  "modal",
  "baseten",
  "fireworks",
  "glimmer",
  "browser",
]);

/** One row per model call; message content is never stored here (spec 4.3). */
export const ModelCallRecord = z
  .object({
    id: Id,
    at: IsoTime,
    tier: ModelTier,
    provider: ModelProvider,
    model: z.string(),
    capability: Capability,
    journey_id: Id.optional(),
    tools_invoked: z.array(z.string()),
    required_tool: z.string().optional(),
    required_tool_valid: z.boolean().optional(),
    latency_ms: z.number().nonnegative(),
    tokens_in: z.number().int().nonnegative().optional(),
    tokens_out: z.number().int().nonnegative().optional(),
    success: z.boolean(),
    used_fallback: z.boolean(),
    replayed: z.boolean(),
  })
  .strict();
export type ModelCallRecord = z.infer<typeof ModelCallRecord>;

/**
 * One agent run: an agent handling one capability for one event. The product's agent views
 * (roster metrics, patient timelines, run detail) are built from these rows.
 */
export const AgentRun = z.object({
  id: Id,
  agent: z.string(),
  capability: Capability,
  journey_id: Id.optional(),
  station_id: z.string().optional(),
  trigger: z.object({ event_id: Id, type: z.string() }),
  at: IsoTime,
  duration_ms: z.number().nonnegative(),
  /** applied: done on its own; parked: waits for staff; handoff: sent to a nurse; blocked: message screened. */
  outcome: z.enum(["applied", "parked", "handoff", "blocked"]),
  /** The deterministic path ran (approved template / rule) instead of a model answer. */
  used_template: z.boolean(),
  summary: z.string(),
  emitted: z.array(z.object({ id: Id, type: z.string() })),
  model_call_ids: z.array(Id),
  review_id: Id.optional(),
  approved_by: z.string().optional(),
});
export type AgentRun = z.infer<typeof AgentRun>;
