import { describe, expect, it } from "vitest";
import type { DomainEvent } from "@throughline/shared";
import type { NewEvent } from "./agent";
import { harness, mockAgents } from "../test/harness";
import type { Agent } from "./agent";

const referral: NewEvent = {
  type: "ReferralReceived",
  journey_id: "maria-001",
  payload: { documents: [{ id: "d1", kind: "referral_fax", uri: "x", mime: "application/pdf" }] },
};

describe("PRE_APPROVAL park and replay (test 3)", () => {
  it("parks prior_auth.submit verbatim, holds the journey, and asks for review", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney();
    await h.ingest(referral);
    const [review] = h.store.reviews("pending");
    const drafted = h.store
      .events({ journeyId: "maria-001" })
      .find((s) => s.event.type === "PriorAuthDrafted");
    expect(review?.capability).toBe("prior_auth.submit");
    expect(review?.kind).toBe("approval");
    expect(review?.pending_event).toEqual(drafted?.event);
    expect(h.runtime.journey("maria-001")?.paused_for_review).toBe(true);
    expect(h.published).toContain("HumanReviewRequested");
    expect(h.types()).not.toContain("PriorAuthSubmitted");
  });

  it("replays the parked event with approved_by after approval", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney();
    await h.ingest(referral);
    const review = h.store.reviews("pending")[0];
    await h.ingest({
      type: "HumanReviewResolved",
      journey_id: "maria-001",
      payload: { review_id: review?.id ?? "", decision: "approved", by: "coordinator.lee" },
    });
    const submitted = h.store
      .events({ journeyId: "maria-001" })
      .find((s) => s.event.type === "PriorAuthSubmitted")?.event as Extract<
      DomainEvent,
      { type: "PriorAuthSubmitted" }
    >;
    expect(submitted.payload.by).toBe("coordinator.lee");
    expect(h.runtime.journey("maria-001")).toMatchObject({
      paused_for_review: false,
      state: "AUTH_SUBMITTED",
    });
    expect(h.store.review(review?.id ?? "")?.status).toBe("resolved");
  });

  it("a rejection discards the parked event and records who rejected it", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney();
    await h.ingest(referral);
    const review = h.store.reviews("pending")[0];
    await h.runtime.resolve(review?.id ?? "", "rejected", "coordinator.lee");
    expect(h.types()).not.toContain("PriorAuthSubmitted");
    expect(h.store.review(review?.id ?? "")).toMatchObject({
      status: "rejected",
      resolved_by: "coordinator.lee",
    });
    expect(h.runtime.journey("maria-001")?.paused_for_review).toBe(false);
  });

  it("ops_action.apply parks on the station and resumes on OpsActionApproved", async () => {
    const applied: string[] = [];
    const ops: Agent = {
      name: "ops",
      kind: "deterministic",
      capabilities: ["ops_action.propose", "ops_action.apply"],
      risk: "HIGH",
      handle: (ctx) => {
        applied.push(ctx.approved_by ?? "-");
        return {
          summary: "applied",
          next_events: [
            { type: "OpsActionApplied", payload: { action_id: "a1", affected_journey_ids: [] } },
          ],
        };
      },
    };
    const h = harness({ agents: mockAgents({ ops }) });
    await h.ingest({
      type: "OpsActionProposed",
      station_id: "imaging_ct",
      payload: {
        action: {
          id: "a1",
          kind: "divert",
          params: { count: 3 },
          title: "Move 3 CT 1 patients to CT 2",
          predicted_effect: {
            station_id: "imaging_ct",
            wait_before_min: 22,
            wait_after_min: 13,
            affected_journeys: 4,
          },
          evidence: { run_id: "sim-1", seed: 1104, replicates: 20, horizon_min: 90 },
          status: "proposed",
        },
      },
    });
    expect(applied).toEqual([]);
    expect(h.runtime.station("imaging_ct").paused_for_review).toBe(true);
    await h.ingest({
      type: "OpsActionApproved",
      station_id: "imaging_ct",
      payload: { action_id: "a1", by: "manager.ito" },
    });
    expect(applied).toEqual(["manager.ito"]);
    expect(h.store.events({ stationId: "imaging_ct" }).map((s) => s.event.type)).toContain(
      "OpsActionApplied",
    );
  });

  it("summary.send is gated only when provider review is on", async () => {
    for (const providerReviewOn of [true, false]) {
      const sent: string[] = [];
      const discharge: Agent = {
        name: "discharge",
        kind: "deterministic",
        capabilities: ["summary.draft", "summary.send", "teachback.run"],
        risk: "HIGH",
        handle: (ctx) => {
          sent.push(ctx.capability);
          return { summary: "ok", next_events: [] };
        },
      };
      const h = harness({ agents: mockAgents({ discharge }), providerReviewOn });
      h.newJourney("j", { state: "CHECKED_OUT", phase: "VISIT" });
      await h.ingest({ type: "SummaryDrafted", journey_id: "j", payload: { sections: 3 } });
      expect(sent.includes("summary.send")).toBe(!providerReviewOn);
    }
  });
});
