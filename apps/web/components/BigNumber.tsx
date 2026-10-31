import type { ReactNode } from "react";

/** A number set in Barlow Condensed at display size, with its words beside it. */
export function BigNumber({ value, label }: { value: number | string; label: ReactNode }) {
  return (
    <p className="flex items-baseline gap-3">
      <span className="font-display text-[64px] leading-none font-bold tabular-nums">{value}</span>
      <span className="text-[19px]">{label}</span>
    </p>
  );
}
