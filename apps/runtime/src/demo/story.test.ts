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
    const ctx = createContext({ OPS_AUTOPILOT: "off" }, { databasePath: ":memory:" });
    const app = createApp(ctx);
    await app.request("/api/story/goto", post({ step: "fax" }));
    const states: Record<string, Journey> = {};
    for (const step of STORY_STEPS) {
      states[step] = ctx.runtime.journey("maria-001") as Journey;
      await app.request("/api/story/act", post());
    }
    states.closed = ctx.runtime.journey("maria-001") as Journey;
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
    // One lab stop for blood drawn together.
    expect(states.after?.itinerary?.stops.filter((s) => s.station_id === "lab_draw")).toHaveLength(
      1,
    );
    // After the visit: follow-ups booked, the summary waits for Dr. Okafor (PRE_APPROVAL).
    expect(states.after?.state).toBe("SUMMARY_DRAFTED");
    expect(states.after?.paused_for_review).toBe(true);
    const followUps = states.after?.appointments.filter((a) => a.order_id.startsWith("o-fu-"));
    expect(followUps?.map((a) => a.start.slice(0, 10))).toEqual(["2026-12-07", "2026-12-09"]);
    expect(states.teachback?.summary).toMatchObject({
      reviewed_by: "Dr. Okafor",
      disclaimer_mode: false,
    });
    expect(states.teachback?.state).toBe("TEACHBACK_PENDING");
    // Results were acknowledged the next morning; one teach-back answer unsure, so a nurse calls.
    expect(states.checkin?.teachback?.passed).toBe(false);
    expect(states.checkin?.teachback?.answers).toMatchObject({ who_to_call: "not_sure" });
    expect(states.checkin?.orders.some((o) => o.status === "resulted")).toBe(false);
    expect(
      ctx.store
        .reviews("pending")
        .some((r) => r.kind === "task" && r.reason.includes("who to call")),
    ).toBe(true);
    expect(states.closed?.state).toBe("REFERRAL_CLOSED");
    expect(states.closed?.phase).toBe("COMPLETED");
    const closed = ctx.store.events().find((e) => e.event.type === "ReferralClosed")?.event;
    expect(JSON.stringify(closed?.payload)).toContain("Nurse call after the teach-back");
    expect(JSON.stringify(closed?.payload)).toContain('"CMP"');
  }, 60_000);

  it("goes straight to a step by replaying the actions before it", async () => {
    const ctx = createContext({ OPS_AUTOPILOT: "off" }, { databasePath: ":memory:" });
    const app = createApp(ctx);
    const res = await app.request("/api/story/goto", post({ step: "decide" }));
    expect(((await res.json()) as { step: string }).step).toBe("decide");
    expect(ctx.store.reviews("pending").some((r) => r.capability === "ops_action.apply")).toBe(
      true,
    );
  }, 60_000);
});
