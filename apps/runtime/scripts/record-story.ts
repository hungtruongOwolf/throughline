// D4-7: plays Maria's story from the referral to checkout with live models, recording every
// model output into fixtures/model-cache.sqlite, then plays it again in replay mode and checks
// that no agent fell back and the same events happened. Needs META_API_KEY for the record pass.
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app";
import { createContext } from "../src/context";
import { STORY_STEPS } from "../src/demo/story";

const CACHE = fileURLToPath(new URL("../../../fixtures/model-cache.sqlite", import.meta.url));
const post = (body: unknown = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function play(mode: "record" | "replay") {
  const ctx = createContext(
    { ...process.env, MODEL_CACHE: mode, MODEL_CACHE_PATH: CACHE, SYNTHETIC_ONLY: "true" },
    { databasePath: ":memory:" },
  );
  const app = createApp(ctx);
  await app.request("/api/story/goto", post({ step: "fax" }));
  let seen = 0;
  for (const step of STORY_STEPS) {
    const started = performance.now();
    await app.request("/api/story/act", post());
    const fresh = ctx.store.modelCalls().slice(seen);
    seen += fresh.length;
    console.log(`  ${mode} ${step} ${Math.round(performance.now() - started)} ms`);
    for (const c of fresh) {
      const flags = `${c.replayed ? "replayed" : "live"}${c.used_fallback ? " FALLBACK" : ""}${c.success ? "" : " failed"}`;
      console.log(`    ${c.capability} ${c.model} ${Math.round(c.latency_ms)} ms ${flags}`);
    }
  }
  const calls = ctx.store.modelCalls();
  const events = ctx.store.events().map((e) => e.event.type);
  return { calls, events };
}

const recorded = await play("record");
const replayed = await play("replay");
const table = (calls: typeof recorded.calls) =>
  Object.entries(
    calls.reduce<Record<string, { calls: number; fallback: number; failed: number }>>((acc, c) => {
      const k = `${c.capability} ${c.model}`;
      const row = (acc[k] ??= { calls: 0, fallback: 0, failed: 0 });
      row.calls++;
      if (c.used_fallback) row.fallback++;
      if (!c.success) row.failed++;
      return acc;
    }, {}),
  );
console.log("record:", table(recorded.calls));
console.log("replay:", table(replayed.calls));
console.log(
  "replay used no live calls:",
  replayed.calls.every((c) => c.replayed || c.used_fallback),
);
console.log("replay fallbacks:", replayed.calls.filter((c) => c.used_fallback).length);
console.log(
  "same events:",
  JSON.stringify(recorded.events) === JSON.stringify(replayed.events),
  recorded.events.length,
  replayed.events.length,
);
process.exit(0);
