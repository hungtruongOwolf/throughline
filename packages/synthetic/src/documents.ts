import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { ORGS, PAYER_RULES } from "./clinical";
import { streamFor } from "./rng";

const FONT_DIR = new URL("../../hospital/fonts/", import.meta.url);
const FONTS = [
  "AtkinsonHyperlegible-Regular.ttf",
  "AtkinsonHyperlegible-Bold.ttf",
  "CourierPrime-Regular.ttf",
].map((f) => fileURLToPath(new URL(f, FONT_DIR)));

const WATERMARK = "SYNTHETIC SAMPLE. NOT A REAL DOCUMENT.";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(svg: string, width: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Atkinson Hyperlegible" },
  });
  return Buffer.from(resvg.render().asPng());
}

/**
 * What the referral says, as written. This is also the ground truth for extraction evals:
 * the member id suffix is smudged on the fax, so a correct extraction leaves it out and asks.
 */
export const MARIA_REFERRAL = {
  sent_at: "11/10/2026 08:04",
  from: ORGS.referring_clinic,
  provider: "Hannah Whitcombe, MD",
  provider_phone: "(555) 010-0170",
  to: `${ORGS.hospital}, Oncology Intake`,
  patient: {
    name: "Maria Diaz",
    dob: "03/08/1955",
    phone: "+1 555 0101",
    language: "Spanish",
    address: "1420 Cedar Street, Halden",
  },
  insurance: { payer: ORGS.payer, member_id_visible: "LHP-883201-", plan: PAYER_RULES.plan_id },
  reason: "New patient consult, medical oncology",
  diagnosis_code_as_written: "C34.90",
  urgency_as_written: "Routine, within 2 weeks",
  services: [
    "CBC w/ diff",
    "CMP",
    "CT chest/abdomen/pelvis with contrast",
    "New patient consult, medical oncology",
  ],
  fasting_as_written: "Nothing to eat or drink except water for 8 hours before the blood draw.",
} as const;

/** The full member id, printed on the card (the fax hides the suffix). */
export const MARIA_MEMBER_ID = "LHP-883201-02";

function referralSvg(): string {
  const r = MARIA_REFERRAL;
  const lines: [string, string][] = [
    ["Patient", r.patient.name],
    ["Date of birth", r.patient.dob],
    ["Phone", r.patient.phone],
    ["Preferred language", r.patient.language],
    ["Address", r.patient.address],
    ["Insurance", `${r.insurance.payer}, plan ${r.insurance.plan}`],
    ["Member ID", r.insurance.member_id_visible],
    ["Reason for referral", r.reason],
    ["Diagnosis code", r.diagnosis_code_as_written],
    ["Urgency", r.urgency_as_written],
  ];
  const rows = lines
    .map(
      ([k, v], i) =>
        `<text x="80" y="${330 + i * 44}" font-family="Atkinson Hyperlegible" font-weight="700" font-size="22">${esc(k)}</text>` +
        `<text x="360" y="${330 + i * 44}" font-family="Atkinson Hyperlegible" font-size="22">${esc(v)}</text>`,
    )
    .join("");
  const services = r.services
    .map(
      (s, i) =>
        `<text x="100" y="${840 + i * 36}" font-family="Atkinson Hyperlegible" font-size="22">[x] ${esc(s)}</text>`,
    )
    .join("");
  // The member id suffix is smudged: two blots over where the digits would be.
  const smudge = `<ellipse cx="520" cy="${330 + 6 * 44 - 8}" rx="34" ry="16" fill="#222" opacity="0.85"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1553" viewBox="0 0 1200 1553">
  <rect width="1200" height="1553" fill="#fbfbf8"/>
  <text x="60" y="50" font-family="Courier Prime" font-size="20">FAX  ${esc(r.sent_at)}  FROM: NORTHGATE FAMILY MED (555) 010-0172  TO: HALDEN ONC INTAKE  P.1/1</text>
  <text x="80" y="140" font-family="Atkinson Hyperlegible" font-weight="700" font-size="40">${esc(r.from)}</text>
  <text x="80" y="180" font-family="Atkinson Hyperlegible" font-size="20">88 Larch Road, Suite 2, Halden  |  (555) 010-0170</text>
  <line x1="80" y1="205" x2="1120" y2="205" stroke="#111" stroke-width="2"/>
  <text x="80" y="260" font-family="Atkinson Hyperlegible" font-weight="700" font-size="30">Referral to ${esc(r.to)}</text>
  ${rows}
  ${smudge}
  <text x="80" y="800" font-family="Atkinson Hyperlegible" font-weight="700" font-size="24">Services requested</text>
  ${services}
  <text x="80" y="1020" font-family="Atkinson Hyperlegible" font-weight="700" font-size="24">Instructions</text>
  <text x="100" y="1060" font-family="Atkinson Hyperlegible" font-size="22">${esc(r.fasting_as_written)}</text>
  <text x="80" y="1180" font-family="Atkinson Hyperlegible" font-size="22">Referring provider: ${esc(r.provider)}</text>
  <text x="80" y="1220" font-family="Atkinson Hyperlegible" font-size="22">Signature on file</text>
  <text x="600" y="1480" text-anchor="middle" font-family="Atkinson Hyperlegible" font-weight="700" font-size="26" fill="#999">${WATERMARK}</text>
</svg>`;
}

/** Fax look: grayscale, slight skew, thresholded speckle noise, low contrast. */
async function faxify(png: Buffer, seed: number, name: string): Promise<Buffer> {
  const rng = streamFor(seed, `fax:${name}`);
  const angle = (rng.next() - 0.5) * 1.6;
  const base = await sharp(png)
    .rotate(angle, { background: "#fbfbf8" })
    .greyscale()
    .linear(1.15, -18)
    .png()
    .toBuffer();
  const meta = await sharp(base).metadata();
  const width = meta.width ?? 1200;
  const height = meta.height ?? 1553;
  const noise = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const dark = rng.next() < 0.004;
    noise[i * 4] = 0;
    noise[i * 4 + 1] = 0;
    noise[i * 4 + 2] = 0;
    noise[i * 4 + 3] = dark ? 200 : 0;
  }
  return sharp(base)
    .composite([{ input: noise, raw: { width, height, channels: 4 } }])
    .png({ compressionLevel: 9, palette: true, colours: 16 })
    .toBuffer();
}

function cardSvg(): string {
  const r = MARIA_REFERRAL;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1012" height="638" viewBox="0 0 1012 638">
  <rect width="1012" height="638" rx="36" fill="#eef3f2"/>
  <rect width="1012" height="110" rx="36" fill="#2f5d62"/>
  <rect y="70" width="1012" height="40" fill="#2f5d62"/>
  <text x="48" y="72" font-family="Atkinson Hyperlegible" font-weight="700" font-size="40" fill="#ffffff">${esc(ORGS.payer)}</text>
  <text x="48" y="180" font-family="Atkinson Hyperlegible" font-size="22" fill="#333">Member</text>
  <text x="48" y="218" font-family="Atkinson Hyperlegible" font-weight="700" font-size="34">${esc(r.patient.name.toUpperCase())}</text>
  <text x="48" y="282" font-family="Atkinson Hyperlegible" font-size="22" fill="#333">Member ID</text>
  <text x="48" y="320" font-family="Courier Prime" font-size="34">${MARIA_MEMBER_ID}</text>
  <text x="540" y="282" font-family="Atkinson Hyperlegible" font-size="22" fill="#333">Group</text>
  <text x="540" y="320" font-family="Courier Prime" font-size="34">77120</text>
  <text x="48" y="384" font-family="Atkinson Hyperlegible" font-size="22" fill="#333">Plan</text>
  <text x="48" y="420" font-family="Atkinson Hyperlegible" font-weight="700" font-size="30">${esc(PAYER_RULES.plan_id)}</text>
  <text x="540" y="384" font-family="Atkinson Hyperlegible" font-size="22" fill="#333">Copays</text>
  <text x="540" y="420" font-family="Atkinson Hyperlegible" font-size="26">PCP $20   Specialist $${PAYER_RULES.specialist_copay_cents / 100}   ER $250</text>
  <text x="48" y="500" font-family="Atkinson Hyperlegible" font-size="20" fill="#333">Member services (555) 010-0190   Prior authorization (555) 010-0191</text>
  <text x="506" y="590" text-anchor="middle" font-family="Atkinson Hyperlegible" font-weight="700" font-size="22" fill="#9aa">${WATERMARK}</text>
</svg>`;
}

export interface MariaDocuments {
  referralFaxPng: Buffer;
  referralFaxPdf: Buffer;
  insuranceCardPng: Buffer;
}

/**
 * Maria's intake documents (spec 10.1, `documents.ts`): the referral as a one-page fax PDF
 * (an image page, as faxes are), the same page as a PNG, and the insurance card. They look
 * like documents without imitating any real clinic or insurer, and say they are synthetic.
 */
export async function generateMariaDocuments(seed: number): Promise<MariaDocuments> {
  const referralFaxPng = await faxify(render(referralSvg(), 1200), seed, "referral");
  const pdf = await PDFDocument.create();
  pdf.setTitle("Referral, synthetic sample");
  pdf.setProducer("Throughline synthetic documents");
  const page = pdf.addPage([612, 792]);
  const image = await pdf.embedPng(referralFaxPng);
  page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
  const referralFaxPdf = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const insuranceCardPng = await sharp(render(cardSvg(), 1012)).png().toBuffer();
  return { referralFaxPng, referralFaxPdf, insuranceCardPng };
}
