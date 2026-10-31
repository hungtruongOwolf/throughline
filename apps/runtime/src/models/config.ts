import type { CacheMode } from "./cache";
import type { TierMode } from "./router";

export interface ModelConfig {
  metaApiKey?: string;
  metaBaseUrl: string;
  sparkModel: string;
  samModel: string;
  imageModel: string;
  voiceModel: string;
  tierMode: TierMode;
  cacheMode: CacheMode;
  /** OpenAI-compatible private tier (Glimmer on Modal or vLLM); absent until D4-3. */
  glimmer?: { baseURL: string; apiKey: string; model: string };
}

export function modelConfig(env: Record<string, string | undefined>): ModelConfig {
  const tier = env.TIER_MODE;
  const cache = env.MODEL_CACHE;
  return {
    ...(env.META_API_KEY ? { metaApiKey: env.META_API_KEY } : {}),
    metaBaseUrl: env.META_BASE_URL ?? "https://api.meta.ai/v1",
    sparkModel: env.SPARK_MODEL ?? "muse-spark-1.3",
    samModel: env.SAM_MODEL ?? "sam-3.1",
    imageModel: env.IMAGE_MODEL ?? "muse-image-1.0",
    voiceModel: env.VOICE_MODEL ?? "muse-voice-transcribe-1.0",
    tierMode: tier === "cloud_only" || tier === "private_only" ? tier : "auto",
    cacheMode: cache === "off" || cache === "replay" ? cache : "record",
    ...(env.GLIMMER_BASE_URL && env.GLIMMER_API_KEY
      ? {
          glimmer: {
            baseURL: env.GLIMMER_BASE_URL,
            apiKey: env.GLIMMER_API_KEY,
            model: env.GLIMMER_MODEL ?? "meta-models/Muse-Glimmer-30B",
          },
        }
      : {}),
  };
}
