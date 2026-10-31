import type { Sign } from "./schema";
import { BOARD_TEXT, INK, ZONE_COLORS } from "./zones";

const ARROW_ROTATION = { right: 0, ahead: -90, left: 180, back: 90, up: -90, down: 90 } as const;

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function arrowGlyph(x: number, y: number, direction: keyof typeof ARROW_ROTATION, color: string) {
  const r = ARROW_ROTATION[direction];
  return `<g transform="translate(${x} ${y}) rotate(${r})"><path d="M-18 -6 H4 V-16 L20 0 L4 16 V6 H-18 Z" fill="${color}"/></g>`;
}

/** Approximate Barlow Condensed advance widths, in em, for laying out a sign line in parts. */
function textWidth(text: string, size: number): number {
  let em = 0;
  for (const ch of text) {
    if (ch === " ") em += 0.2;
    else if (/[A-Z]/.test(ch)) em += 0.45;
    else if (/[0-9]/.test(ch)) em += 0.42;
    else em += 0.375;
  }
  return em * size;
}

/**
 * One sign line. Barlow Condensed has no arrow glyph and resvg will not mix fonts inside one
 * text run, so "A → B" is drawn as three text elements: A, the arrow in Noto Sans Math, B.
 */
function signLine(text: string, x: number, y: number, attrs: string, size: number): string {
  const parts = text.split("→");
  if (parts.length === 1) return `<text x="${x}" y="${y}" ${attrs}>${escapeXml(text)}</text>`;
  let cursor = x;
  return parts
    .map((part, i) => {
      const piece = `<text x="${cursor.toFixed(1)}" y="${y}" ${attrs}>${escapeXml(part.trim())}</text>`;
      cursor += textWidth(part.trim(), size) + size * 0.3;
      if (i === parts.length - 1) return piece;
      const arrow = `<text x="${cursor.toFixed(1)}" y="${y}" ${attrs.replace('font-family="Barlow Condensed"', 'font-family="Noto Sans Math"')}>→</text>`;
      cursor += size * 1.25;
      return piece + arrow;
    })
    .join("");
}

/** Barlow Condensed averages about 0.47 em per character; shrink long lines to fit. */
function fitFontSize(text: string, preferred: number, maxWidth: number): number {
  const estimated = text.length * preferred * 0.47;
  return estimated <= maxWidth ? preferred : Math.floor((preferred * maxWidth) / estimated);
}

/**
 * Draws a campus sign: ink panel, zone band on the left, Barlow Condensed lines, and up to
 * three arrows. Signs are what the hospital "has", so the model reads exactly these.
 */
export function renderSignSvg(sign: Sign, labels: Map<string, string>): string {
  const width = 640;
  const lineHeight = 64;
  const arrows = sign.arrows.slice(0, 3);
  const height = 48 + sign.lines.length * lineHeight + arrows.length * 52 + 24;
  const zone = ZONE_COLORS[sign.zone];
  const lines = sign.lines
    .map((line, i) => {
      const size = fitFontSize(line, i === 0 ? 56 : 44, width - 64 - 24);
      const attrs = `font-family="Barlow Condensed" font-weight="${i === 0 ? 700 : 600}" font-size="${size}" fill="${BOARD_TEXT}"`;
      return signLine(line, 64, 88 + i * lineHeight, attrs, size);
    })
    .join("");
  const arrowRows = arrows
    .map((a, i) => {
      const y = 48 + sign.lines.length * lineHeight + 24 + i * 52;
      const label = labels.get(a.target_node_id) ?? a.target_node_id;
      return `${arrowGlyph(88, y, a.direction, zone)}<text x="124" y="${y + 12}" font-family="Barlow Condensed" font-weight="600" font-size="34" fill="${BOARD_TEXT}">${escapeXml(label)}</text>`;
    })
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sign-id="${sign.sign_id}">`,
    `<rect width="${width}" height="${height}" fill="${INK}"/>`,
    `<rect width="24" height="${height}" fill="${zone}"/>`,
    lines,
    arrowRows,
    `</svg>`,
  ].join("");
}
