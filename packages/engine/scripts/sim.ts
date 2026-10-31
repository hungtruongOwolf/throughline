// Runs the visit-day fixture: KPIs, the CT queue around the outage, a what-if, and timings.
import { readFileSync } from "node:fs";
import type { SimRequest } from "@throughline/shared";
import { loadEngine } from "../src-ts/node";

const engine = loadEngine();
const day = JSON.parse(
  readFileSync(new URL("../../../fixtures/day-2026-11-17.json", import.meta.url), "utf8"),
) as Omit<SimRequest, "seed"> & { seed: number };

const req: SimRequest = { ...day, snapshot_every_min: 1 };
engine.simulate(req);
let t = performance.now();
const result = engine.simulate(req);
const simMs = performance.now() - t;
console.log(
  `simulate: ${simMs.toFixed(1)} ms, finished ${result.kpis.finished}/${result.kpis.patients}, mean on site ${result.kpis.mean_minutes_on_site} min`,
);
for (const s of result.kpis.stations)
  console.log(
    `  ${s.station_id.padEnd(13)} served ${String(s.served).padStart(3)}  mean wait ${s.mean_wait_min}  p90 ${s.p90_wait_min}`,
  );
const ct = result.snapshots.filter(
  (s) =>
    s.station_id === "imaging_ct" &&
    s.at.slice(11, 16) >= "09:30" &&
    s.at.slice(11, 16) <= "10:45" &&
    s.at.slice(14, 16).endsWith("5"),
);
console.log(
  "CT around the outage:",
  ct
    .map((s) => `${s.at.slice(11, 16)} n=${s.count} open=${s.open_servers} ~${s.est_wait_min}m`)
    .join(" | "),
);

const whatIfReq = {
  ...day,
  candidates: [
    {
      id: "open-ct2-slot",
      kind: "open_server" as const,
      station_id: "imaging_ct" as const,
      at: "2026-11-17T09:47:00-06:00",
    },
    {
      id: "volunteer-lobby",
      kind: "call_volunteer" as const,
      station_id: "registration" as const,
      at: "2026-11-17T09:47:00-06:00",
    },
    {
      id: "open-lab-chair",
      kind: "open_server" as const,
      station_id: "lab_draw" as const,
      at: "2026-11-17T09:47:00-06:00",
    },
  ],
  replicates: 20,
  horizon_min: 90,
};
engine.whatIf(whatIfReq);
t = performance.now();
const w = engine.whatIf(whatIfReq);
console.log(`whatIf 3 x 20: ${(performance.now() - t).toFixed(1)} ms`);
console.log(JSON.stringify(w, null, 1));
