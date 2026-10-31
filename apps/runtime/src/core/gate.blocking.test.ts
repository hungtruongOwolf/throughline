import { describe, expect, it } from "vitest";
import { harness, mockAgents } from "../test/harness";

describe("BLOCKING handoff (test 4)", () => {
  it("runs the handoff, opens a review, and propagates only HumanReviewRequested", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney();
    await h.ingest({
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: { channel: "voice_sim", transcript: "Me duele el pecho desde ayer", language: "es" },
    });
    // The handler's events are in the log for audit...
    expect(h.types()).toEqual([
      "PatientReplied",
      "HandoffRequested",
      "MemoryUpdated",
      "HumanReviewRequested",
    ]);
    // ...but only the review request was published downstream.
    expect(h.published).toEqual(["PatientReplied", "HumanReviewRequested"]);
    expect(h.types()).not.toContain("ReplyHandled");
    const [review] = h.store.reviews("pending");
    expect(review).toMatchObject({
      kind: "handoff",
      capability: "handoff.request",
      agent: "messenger",
    });
    expect(h.runtime.journey("maria-001")?.handoff_open).toBe(true);
  });

  it("HandoffResolved closes the handoff", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney();
    await h.ingest({
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: { channel: "sms_sim", text: "is this normal? I feel dizzy", language: "en" },
    });
    const review = h.store.reviews("pending")[0];
    await h.ingest({
      type: "HandoffResolved",
      journey_id: "maria-001",
      payload: { review_id: review?.id ?? "", by: "nurse.park" },
    });
    expect(h.runtime.journey("maria-001")?.handoff_open).toBe(false);
    expect(h.store.review(review?.id ?? "")?.status).toBe("resolved");
  });

  it("logistics replies go to intent handling, not to a nurse", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney();
    await h.ingest({
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: { channel: "sms_sim", text: "Sí, confirmo", language: "es" },
    });
    expect(h.types()).toContain("ReplyHandled");
    expect(h.store.reviews()).toEqual([]);
  });
});
