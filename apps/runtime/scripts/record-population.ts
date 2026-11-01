// Records the Nov 17 hospital with live models into fixtures/model-cache.sqlite: the whole
// referral book (demo/population.ts), then each fax on the fax line received and taken to
// its first staff decision, so a visitor receiving it replays real model output. Then builds
// the hospital again in replay mode and checks no agent fell back. Needs META_API_KEY and
// BASETEN_API_KEY.
import { fileURLToPath } from "node:url";
import { FAX_LINE } from "@throughline/synthetic";
import { createApp } from "../src/app";
import { createContext } from "../src/context";
import { populate } from "../src/demo/population";

const CACHE = fileURLToPath(new URL("../../../fixtures/model-cache.sqlite", import.meta.url));
const post = (body: unknown = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

async function build(mode: "record" | "replay") {
  const ctx = createContext(
    { ...process.env, MODEL_CACHE: mode, MODEL_CACHE_PATH: CACHE, SYNTHETIC_ONLY: "true" },
    { databasePath: ":memory:" },
  );
  const started = performance.now();
  await populate(ctx);
  const app = createApp(ctx);
  for (const fax of FAX_LINE) {
    const journey = (await (await app.request("/api/referrals", post({ fax: fax.id }))).json()) as {
      id: string;
      state: string;
    };
    if (journey.state === "CLARIFICATION_NEEDED") {
      await app.request(
        `/api/journeys/${journey.id}/clarify`,
        post({ field: "member_id", value: fax.memberId, by: "Jordan Park" }),
      );
    }
  }
  const calls = ctx.store.modelCalls();
  const by = (f: (c: (typeof calls)[number]) => boolean) => calls.filter(f).length;
  console.log(
    `${mode}: ${Math.round(performance.now() - started)} ms, ${calls.length} model calls, ` +
      `${by((c) => !c.replayed && c.success && !c.used_fallback)} live, ${by((c) => c.replayed)} replayed, ` +
      `${by((c) => c.used_fallback)} fallbacks, ${by((c) => !c.success)} failed`,
  );
  const fallbacks = ctx.store.runs().filter((r) => r.used_template);
  for (const r of fallbacks.slice(0, 30))
    console.log(`  template: ${r.agent} ${r.capability} ${r.journey_id ?? r.station_id}`);
  return { events: ctx.store.events().length, fallbacks: fallbacks.length };
}

const recorded = await build("record");
const replayed = await build("replay");
console.log(
  "same event count:",
  recorded.events === replayed.events,
  recorded.events,
  replayed.events,
);
console.log("replay fallbacks:", replayed.fallbacks);
process.exit(0);
