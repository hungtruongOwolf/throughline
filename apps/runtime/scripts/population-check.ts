// Builds the Nov 17 hospital (demo/population.ts) and prints what the platform will open on:
// stage counts, the inbox by role, each referral's state, and how long the build took.
import { createContext } from "../src/context";
import { populate } from "../src/demo/population";
import { inbox, journeyRows, overview } from "../src/platform";

const started = performance.now();
const ctx = createContext({ ...process.env, SYNTHETIC_ONLY: "true" }, { databasePath: ":memory:" });
await populate(ctx);
console.log(`built in ${Math.round(performance.now() - started)} ms, clock ${ctx.clock.now()}`);
const o = overview(ctx.store, 0);
console.log(o.stages.map((s) => `${s.stage} ${s.count}`).join(" | "));
console.log("waiting by role", o.waiting_by_role, "runs", o.runs_today);
for (const i of inbox(ctx.store))
  console.log(`  [${i.role}] ${i.title}: ${i.patient ?? i.station_id} (${i.reason.slice(0, 60)})`);
for (const r of journeyRows(ctx.store))
  console.log(`${r.id.padEnd(9)} ${r.patient.padEnd(18)} ${r.state.padEnd(20)} ${r.next_step}`);
const calls = ctx.store.modelCalls();
console.log(
  "model calls",
  calls.length,
  "live",
  calls.filter((c) => !c.replayed && !c.used_fallback).length,
  "fallback",
  calls.filter((c) => c.used_fallback).length,
);
process.exit(0);
