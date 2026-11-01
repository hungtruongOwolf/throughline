// Writes every referral's intake documents and its extraction ground truth (spec 10.1):
// the referral book (REFERRALS) and the faxes waiting on the fax line (FAX_LINE).
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_SEED, FAX_LINE, REFERRALS } from "../src/index";
import { documentPrefix, generateReferralDocuments, referralAsWritten } from "../src/documents";

const out = fileURLToPath(new URL("../../../fixtures/documents/", import.meta.url));
mkdirSync(out, { recursive: true });
const seed = Number(process.env.SEED ?? DEFAULT_SEED);
for (const spec of [...REFERRALS, ...FAX_LINE]) {
  const docs = await generateReferralDocuments(spec, seed);
  const prefix = documentPrefix(spec);
  writeFileSync(`${out}${prefix}-referral-fax.png`, docs.referralFaxPng);
  writeFileSync(`${out}${prefix}-insurance-card.png`, docs.insuranceCardPng);
  // The PDF is the original fax; only Maria's is kept in the repo (the PNG is what intake reads).
  if (prefix === "maria") writeFileSync(`${out}${prefix}-referral-fax.pdf`, docs.referralFaxPdf);
  writeFileSync(
    `${out}${prefix}-truth.json`,
    `${JSON.stringify(
      {
        synthetic: true,
        referral: referralAsWritten(spec),
        card_member_id: spec.memberId,
        expected_missing_fields: spec.smudged ? ["member_id"] : [],
      },
      null,
      2,
    )}\n`,
  );
}
console.log(`wrote documents for ${REFERRALS.length + FAX_LINE.length} referrals to fixtures/documents/`);
