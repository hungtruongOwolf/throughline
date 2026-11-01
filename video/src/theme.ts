import { loadFont as loadAtkinson } from "@remotion/google-fonts/AtkinsonHyperlegible";
import { loadFont as loadBarlow } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadBarlowSemi } from "@remotion/google-fonts/BarlowSemiCondensed";
import { Easing } from "remotion";

// Colors and type come from the product (apps/web/app/theme.css is the source of truth).
export const C = {
  ink: "#18223a",
  inkSoft: "#4b5566",
  paper: "#f6f7f4",
  canvas: "#f4f6f5",
  panel: "#ffffff",
  rule: "#d9dfdc",
  agent: "#0f766e",
  agentTint: "#e3f1ef",
  glow: "#2dd4bf", // video only: lets teal read on navy
  held: "#9a4507",
  heldBg: "#fdf1dc",
  urgent: "#b42318",
  boardText: "#f4f6f2",
  waitLow: "#cfe8e3",
  waitMid: "#d97706",
  waitHigh: "#c2410c",
  zone: {
    blue: "#3b6fd6",
    gold: "#c9971a",
    green: "#3c8c5a",
    rose: "#c2506a",
    violet: "#7c5cbf",
  },
} as const;

const display = loadBarlow("normal", { weights: ["600", "700", "800"], subsets: ["latin"] });
const figure = loadBarlowSemi("normal", { weights: ["500", "600"], subsets: ["latin"] });
const text = loadAtkinson("normal", { weights: ["400", "700"], subsets: ["latin"] });

export const F = {
  display: display.fontFamily,
  figure: figure.fontFamily,
  text: text.fontFamily,
};

// Easing copied from the app's own animations.
export const E = {
  draw: Easing.bezier(0.65, 0, 0.35, 1), // thread-draw
  rise: Easing.bezier(0.2, 0.8, 0.2, 1), // campus-column
  out: Easing.bezier(0.16, 1, 0.3, 1),
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
