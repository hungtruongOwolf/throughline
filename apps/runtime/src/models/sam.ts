import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import { parseImageStream, recordsOfKind } from "@meta-sam/parser";
import type { Capability, ModelCallRecord } from "@throughline/shared";
import type { ModelCache } from "./cache";
import type { ModelConfig } from "./config";

/** The only nouns SAM is ever prompted with (spec 11.1: counting, not identifying). */
export const SAM_NOUNS = ["person", "door", "elevator"] as const;
export type SamNoun = (typeof SAM_NOUNS)[number];

export interface SamBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  confidence?: number;
}

export interface SamCount {
  noun: SamNoun;
  count: number;
  boxes: SamBox[];
  replayed: boolean;
}

/**
 * Counts one noun in one frame with SAM 3.1 (spec 8.2). The frame is sent once and never
 * stored: only the count and the boxes come back, and only they are cached.
 */
export async function samCount(
  deps: {
    client: OpenAI;
    config: ModelConfig;
    cache: ModelCache;
    record: (r: ModelCallRecord) => void;
    now: () => string;
  },
  frame: { bytes: Buffer; mime: string },
  noun: SamNoun,
  capability: Capability = "queue.estimate",
): Promise<SamCount> {
  if (!SAM_NOUNS.includes(noun)) throw new Error(`SAM noun not allowed: ${String(noun)}`);
  const started = performance.now();
  const imageUrl = `data:${frame.mime};base64,${frame.bytes.toString("base64")}`;
  const body = {
    model: deps.config.samModel,
    stream: true as const,
    metadata: { mask_encoding: "one_bit", include_confidence: "true" },
    input: [
      {
        role: "user" as const,
        content: [
          { type: "input_text" as const, text: noun },
          { type: "input_image" as const, image_url: imageUrl, detail: "auto" as const },
        ],
      },
    ],
  };
  let success = true;
  let wasReplayed = false;
  try {
    const { value, replayed } = await deps.cache.call<{ boxes: SamBox[] }>(
      "meta",
      deps.config.samModel,
      body,
      async () => {
        const stream = await deps.client.responses.create(
          body as unknown as OpenAI.Responses.ResponseCreateParamsStreaming,
        );
        const result = await parseImageStream(stream as AsyncIterable<never>).finalResult;
        if (result.outcome.status !== "completed") {
          throw new Error(`SAM ended early: ${result.outcome.status}`);
        }
        return {
          boxes: recordsOfKind(result.records, "box").map((b) => ({
            left: b.left,
            top: b.top,
            right: b.right,
            bottom: b.bottom,
            ...(b.confidence === undefined ? {} : { confidence: b.confidence }),
          })),
        };
      },
    );
    wasReplayed = replayed;
    return { noun, count: value.boxes.length, boxes: value.boxes, replayed };
  } catch (e) {
    success = false;
    throw e;
  } finally {
    deps.record({
      id: randomUUID(),
      at: deps.now(),
      tier: "cloud",
      provider: "meta",
      model: deps.config.samModel,
      capability,
      tools_invoked: [],
      latency_ms: performance.now() - started,
      success,
      used_fallback: false,
      replayed: wasReplayed,
    });
  }
}
