"use client";

import dynamic from "next/dynamic";
import type { FloorStation } from "@throughline/hospital";
import { useFloor, useSite } from "../lib/site";
import { useHospital } from "../lib/session";

/** The WebGL model loads in the browser only; a calm placeholder holds its space meanwhile. */
const Model = dynamic(() => import("./Hospital3D"), {
  ssr: false,
  loading: () => <div className="h-[520px] animate-pulse rounded-[6px] bg-rule/30" aria-hidden />,
});

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
    <Model
      key={hospital.id}
      site={site}
      stations={stations ?? floor}
      selected={selected}
      onSelect={onSelect}
      height={height}
    />
  );
}
