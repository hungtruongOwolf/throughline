import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DomainEvent, EVENT_TYPES } from "./events";
import { Journey } from "./journey/types";
import { assertSyntheticOnly } from "./synthetic";

describe("synthetic flag (test 15)", () => {
  it("refuses to start with SYNTHETIC_ONLY=false outside tests", () => {
    expect(() =>
      assertSyntheticOnly({ SYNTHETIC_ONLY: "false", NODE_ENV: "production" }),
    ).toThrow();
    expect(() =>
      assertSyntheticOnly({ SYNTHETIC_ONLY: "false", NODE_ENV: "development" }),
    ).toThrow();
  });

  it("starts with SYNTHETIC_ONLY=true, unset, or inside tests", () => {
    expect(() => assertSyntheticOnly({ SYNTHETIC_ONLY: "true" })).not.toThrow();
    expect(() => assertSyntheticOnly({})).not.toThrow();
    expect(() => assertSyntheticOnly({ SYNTHETIC_ONLY: "false", NODE_ENV: "test" })).not.toThrow();
  });

  it("the Journey aggregate requires synthetic: true", () => {
    expect(Journey.shape.synthetic).toBeInstanceOf(z.ZodLiteral);
    expect(Journey.shape.synthetic.safeParse(false).success).toBe(false);
  });

  it("every event type requires synthetic: true", () => {
    for (const type of EVENT_TYPES) {
      const r = DomainEvent.safeParse({
        id: "e",
        type,
        occurred_at: "2026-11-17T09:00:00-06:00",
        journey_id: "j",
        station_id: "imaging_ct",
        synthetic: false,
        payload: {},
      });
      expect(r.success, type).toBe(false);
      const issues = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
      expect(issues, type).toContain("synthetic");
    }
  });
});
