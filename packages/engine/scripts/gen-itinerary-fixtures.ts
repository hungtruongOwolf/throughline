// Snapshots the itinerary goldens from the current engine. Review the printed plans before
// committing: these are reviewed outputs, not an independent oracle (DECISIONS #39).
import { readFileSync, writeFileSync } from "node:fs";
import type { ItineraryRequest, ReplanRequest } from "@throughline/shared";
import { loadEngine } from "../src-ts/node";

const engine = loadEngine();
const maria = JSON.parse(
  readFileSync(new URL("../fixtures/maria-request.json", import.meta.url), "utf8"),
) as ItineraryRequest;
const plan = engine.planItinerary(maria);

// 09:47: CT 1 went down at 09:40; the manager approved moving CT 1 patients to CT 2 and
// opening a CT 2 slot (spec 10.3), so one person is ahead of Maria on the one open scanner.
const replan: ReplanRequest = {
  ...maria,
  now: "2026-11-17T09:47:00-06:00",
  location: "mp2.imaging_wait",
  stops: maria.stops.map((s) =>
    s.order_id === "o-ct" ? { ...s, node_id: "mp2.ct2", not_before: undefined } : s,
  ),
  queues: [
    { station_id: "lab_draw", count: 7 },
    { station_id: "imaging_ct", count: 1, open_servers: 1 },
  ],
  current: plan,
};

// Seven stops for the < 5 ms target: Maria's day plus an X-ray and the outpatient pharmacy.
const seven: ItineraryRequest = {
  ...maria,
  stops: [
    ...maria.stops,
    { order_id: "o-xray", station_id: "imaging_xray", duration_min: 10 },
    { order_id: "o-rx", station_id: "pharmacy", duration_min: 8 },
  ],
  constraints: [
    ...(maria.constraints ?? []),
    { kind: "before", a: "o-infusion", b: "o-rx", min_gap_min: 0 },
  ],
};

const cases = [
  { name: "Maria, Nov 17, wheelchair", fn: "planItinerary", request: maria, expected: plan },
  {
    name: "Maria replan after CT 1 goes down",
    fn: "replanItinerary",
    request: replan,
    expected: engine.replanItinerary(replan),
  },
  {
    name: "seven stops",
    fn: "planItinerary",
    request: seven,
    expected: engine.planItinerary(seven),
  },
];
writeFileSync(
  new URL("../fixtures/itinerary.json", import.meta.url),
  JSON.stringify(
    { source: "reviewed engine snapshot (scripts/gen-itinerary-fixtures.ts)", cases },
    null,
    2,
  ) + "\n",
);
for (const c of cases) {
  const p = "plan" in c.expected ? c.expected.plan : c.expected;
  console.log(`\n${c.name}`);
  for (const s of p.stops)
    console.log(
      `  ${s.eta_start.slice(11, 16)}-${s.eta_end.slice(11, 16)} ${s.station_id} ${s.node_id}`,
    );
  if ("diff" in c.expected)
    console.log("  diff:", JSON.stringify(c.expected.diff), "\n  reason:", c.expected.reason);
}
