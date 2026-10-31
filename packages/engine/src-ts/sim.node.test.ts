import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import type { SimRequest, WhatIfRequest } from "@throughline/shared";
import { loadEngine } from "./node";

const day = JSON.parse(
  readFileSync(new URL("../../../fixtures/day-2026-11-17.json", import.meta.url), "utf8"),
) as SimRequest;
const engine = loadEngine();
const raw = createRequire(import.meta.url)("../pkg-node/throughline_engine.js") as {
  simulate(json: string): string;
};

const candidates: WhatIfRequest["candidates"] = [
  {
    id: "open-ct2-slot",
    kind: "open_server",
    station_id: "imaging_ct",
    at: "2026-11-17T09:47:00-06:00",
  },
  {
    id: "volunteer-lobby",
    kind: "call_volunteer",
    station_id: "registration",
    at: "2026-11-17T09:47:00-06:00",
  },
  {
    id: "divert-2a",
    kind: "divert",
    station_id: "clinic_2a",
    to_station: "clinic_2b",
    count: 3,
    at: "2026-11-17T09:47:00-06:00",
  },
];

function mean(fn: () => unknown, runs: number): number {
  fn();
  const t = performance.now();
  for (let i = 0; i < runs; i++) fn();
  return (performance.now() - t) / runs;
}

describe("simulation through the wrapper (spec 7.3 targets; CI fails above 2x)", () => {
  it("validates a full day with snapshots", () => {
    const r = engine.simulate({ ...day, snapshot_every_min: 1 });
    expect(r.kpis.patients).toBe(200);
    expect(r.snapshots.length).toBeGreaterThan(5000);
  });

  it("200 patients x 8 hours runs in under 15 ms per replicate in the engine", () => {
    const json = JSON.stringify({ ...day, snapshot_every_min: 1 });
    expect(mean(() => raw.simulate(json), 10)).toBeLessThan(30);
  });

  it("what-if 3 actions x 20 replicates x 90 minutes runs well under 400 ms", () => {
    const req: WhatIfRequest = { ...day, candidates, replicates: 20, horizon_min: 90 };
    expect(mean(() => engine.whatIf(req), 3)).toBeLessThan(800);
    const best = [...engine.whatIf(req).per_action].sort((a, b) => b.delta_min - a.delta_min)[0];
    expect(best?.action_id).toBe("open-ct2-slot");
  });
});
