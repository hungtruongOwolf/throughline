// Prints a plan from a request file: `pnpm --filter @throughline/engine plan fixtures/maria-request.json`
import { readFileSync } from "node:fs";
import { loadEngine } from "../src-ts/node";

const [file = "fixtures/maria-request.json"] = process.argv.slice(2);
const engine = loadEngine();
const request = JSON.parse(readFileSync(file, "utf8"));
engine.planItinerary(request); // warm up
const runs = 50;
const started = performance.now();
for (let i = 1; i < runs; i++) engine.planItinerary(request);
const plan = engine.planItinerary(request);
const ms = (performance.now() - started) / runs;
for (const s of plan.stops) {
  console.log(
    `${s.eta_arrive.slice(11, 16)} arrive  ${s.eta_start.slice(11, 16)}-${s.eta_end.slice(11, 16)}  ${s.station_id.padEnd(10)} ${s.node_id.padEnd(16)} ahead ${s.people_ahead}  wait ${s.est_wait_min}  walk ${s.walk_seconds}s`,
  );
}
console.log(
  `total ${plan.total_minutes} min, walking ${plan.walking_seconds} s, solved in ${ms.toFixed(2)} ms (mean of ${runs})`,
);
for (const r of plan.reason) console.log(`  - ${r}`);
