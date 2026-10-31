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
