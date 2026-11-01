"use client";

import { useEffect, useMemo, useState } from "react";
import { loadEngine } from "@throughline/engine/web";
import type { Mobility, WalkingRoute } from "@throughline/shared";
import { node } from "../lib/campus";
import { floorOf, FLOORS, type Floor } from "../lib/floorplan";
import { minutes, wayfindingSteps, type WayStep } from "../lib/wayfinding";
import { FloorMap } from "./FloorMap";
import { useHospital } from "../lib/session";

function StepIcon({ step }: { step: WayStep }) {
  const base =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-[15px] font-bold";
  if (step.kind === "elevator")
    return (
      <span aria-hidden className={`${base} bg-ink text-white`}>
        L{floorOf(step.to)}
      </span>
    );
  if (step.kind === "stairs")
    return (
      <span aria-hidden className={`${base} bg-ink-soft text-white`}>
        L{floorOf(step.to)}
      </span>
    );
  if (step.kind === "arrive")
    return (
      <span aria-hidden className={`${base} bg-[#c2410c] text-white`}>
        ●
      </span>
    );
  return (
    <span aria-hidden className={`${base} bg-line text-white`}>
      {minutes(step.seconds)}′
    </span>
  );
}

/**
 * Wayfinding (UX research section 4): header with time and step-free state, a 2D map of the
 * current step's floor with a floor switcher, and the step list, which is the main UI and
 * the accessible version of the map. Routing is the engine's (WASM, no network).
 */
export function Wayfinding({
  from,
  to,
  mobility = "wheelchair",
  layout = "phone",
  title,
}: {
  from: string;
  to: string;
  mobility?: Mobility;
  layout?: "phone" | "wide";
  title?: string;
}) {
  const hospital = useHospital();
  const [stepFree, setStepFree] = useState(true);
  const [route, setRoute] = useState<WalkingRoute | undefined>();
  const [current, setCurrent] = useState(0);
  const [floor, setFloor] = useState<Floor>(floorOf(from) ?? 1);
  const effective: Mobility = stepFree
    ? "wheelchair"
    : mobility === "wheelchair"
      ? "wheelchair"
      : "walking";

  useEffect(() => {
    let alive = true;
    loadEngine()
      .then((engine) => engine.walkingRoute({ from, to, mobility: effective }))
      .then((r) => {
        if (!alive) return;
        setRoute(r);
        setCurrent(0);
        setFloor(floorOf(from) ?? 1);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [from, to, effective]);

  const steps = useMemo(() => (route ? wayfindingSteps(route) : []), [route]);
  const step = steps[current];
  const usedFloors = new Set((route?.nodes ?? []).map(floorOf));
  const destLabel = title ?? node(to)?.label ?? to;

  function select(i: number) {
    const s = steps[i];
    if (!s) return;
    setCurrent(i);
    setFloor(s.floor);
  }

  const map = (
    <div className="relative overflow-hidden rounded-[12px] bg-[#e8ebe5]">
      <FloorMap
        floor={floor}
        routeNodes={route?.nodes}
        here={step?.from}
        destination={to}
        focus
        minView={layout === "phone" ? { w: 110, h: 100 } : { w: 150, h: 95 }}
        onFloorChange={setFloor}
        className="block h-auto w-full"
      />
      <div
        role="group"
        aria-label="Floor"
        className="absolute top-3 right-3 flex flex-col overflow-hidden rounded-[10px] bg-white shadow-sm ring-1 ring-ink/10"
      >
        {FLOORS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={floor === f}
            onClick={() => setFloor(f)}
            className={`relative min-h-11 min-w-11 text-[15px] font-bold ${floor === f ? "bg-ink text-white" : "text-ink"}`}
          >
            L{f}
            {usedFloors.has(f) && floor !== f && (
              <span
                aria-hidden
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-line"
              />
            )}
          </button>
        ))}
      </div>
      <p className="absolute bottom-2 left-3 rounded-[6px] bg-white/90 px-2 py-0.5 text-[13px] font-bold">
        Level {floor}
      </p>
    </div>
  );

  const list = (
    <ol className="space-y-2" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={`${s.from}-${s.kind}-${i}`}>
          <button
            type="button"
            onClick={() => select(i)}
            aria-current={i === current ? "step" : undefined}
            className={`flex w-full items-start gap-3 rounded-[12px] p-3 text-left ${
              i === current
                ? "bg-white ring-2 ring-line"
                : i < current
                  ? "opacity-60"
                  : "bg-white/60"
            }`}
          >
            <StepIcon step={s} />
            <span className="flex-1">
              <span className="block text-[17px] leading-snug">{s.text}</span>
              <span className="mt-0.5 block text-[13px] text-ink-soft">
                Level {s.floor}
                {s.kind !== "arrive" ? ` · about ${minutes(s.seconds)} min` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <section aria-labelledby="way-title" className="text-ink">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="way-title" className="font-display text-[30px] leading-tight font-bold">
            To {destLabel}
          </h2>
          {route && (
            <p className="text-[15px] text-ink-soft">
              About {minutes(route.seconds)} min · {stepFree ? "step-free route" : "may use stairs"}{" "}
              · Level {floorOf(from)} to Level {floorOf(to)}
            </p>
          )}
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[15px]">
          <input
            type="checkbox"
            checked={stepFree}
            onChange={(e) => setStepFree(e.target.checked)}
            className="h-5 w-5 accent-[var(--color-line)]"
          />
          Step-free (elevators only)
        </label>
      </header>

      {layout === "wide" ? (
        <div className="mt-4 grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          {map}
          <div>{list}</div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {map}
          {list}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={current >= steps.length - 1}
          onClick={() => select(current + 1)}
          className="min-h-12 rounded-[12px] bg-line px-6 text-[17px] font-bold text-white disabled:opacity-40"
        >
          Next step
        </button>
        <p className="text-[15px] text-ink-soft">
          Need help? Ask at any desk or call{" "}
          <a className="font-bold text-line" href={`tel:${hospital.phone_href}`}>
            {hospital.phone}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
