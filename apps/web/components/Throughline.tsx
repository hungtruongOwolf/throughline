import type { ReactNode } from "react";
import type { Zone } from "@throughline/hospital";
import { ZONE_BG } from "../lib/zone-classes";

export interface ThroughlineStop {
  key: string;
  zone?: Zone;
  status: "done" | "current" | "future";
  /** What hangs off the line at this stop. */
  content: ReactNode;
}

/**
 * The line (spec 9.1): one continuous route that takes the zone color of each stop it passes
 * through, teal outside zones. Stops are square: done = filled ink, current = large teal,
 * future = outline. Rendered as a real list; the line itself is decorative.
 */
export function Throughline({
  stops,
  orientation = "vertical",
  label,
}: {
  stops: ThroughlineStop[];
  orientation?: "vertical" | "horizontal";
  label: string;
}) {
  if (orientation === "horizontal") return <HorizontalLine stops={stops} label={label} />;
  return (
    <ol aria-label={label} className="relative">
      {stops.map((stop, i) => {
        const first = i === 0;
        const last = i === stops.length - 1;
        const rail = stop.zone ? ZONE_BG[stop.zone] : "bg-line";
        return (
          <li key={stop.key} className="relative grid grid-cols-[24px_1fr] gap-x-4">
            <span
              aria-hidden
              className={`absolute left-[9px] w-[6px] ${rail} ${first ? "top-3" : "top-0"} ${last ? "h-3" : "bottom-0"}`}
            />
            <span aria-hidden className="relative flex justify-center pt-1">
              <Marker status={stop.status} />
            </span>
            <div>{stop.content}</div>
          </li>
        );
      })}
    </ol>
  );
}

function Marker({ status }: { status: ThroughlineStop["status"] }) {
  if (status === "current") return <span className="mt-[-4px] size-6 bg-line" />;
  if (status === "done") return <span className="size-4 bg-ink" />;
  return <span className="size-4 border-2 border-ink bg-paper" />;
}

function HorizontalLine({ stops, label }: { stops: ThroughlineStop[]; label: string }) {
  return (
    <ol aria-label={label} className="flex">
      {stops.map((stop, i) => {
        const rail = stop.zone ? ZONE_BG[stop.zone] : "bg-line";
        return (
          <li key={stop.key} className="relative flex flex-1 flex-col items-center">
            <span
              aria-hidden
              className={`absolute top-[9px] h-[6px] ${rail} ${i === 0 ? "left-1/2" : "left-0"} ${i === stops.length - 1 ? "right-1/2" : "right-0"}`}
            />
            <span aria-hidden className="relative flex h-6 items-center">
              <Marker status={stop.status} />
            </span>
            <div className="mt-2 px-1 text-center text-[13px]">{stop.content}</div>
          </li>
        );
      })}
    </ol>
  );
}
