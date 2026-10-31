import type { Zone } from "./schema";

/**
 * Mirror of the zone and ink tokens in apps/web/app/theme.css, for renderers that run
 * outside the web app (SVG signs, tickets, PNG sign photos). A test keeps them in sync.
 */
export const ZONE_COLORS: Record<Zone, string> = {
  blue: "#3b6fd6",
  gold: "#c9971a",
  green: "#3c8c5a",
  rose: "#c2506a",
  violet: "#7c5cbf",
};

export const INK = "#18223a";
export const PAPER = "#f6f7f4";
export const BOARD_TEXT = "#f4f6f2";
