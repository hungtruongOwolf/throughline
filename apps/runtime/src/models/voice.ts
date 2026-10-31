import { createHash, randomUUID } from "node:crypto";
import type { ModelCallRecord } from "@throughline/shared";
import type { ModelCache } from "./cache";
import type { ModelConfig } from "./config";

/** Station and provider names the recognizer should prefer over sound-alikes. */
const KEYWORDS = ["Throughline", "Halden", "Okafor", "Whitcombe", "CT", "infusion", "wheelchair"];

/**
 * Muse Voice Transcribe, batch endpoint (spec 8.2): a patient's voice note (WAV, mono 16-bit)
 * becomes text. The audio is hashed for the cache key and dropped after the call, never stored.
 */
export async function transcribe(
  deps: {
    config: ModelConfig;
    cache: ModelCache;
    record: (r: ModelCallRecord) => void;
    now: () => string;
  },
  wav: Buffer,
): Promise<{ transcript: string; replayed: boolean }> {
  const started = performance.now();
  const request = {
    model: deps.config.voiceModel,
    audioEncoding: "WAV",
    languageBias: ["en", "es"],
    keywords: KEYWORDS,
  };
  const key = { ...request, audio_sha256: createHash("sha256").update(wav).digest("hex") };
  let success = true;
  let replayed = false;
  try {
    const result = await deps.cache.call<{ transcript: string }>(
      "meta",
      deps.config.voiceModel,
      key,
      async () => {
        const form = new FormData();
        form.append(
          "request",
          new Blob([JSON.stringify(request)], { type: "application/json" }),
          "request.json",
        );
        form.append("audio", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "note.wav");
        const res = await fetch(`${deps.config.metaBaseUrl}/asr/transcribe`, {
          method: "POST",
          headers: { authorization: `Bearer ${deps.config.metaApiKey ?? ""}` },
          body: form,
        });
        const body = (await res.json()) as { transcript?: string; error?: { message?: string } };
        if (!res.ok || body.transcript === undefined) {
          throw new Error(`transcribe failed: ${body.error?.message ?? res.status}`);
        }
        return { transcript: body.transcript };
      },
    );
    replayed = result.replayed;
    return { transcript: result.value.transcript.trim(), replayed };
  } catch (e) {
    success = false;
    throw e;
  } finally {
    deps.record({
      id: randomUUID(),
      at: deps.now(),
      tier: "cloud",
      provider: "meta",
      model: deps.config.voiceModel,
      capability: "reply.handle",
      tools_invoked: [],
      latency_ms: performance.now() - started,
      success,
      used_fallback: false,
      replayed,
    });
  }
}
