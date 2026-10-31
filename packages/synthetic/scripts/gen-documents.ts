// Writes Maria's intake documents and the extraction ground truth (spec 10.1, D3-1).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SEED } from "../src/index";
import { generateMariaDocuments, MARIA_MEMBER_ID, MARIA_REFERRAL } from "../src/documents";

const out = fileURLToPath(new URL("../../../fixtures/documents/", import.meta.url));
mkdirSync(out, { recursive: true });
const docs = await generateMariaDocuments(Number(process.env.SEED ?? DEFAULT_SEED));
writeFileSync(`${out}maria-referral-fax.pdf`, docs.referralFaxPdf);
writeFileSync(`${out}maria-referral-fax.png`, docs.referralFaxPng);
writeFileSync(`${out}maria-insurance-card.png`, docs.insuranceCardPng);
writeFileSync(
  `${out}maria-truth.json`,
  `${JSON.stringify({ synthetic: true, referral: MARIA_REFERRAL, card_member_id: MARIA_MEMBER_ID, expected_missing_fields: ["member_id"] }, null, 2)}\n`,
);
console.log(
  `wrote 3 documents and the ground truth to fixtures/documents/ (pdf ${(docs.referralFaxPdf.length / 1024).toFixed(0)} KB)`,
);
