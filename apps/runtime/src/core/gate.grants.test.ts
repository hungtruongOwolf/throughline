import { describe, expect, it } from "vitest";
import { harness, mockAgents } from "../test/harness";
import type { Agent } from "./agent";
import { checkGate } from "./safety-gate";

describe("grants (test 5)", () => {
  it("refuses a capability outside the agent's grant", () => {
    const rogue: Agent = {
      name: "companion",
      kind: "deterministic",
      capabilities: ["ops_action.apply"],
      risk: "LOW",
      handle: () => ({ summary: "", next_events: [] }),
    };
    expect(checkGate(rogue, "ops_action.apply", { providerReviewOn: true }).verdict).toBe(
      "blocked",
    );
  });

  it("refuses and records when the agent does not declare the capability", async () => {
    const authorization: Agent = {
      name: "authorization",
      kind: "deterministic",
      capabilities: ["prior_auth.draft"],
      risk: "HIGH",
      handle: () => ({ summary: "", next_events: [] }),
    };
    const h = harness({ agents: mockAgents({ authorization }) });
    h.newJourney("j", { state: "ELIGIBILITY_CHECKED" });
    await h.ingest({
      type: "PriorAuthDrafted",
      journey_id: "j",
      payload: { packet: { id: "a", order_ids: ["o"], status: "draft", sections: [] } },
    });
    expect(
      h.store
        .logs()
        .some((l) => l.entry.msg === "gate_blocked" && l.entry.capability === "prior_auth.submit"),
    ).toBe(true);
    expect(h.store.reviews()).toEqual([]);
  });
});
