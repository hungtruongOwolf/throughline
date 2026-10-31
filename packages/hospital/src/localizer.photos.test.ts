import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { campus } from "./index";
import { localize } from "./localizer";

interface Reading {
  file: string;
  node_id: string;
  heading: string[];
  directions: string[];
}

/** Spark's readings of the 30 rendered sign photos, recorded live (packages/synthetic/signs). */
const { readings } = JSON.parse(
  readFileSync(new URL("../../../fixtures/sign-readings.json", import.meta.url), "utf8"),
) as { readings: Reading[] };

describe("sign photo localization (test 22)", () => {
  const results = readings.map((r) => ({
    ...r,
    found: localize(r.heading.join(" "), campus.signs).node_id,
  }));

  it("covers 30 photos", () => {
    expect(readings).toHaveLength(30);
  });

  it("maps at least 28 of 30 photos to the right node", () => {
    const right = results.filter((r) => r.found === r.node_id);
    expect(
      right.length,
      JSON.stringify(results.filter((r) => r.found !== r.node_id)),
    ).toBeGreaterThanOrEqual(28);
  });

  it("returns unknown rather than a wrong node", () => {
    const wrong = results.filter((r) => r.found !== r.node_id && r.found !== "unknown");
    expect(wrong).toEqual([]);
  });
});
