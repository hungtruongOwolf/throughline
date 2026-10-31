"use client";

import { useEffect, useState } from "react";
import type { SimRequest, WalkingRoute, WhatIfRequest } from "@throughline/shared";
import { loadEngine } from "@throughline/engine/web";
import day from "../../../../../fixtures/day-2026-11-17.json";

type Result =
  | { status: "loading" }
  | {
      status: "ok";
      version: string;
      walking: WalkingRoute;
      wheelchair: WalkingRoute;
      whatIfMs: number;
      ctDelta: number;
    }
  | { status: "error"; message: string };

export function EngineProbe() {
  const [result, setResult] = useState<Result>({ status: "loading" });

  useEffect(() => {
    loadEngine()
      .then((engine) => {
        const req = { from: "mp1.entrance", to: "mp2.ct2" } as const;
        const at = "2026-11-17T09:47:00-06:00";
        const whatIfReq: WhatIfRequest = {
          ...(day as SimRequest),
          candidates: [
            { id: "ct", kind: "open_server", station_id: "imaging_ct", at },
            { id: "lobby", kind: "call_volunteer", station_id: "registration", at },
            { id: "lab", kind: "open_server", station_id: "lab_draw", at },
          ],
          replicates: 20,
          horizon_min: 90,
        };
        engine.whatIf(whatIfReq);
        const started = performance.now();
        const whatIf = engine.whatIf(whatIfReq);
        const whatIfMs = performance.now() - started;
        setResult({
          whatIfMs,
          ctDelta: whatIf.per_action.find((a) => a.action_id === "ct")?.delta_min ?? 0,
          status: "ok",
          version: `${engine.implementation} ${engine.version()}`,
          walking: engine.walkingRoute({ ...req, mobility: "walking" }),
          wheelchair: engine.walkingRoute({ ...req, mobility: "wheelchair" }),
        });
      })
      .catch((e: unknown) => setResult({ status: "error", message: String(e) }));
  }, []);

  if (result.status === "loading") return <p className="mt-6">Loading engine</p>;
  if (result.status === "error") return <p className="mt-6">Engine failed: {result.message}</p>;
  return (
    <div className="mt-6 space-y-6">
      <p data-testid="engine-version">engine: {result.version}</p>
      <p>
        What-if, 3 actions x 20 replicates x 90 minutes:{" "}
        <span data-testid="whatif-ms">{Math.round(result.whatIfMs)}</span> ms; opening a CT 2 slot
        saves <span data-testid="ct-delta">{result.ctDelta}</span> minutes of CT wait.
      </p>
      {(["walking", "wheelchair"] as const).map((mode) => (
        <section key={mode}>
          <h2 className="font-display text-[28px] font-semibold">
            Main Entrance to CT 2, {mode}:{" "}
            <span data-testid={`seconds-${mode}`}>{result[mode].seconds}</span> s
          </h2>
          <ol className="mt-2 list-decimal pl-6">
            {result[mode].steps.map((s, i) => (
              <li key={i}>
                {s.kind} to {s.to_label}, {s.seconds} s
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
