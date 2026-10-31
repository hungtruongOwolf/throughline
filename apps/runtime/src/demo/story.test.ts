import { describe, expect, it } from "vitest";
import type { Journey } from "@throughline/shared";
import { createApp } from "../app";
import { createContext } from "../context";
import { STORY_STEPS } from "./story";

const post = (body: unknown = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("Maria's story: one journey, one data set", () => {
  it("plays the referral to checkout on the same journey, with the visit booked as one morning", async () => {
    const ctx = createContext({}, { databasePath: ":memory:" });
    const app = createApp(ctx);
    await app.request("/api/story/goto", post({ step: "fax" }));
    const states: Record<string, Journey> = {};
    for (const step of STORY_STEPS) {
      states[step] = ctx.runtime.journey("maria-001") as Journey;
      await app.request("/api/story/act", post());
    }
    expect(states.fax?.state).toBe("CLARIFICATION_NEEDED");
    expect(states.auth?.paused_for_review).toBe(true);
    expect(states.confirm?.visit_days).toEqual(["2026-11-17"]);
    expect(states.day_before?.state).toBe("CONFIRMED");
    expect(states.day_before?.memory.mobility).toBe("wheelchair");
    // The CT outage hits Maria while she waits for her 10:00 scan on CT 1.
    const ct = states.outage?.itinerary?.stops.find((s) => s.station_id === "imaging_ct");
    expect(ct).toMatchObject({ node_id: "mp2.ct1", status: "waiting" });
    expect(ctx.store.events().some((e) => e.event.type === "OpsActionApplied")).toBe(true);
    const moved = states.changed?.itinerary?.stops.find((s) => s.station_id === "imaging_ct");
    expect(moved?.node_id).toBe("mp2.ct2");
    expect(states.after?.state).toBe("CHECKED_OUT");
    // One lab stop for blood drawn together.
    expect(states.after?.itinerary?.stops.filter((s) => s.station_id === "lab_draw")).toHaveLength(
      1,
    );
  }, 60_000);

  it("goes straight to a step by replaying the actions before it", async () => {
    const ctx = createContext({}, { databasePath: ":memory:" });
    const app = createApp(ctx);
    const res = await app.request("/api/story/goto", post({ step: "decide" }));
    expect(((await res.json()) as { step: string }).step).toBe("decide");
    expect(ctx.store.reviews("pending").some((r) => r.capability === "ops_action.apply")).toBe(
      true,
    );
  }, 60_000);
});
