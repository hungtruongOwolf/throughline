import { createHash } from "node:crypto";
import type Database from "better-sqlite3";

export type CacheMode = "off" | "record" | "replay";

export class CacheMiss extends Error {
  constructor(readonly key: string) {
    super(`no recorded response for ${key.slice(0, 12)}; run with MODEL_CACHE=record first`);
  }
}

/** Stable JSON: object keys sorted, so the same request always hashes the same. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function cacheKey(provider: string, model: string, request: unknown): string {
  return createHash("sha256")
    .update(`${provider}\n${model}\n${stable(request)}`)
    .digest("hex");
}

/**
 * Record/replay model cache (spec 8.4). `record` calls the provider and stores the response
 * once per request hash; `replay` serves only from the cache and marks the call replayed.
 */
export class ModelCache {
  constructor(
    private readonly sqlite: Database.Database,
    readonly mode: CacheMode,
  ) {}

  async call<T>(
    provider: string,
    model: string,
    request: unknown,
    live: () => Promise<T>,
  ): Promise<{ value: T; replayed: boolean }> {
    if (this.mode === "off") return { value: await live(), replayed: false };
    const key = cacheKey(provider, model, request);
    const row = this.sqlite.prepare("SELECT response FROM model_cache WHERE key = ?").get(key) as
      { response: string } | undefined;
    if (this.mode === "replay") {
      if (!row) throw new CacheMiss(key);
      return { value: JSON.parse(row.response) as T, replayed: true };
    }
    const value = await live();
    if (!row) {
      this.sqlite
        .prepare("INSERT INTO model_cache (key, provider, model, response) VALUES (?, ?, ?, ?)")
        .run(key, provider, model, JSON.stringify(value));
    }
    return { value, replayed: false };
  }

  size(): number {
    return (this.sqlite.prepare("SELECT COUNT(*) AS n FROM model_cache").get() as { n: number }).n;
  }
}
