import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateMariaDocuments, MARIA_MEMBER_ID, MARIA_REFERRAL } from "./documents";

describe("intake documents (D3-1)", () => {
  it("renders a one-page fax PDF, the fax image, and the card, deterministically", async () => {
    const a = await generateMariaDocuments(1104);
    const b = await generateMariaDocuments(1104);
    expect(a.referralFaxPng.equals(b.referralFaxPng)).toBe(true);
    const pdf = await PDFDocument.load(a.referralFaxPdf);
    expect(pdf.getPageCount()).toBe(1);
    expect(a.insuranceCardPng.subarray(1, 4).toString()).toBe("PNG");
  });

  it("hides the member id suffix on the fax but prints it on the card", () => {
    expect(MARIA_REFERRAL.insurance.member_id_visible.endsWith("-")).toBe(true);
    expect(MARIA_MEMBER_ID.startsWith(MARIA_REFERRAL.insurance.member_id_visible)).toBe(true);
  });
});
