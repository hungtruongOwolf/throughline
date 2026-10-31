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
      return `<text x="64" y="${88 + i * lineHeight}" font-family="Barlow Condensed" font-weight="${i === 0 ? 700 : 600}" font-size="${size}" fill="${BOARD_TEXT}">${escapeXml(line)}</text>`;
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
