import { describe, expect, it } from "vitest";
import type { DomainEvent, HumanReview, Journey } from "@throughline/shared";
import { createApp } from "../../app";
import { createContext } from "../../context";

async function outage() {
  const ctx = createContext({}, { databasePath: ":memory:" });
  const app = createApp(ctx);
  await app.request("/api/demo/visit-day?beat=ct_outage", { method: "POST" });
  return { ctx, app };
}

describe("ops loop: bottleneck → what-if proposal → approval → replan (spec V8)", () => {
  it("proposes the CT 2 action with engine evidence and holds it for a manager", async () => {
    const { ctx } = await outage();
    const [review] = ctx.store.reviews("pending");
    expect(review).toMatchObject({
      kind: "approval",
      capability: "ops_action.apply",
      agent: "ops",
    });
    const proposed = review?.pending_event as Extract<DomainEvent, { type: "OpsActionProposed" }>;
    const action = proposed.payload.action;
    expect(action.title).toContain("CT 2");
    expect(action.predicted_effect.wait_after_min).toBeLessThan(
      action.predicted_effect.wait_before_min,
    );
    expect(action.evidence).toMatchObject({ replicates: 20, horizon_min: 90 });
    expect(ctx.runtime.station("imaging_ct").paused_for_review).toBe(true);
  });

  it("approval applies the action and re-plans Maria onto CT 2", async () => {
    const { ctx, app } = await outage();
    const [review] = ctx.store.reviews("pending");
    const res = await app.request(`/api/reviews/${review?.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved", by: "manager.ito" }),
    });
    expect(((await res.json()) as HumanReview).status).toBe("resolved");

    const station = ctx.store.events({ stationId: "imaging_ct" }).map((s) => s.event);
    const applied = station.find((e) => e.type === "OpsActionApplied") as Extract<
      DomainEvent,
      { type: "OpsActionApplied" }
    >;
    expect(applied.payload.affected_journey_ids).toEqual(["maria-001"]);

    const replanned = ctx.store
      .events({ journeyId: "maria-001" })
      .map((s) => s.event)
      .find((e) => e.type === "ItineraryReplanned") as Extract<
      DomainEvent,
      { type: "ItineraryReplanned" }
    >;
    expect(replanned.payload.diff).toContainEqual(
      expect.objectContaining({ order_id: "o-ct", change: "swapped_station", to: "mp2.ct2" }),
    );
    const journey = ctx.runtime.journey("maria-001") as Journey;
    expect(journey.itinerary?.stops.find((s) => s.order_id === "o-ct")?.node_id).toBe("mp2.ct2");
    expect(journey.kpis.replans).toBe(1);
    expect(ctx.runtime.station("imaging_ct")).toMatchObject({
      open_servers: 2,
      paused_for_review: false,
    });
  });

  it("a rejection leaves Maria's plan alone", async () => {
    const { ctx } = await outage();
    const [review] = ctx.store.reviews("pending");
    await ctx.runtime.resolve(review?.id ?? "", "rejected", "manager.ito");
    expect(ctx.store.events({ journeyId: "maria-001" }).map((s) => s.event.type)).not.toContain(
      "ItineraryReplanned",
    );
  });
});
