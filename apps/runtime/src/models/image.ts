import { randomUUID } from "node:crypto";
import type OpenAI from "openai";
import type { Capability, ModelCallRecord } from "@throughline/shared";
import type { ModelCache } from "./cache";
import type { ModelConfig } from "./config";

/** One fixed style prefix keeps every card and frame in the same visual family (spec 8.1). */
export const CARD_STYLE =
  "Flat editorial illustration, muted paper background, ink linework, teal accents, " +
  "calm hospital interior, no text, no logos, no faces in detail.";

/**
 * Muse Image (spec 8.1). Images are generated once per prompt and committed; the cache makes a
 * re-run free, and the size only sets the aspect ratio.
 */
export async function generateImage(
  deps: {
    client: OpenAI;
    config: ModelConfig;
    cache: ModelCache;
    record: (r: ModelCallRecord) => void;
    now: () => string;
  },
  prompt: string,
  opts: { size?: "1536x1024" | "1024x1024" | "1024x1536"; capability?: Capability } = {},
): Promise<{ bytes: Buffer; replayed: boolean }> {
  const started = performance.now();
  const body = {
    model: deps.config.imageModel,
    prompt,
    n: 1,
    size: opts.size ?? "1536x1024",
    output_format: "webp",
    response_format: "b64_json",
  };
  let success = true;
  let wasReplayed = false;
  try {
    const { value, replayed } = await deps.cache.call<{ b64: string }>(
      "meta",
      deps.config.imageModel,
      body,
      async () => {
        const r = await deps.client.images.generate(
          body as unknown as OpenAI.Images.ImageGenerateParamsNonStreaming,
        );
        const b64 = r.data?.[0]?.b64_json;
        if (!b64) throw new Error("image generation returned no data");
        return { b64 };
      },
    );
    wasReplayed = replayed;
    return { bytes: Buffer.from(value.b64, "base64"), replayed };
  } catch (e) {
    success = false;
    throw e;
  } finally {
    deps.record({
      id: randomUUID(),
      at: deps.now(),
      tier: "cloud",
      provider: "meta",
      model: deps.config.imageModel,
      capability: opts.capability ?? "prep.compose",
      tools_invoked: [],
      latency_ms: performance.now() - started,
      success,
      used_fallback: false,
      replayed: wasReplayed,
    });
  }
}
