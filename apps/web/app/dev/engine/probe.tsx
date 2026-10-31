"use client";

import { useEffect, useState } from "react";
import type { WalkingRoute } from "@throughline/shared";
import { loadEngine } from "@throughline/engine/web";

type Result =
  | { status: "loading" }
  | { status: "ok"; version: string; walking: WalkingRoute; wheelchair: WalkingRoute }
  | { status: "error"; message: string };

export function EngineProbe() {
  const [result, setResult] = useState<Result>({ status: "loading" });

  useEffect(() => {
    loadEngine()
      .then((engine) => {
        const req = { from: "mp1.entrance", to: "mp2.ct2" } as const;
        setResult({
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
