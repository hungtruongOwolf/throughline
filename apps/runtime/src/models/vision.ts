import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { z } from "zod";
import type { ModelCallRecord } from "@throughline/shared";
import { PREAMBLE } from "../safety/preamble";
import type { ModelCache } from "./cache";
import type { ModelConfig } from "./config";

export const SignReading = z.object({
  /** The sign's large heading lines, top to bottom, exactly as printed. */
  heading: z.array(z.string()),
  /** The smaller direction rows (arrow + place), if any. */
  directions: z.array(z.string()),
});
export type SignReading = z.infer<typeof SignReading>;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["heading", "directions"],
  properties: {
    heading: { type: "array", items: { type: "string" } },
    directions: { type: "array", items: { type: "string" } },
  },
};

/**
 * Reads a hospital sign from a patient's photo with Spark vision (spec V5). The model only
 * transcribes text; matching it to a place is done in code by the localizer, never by the model.
 */
export async function readSign(
  deps: {
    client: OpenAI;
    config: ModelConfig;
    cache: ModelCache;
    record: (r: ModelCallRecord) => void;
    now: () => string;
  },
  photo: { bytes: Buffer; mime: string },
): Promise<{ reading: SignReading; replayed: boolean }> {
  const started = performance.now();
  const body = {
    model: deps.config.sparkModel,
    input: [
      {
        role: "system" as const,
        content: `${PREAMBLE} Transcribe the wayfinding sign in the photo. Put the large heading lines in "heading" and the smaller arrow rows in "directions". Copy the words exactly; if there is no readable sign, return empty arrays.`,
      },
      {
        role: "user" as const,
        content: [
          { type: "input_text" as const, text: "Read this sign." },
          {
            type: "input_image" as const,
            image_url: `data:${photo.mime};base64,${photo.bytes.toString("base64")}`,
            detail: "auto" as const,
          },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "sign_reading", schema: SCHEMA, strict: true } },
    reasoning: { effort: "low" },
    max_output_tokens: 2000,
  };
  let success = true;
  let wasReplayed: boolean | undefined;
  try {
    // One retry: an empty or invalid output (e.g. reasoning used the token budget) is dropped
    // from the cache so it is never replayed, then asked again.
    for (let attempt = 0; ; attempt++) {
      const { value, replayed } = await deps.cache.call<{ text: string }>(
        "meta",
        deps.config.sparkModel,
        body,
        async () => {
          const r = await deps.client.responses.create(
            body as unknown as OpenAI.Responses.ResponseCreateParamsNonStreaming,
          );
          return { text: r.output_text };
        },
      );
      wasReplayed = replayed;
      // Strict mode does not guarantee conformance (spec 6.1): validate in code.
      const parsed = (() => {
        try {
          return SignReading.safeParse(JSON.parse(value.text));
        } catch {
          return undefined;
        }
      })();
      if (parsed?.success) return { reading: parsed.data, replayed };
      deps.cache.forget("meta", deps.config.sparkModel, body);
      if (attempt >= 1) throw new Error("sign reading was not valid JSON twice");
    }
  } catch (e) {
    success = false;
    throw e;
  } finally {
    deps.record({
      id: randomUUID(),
      at: deps.now(),
      tier: "cloud",
      provider: "meta",
      model: deps.config.sparkModel,
      capability: "patient.locate",
      tools_invoked: [],
      latency_ms: performance.now() - started,
      success,
      used_fallback: false,
      replayed: wasReplayed ?? false,
    });
  }
}
