import { describe, expect, it } from "vitest";
import { loadEngine } from "@throughline/engine/node";
import type { Journey } from "@throughline/shared";
import { createContext } from "../context";
import { SCENARIO_JOURNEY, VisitDayScenario } from "./scenario";

describe("visit-day scenario (D2-9)", () => {
  it("plays 09:12 to checkout with the outage, one approval, a lost nudge, a sign photo, results, and a handoff", async () => {
    const ctx = createContext({}, { databasePath: ":memory:" });
    const scenario = new VisitDayScenario({ ...ctx, engine: loadEngine() }, { autopilot: true });
    await scenario.start();
    await ctx.clock.advanceTo("2026-11-17T16:00:00-06:00");
    await ctx.bus.idle();

    const journey = ctx.runtime.journey(SCENARIO_JOURNEY) as Journey;
    const types = ctx.store.events({ journeyId: SCENARIO_JOURNEY }).map((e) => e.event.type);
    const ops = ctx.store.events({ stationId: "imaging_ct" }).map((e) => e.event.type);
    const count = (t: string) => types.filter((x) => x === t).length;
    const summary = {
      done: scenario.done,
      state: journey.state,
      replans: journey.kpis.replans,
      planned: journey.kpis.planned_minutes_on_site,
      actual: journey.kpis.actual_minutes_on_site,
      directions: journey.kpis.direction_requests,
      lost: count("PatientLost"),
      located: count("DirectionsSent"),
      results: count("ResultReady"),
      handoffs: count("HandoffRequested"),
      proposals: ops.filter((t) => t === "OpsActionProposed").length,
      applied: ops.filter((t) => t === "OpsActionApplied").length,
      ct: journey.itinerary?.stops.find((s) => s.order_id === "o-ct")?.node_id,
    };
    expect(summary).toMatchObject({
      done: true,
      state: "CHECKED_OUT",
      lost: 1,
      located: 1,
      results: 1,
      handoffs: 1,
      ct: "mp2.ct2",
    });
    // The CT 1 outage raises the first proposal; a later busy spell may raise another.
    const firstProposal = ctx.store
      .events({ stationId: "imaging_ct" })
      .find((e) => e.event.type === "OpsActionProposed");
    expect((firstProposal?.event.occurred_at ?? "").slice(11, 16) <= "09:50").toBe(true);
    expect(summary.applied).toBe(summary.proposals);
    expect(summary.replans).toBeGreaterThanOrEqual(1);
    expect(ctx.store.reviews("pending")).toEqual([]);
  }, 120_000);
});
