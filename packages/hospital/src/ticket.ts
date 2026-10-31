import QRCode from "qrcode";
import { t, type Language } from "@throughline/shared";
import type { Zone } from "./schema";
import { escapeXml } from "./signage";
import { INK, PAPER, ZONE_COLORS } from "./zones";

export interface TicketStop {
  name: string;
  zone: Zone;
  floor: number;
  time?: string;
}

export interface TicketInput {
  number: number;
  language: Language;
  qr_payload: string;
  stops: TicketStop[];
}

function qrRects(payload: string, x: number, y: number, size: number): string {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  const rects: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        rects.push(
          `<rect x="${(x + c * cell).toFixed(2)}" y="${(y + r * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`,
        );
      }
    }
  }
  return `<g fill="${INK}">${rects.join("")}</g>`;
}

/**
 * Kiosk itinerary ticket (spec 9.3): the first stop's zone color across the top edge, the
 * ticket number, the first three stops, and a QR code that opens the patient's line.
 */
export function renderTicketSvg(input: TicketInput): string {
  const width = 384;
  const stops = input.stops.slice(0, 3);
  const height = 300 + stops.length * 72 + 40;
  const first = stops[0];
  const band = first ? ZONE_COLORS[first.zone] : INK;
  const lang = input.language;
  const stopRows = stops
    .map((s, i) => {
      const y = 280 + i * 72;
      const time = s.time
        ? `<text x="${width - 24}" y="${y}" text-anchor="end" font-family="Barlow Condensed" font-weight="600" font-size="28" fill="${INK}">${escapeXml(s.time)}</text>`
        : "";
      return [
        `<rect x="24" y="${y - 26}" width="12" height="44" fill="${ZONE_COLORS[s.zone]}"/>`,
        `<text x="48" y="${y}" font-family="Barlow Condensed" font-weight="700" font-size="30" fill="${INK}">${escapeXml(s.name)}</text>`,
        `<text x="48" y="${y + 22}" font-family="Atkinson Hyperlegible" font-size="15" fill="${INK}">${escapeXml(t(lang, "ticket.level", { floor: s.floor }))}</text>`,
        time,
      ].join("");
    })
    .join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>`,
    `<rect width="${width}" height="16" fill="${band}"/>`,
    `<text x="24" y="56" font-family="Atkinson Hyperlegible" font-size="17" fill="${INK}">${escapeXml(t(lang, "hospital.name"))}</text>`,
    `<text x="24" y="104" font-family="Barlow Condensed" font-weight="700" font-size="44" fill="${INK}">${escapeXml(t(lang, "ticket.number", { number: input.number }))}</text>`,
    qrRects(input.qr_payload, width - 24 - 120, 36, 120),
    `<text x="24" y="220" font-family="Atkinson Hyperlegible" font-weight="700" font-size="17" fill="${INK}">${escapeXml(t(lang, "ticket.first_stops"))}</text>`,
    stopRows,
    `<text x="24" y="${height - 16}" font-family="Atkinson Hyperlegible" font-size="13" fill="${INK}">${escapeXml(t(lang, "footer.synthetic"))}</text>`,
    `</svg>`,
  ].join("");
}
