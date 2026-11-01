"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FloorStation } from "@throughline/hospital";
import { useFloor, useSite } from "../lib/site";
import { useHospital } from "../lib/session";

/** The WebGL model (about 1 MB of script) loads in the browser only, after the page is up. */
const Model = dynamic(() => import("./Hospital3D"), { ssr: false, loading: () => null });

/** Hospitals with a still of their campus, shown at once while the model loads. */
const POSTERS = new Set(["halden", "northgate", "st-brennan"]);

/** Waits until the browser is idle, so the model never competes with the page's first paint. */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setIdle(true), { timeout: 1500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setIdle(true), 600);
    return () => window.clearTimeout(t);
  }, []);
  return idle;
}

/**
 * The chosen hospital in 3D with who is waiting where. `stations` replaces the floor feed when
 * a screen already has fresher numbers.
 */
export function Hospital3D({
  stations,
  selected,
  onSelect,
  height = 520,
}: {
  stations?: FloorStation[] | undefined;
  selected?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
  height?: number;
}) {
  const hospital = useHospital();
  const { site, missing } = useSite();
  const floor = useFloor();
  if (missing)
    return (
      <div
        style={{ height: Math.min(height, 360) }}
        className="flex flex-col items-center justify-center rounded-[6px] border-2 border-dashed border-rule px-6 text-center"
      >
        <p className="font-figure text-[20px] font-semibold">{hospital.name}</p>
        <p className="mt-1 max-w-[44ch] text-[15px] text-ink-soft">
          The 3D campus appears here once your floor plans are mapped: buildings, floors, rooms, and
          the way between them.
        </p>
      </div>
    );
  if (!site)
    return (
      <div style={{ height }} className="animate-pulse rounded-[6px] bg-rule/30" aria-hidden />
    );
  return (
    <Live
      key={hospital.id}
      id={hospital.id}
      site={site}
      stations={stations ?? floor}
      selected={selected}
      onSelect={onSelect}
      height={height}
    />
  );
}

function Live({
  id,
  height,
  ...rest
}: Omit<React.ComponentProps<typeof Model>, "onReady"> & { id: string }) {
  const idle = useIdle();
  const [ready, setReady] = useState(false);
  return (
    <div className="relative" style={{ minHeight: height }}>
      {POSTERS.has(id) && (
        <img
          src={`/campus/${id}.webp`}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-500"
          style={{ opacity: ready ? 0 : 1 }}
        />
      )}
      {idle && <Model {...rest} height={height} onReady={() => setReady(true)} />}
    </div>
  );
}
