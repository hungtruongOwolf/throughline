import type { Zone } from "@throughline/hospital";

/** Static class names so Tailwind can see them; tokens come from app/theme.css. */
export const ZONE_BG: Record<Zone, string> = {
  blue: "bg-zone-blue",
  gold: "bg-zone-gold",
  green: "bg-zone-green",
  rose: "bg-zone-rose",
  violet: "bg-zone-violet",
};

export const ZONE_BORDER: Record<Zone, string> = {
  blue: "border-zone-blue",
  gold: "border-zone-gold",
  green: "border-zone-green",
  rose: "border-zone-rose",
  violet: "border-zone-violet",
};

export const ZONE_TINT: Record<Zone, string> = {
  blue: "bg-zone-blue/12",
  gold: "bg-zone-gold/15",
  green: "bg-zone-green/12",
  rose: "bg-zone-rose/12",
  violet: "bg-zone-violet/12",
};

export const ZONE_STROKE: Record<Zone, string> = {
  blue: "stroke-zone-blue",
  gold: "stroke-zone-gold",
  green: "stroke-zone-green",
  rose: "stroke-zone-rose",
  violet: "stroke-zone-violet",
};
