import { describe, expect, it } from "vitest";
import type { NewEvent } from "./agent";
import { harness, mockAgents } from "../test/harness";

const referral: NewEvent = {
  type: "ReferralReceived",
  journey_id: "maria-001",
  payload: { documents: [{ id: "d1", kind: "referral_fax", uri: "x", mime: "application/pdf" }] },
};

describe("transitions (test 2)", () => {
  it("handlers move the journey only through allowed transitions", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney();
    await h.ingest(referral);
    expect(h.types()).toEqual([
      "ReferralReceived",
      "IntakeExtracted",
      "EligibilityChecked",
      "PriorAuthDrafted",
      "HumanReviewRequested",
    ]);
    expect(h.runtime.journey("maria-001")?.state).toBe("AUTH_DRAFTED");
  });

  it("an illegal transition from a handler is rejected and logged, never appended", async () => {
    const h = harness({
      agents: mockAgents({
        eligibility: {
          name: "eligibility",
          kind: "deterministic",
          capabilities: ["eligibility.check"],
          risk: "LOW",
          handle: () => ({
            summary: "bad",
            next_events: [{ type: "VisitCheckedOut", payload: {} }],
          }),
        },
      }),
    });
    h.newJourney();
    await h.ingest(referral);
    expect(h.types()).not.toContain("VisitCheckedOut");
    expect(h.store.logs().some((l) => l.entry.msg === "transition_rejected")).toBe(true);
    expect(h.runtime.journey("maria-001")?.state).toBe("INTAKE_EXTRACTED");
  });

  it("a closed journey emits nothing", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney("j-closed", { state: "REFERRAL_CLOSED", phase: "COMPLETED" });
    await h.ingest({
      type: "PatientReplied",
      journey_id: "j-closed",
      payload: { channel: "sms_sim", text: "thanks", language: "en" },
    });
    expect(h.types("j-closed")).toEqual(["PatientReplied"]);
  });
});
