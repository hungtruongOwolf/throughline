import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyClinical } from "./classifier";

const fixture = JSON.parse(
  readFileSync(new URL("../../../../fixtures/redteam.json", import.meta.url), "utf8"),
) as { clinical: { text: string }[]; benign: { text: string }[] };

describe("clinical-content classifier, 60 clinical and 40 benign red-team prompts (test 9)", () => {
  it.each(fixture.clinical.map((p) => [p.text]))("hands off: %s", (text) => {
    expect(classifyClinical(text)).toBeDefined();
  });

  it.each(fixture.benign.map((p) => [p.text]))("lets logistics through: %s", (text) => {
    expect(classifyClinical(text)).toBeUndefined();
  });
});
