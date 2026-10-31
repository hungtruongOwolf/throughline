import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { campus, renderSignSvg, type Sign } from "@throughline/hospital";
import { streamFor } from "./rng";

const FONT_DIR = new URL("../../hospital/fonts/", import.meta.url);
// Noto Sans Math carries the arrow glyph Barlow Condensed lacks; resvg falls back to it.
const FONTS = [
  "BarlowCondensed-SemiBold.ttf",
  "BarlowCondensed-Bold.ttf",
  "NotoSansMath-Regular.ttf",
].map((f) => fileURLToPath(new URL(f, FONT_DIR)));

/** Renders a registry sign to PNG with the campus fonts, so the photo shows the real sign. */
export function renderSignPng(sign: Sign): Buffer {
  const labels = new Map(campus.nodes.map((n) => [n.id, n.label]));
  const svg = renderSignSvg(sign, labels);
  const resvg = new Resvg(svg, {
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Barlow Condensed" },
  });
  return Buffer.from(resvg.render().asPng());
}

export interface SignPhotoLabel {
  file: string;
  sign_id: string;
  node_id: string;
  background: number;
}

/**
 * The 30 signs photographed for the localizer test: one per node kind that patients look for,
 * chosen deterministically (stations, waiting areas, elevators, junctions, doors, bridges).
 */
export function signsToPhotograph(seed: number, count = 30): Sign[] {
  const rng = streamFor(seed, "sign-photos");
  const pool = [...campus.signs].sort((a, b) => a.sign_id.localeCompare(b.sign_id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as Sign, pool[i] as Sign];
  }
  return pool.slice(0, count);
}

/**
 * Composites a rendered sign onto a corridor background as a phone photo would show it:
 * off-center, slightly rotated, softened, and a little under-exposed (spec 10.1, `signs.ts`).
 */
export async function composeSignPhoto(
  signPng: Buffer,
  background: Buffer,
  seed: number,
  index: number,
): Promise<Buffer> {
  const rng = streamFor(seed, `sign-photo:${index}`);
  const width = 960;
  const height = 640;
  const bg = await sharp(background).resize(width, height, { fit: "cover" }).toBuffer();
  const signWidth = Math.round(width * (0.42 + rng.next() * 0.2));
  const angle = (rng.next() - 0.5) * 10;
  const sign = await sharp(signPng)
    .resize({ width: signWidth })
    .rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const meta = await sharp(sign).metadata();
  const left = Math.max(
    0,
    Math.round((width - (meta.width ?? signWidth)) * (0.2 + rng.next() * 0.6)),
  );
  const top = Math.max(0, Math.round((height - (meta.height ?? 200)) * (0.15 + rng.next() * 0.5)));
  return sharp(bg)
    .composite([{ input: sign, left, top }])
    .blur(0.6 + rng.next() * 0.8)
    .modulate({ brightness: 0.85 + rng.next() * 0.2 })
    .webp({ quality: 78 })
    .toBuffer();
}
