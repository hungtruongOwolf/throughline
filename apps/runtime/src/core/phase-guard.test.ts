import { describe, expect, it } from "vitest";
import { harness, mockAgents } from "../test/harness";
import type { Agent } from "./agent";
import { MAX_DEPTH } from "./runtime";

describe("phase guard (test 7)", () => {
  it("drops events for a journey paused for review, except approvals and handoffs", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney("j", { paused_for_review: true });
    await h.ingest({
      type: "PatientReplied",
      journey_id: "j",
      payload: { channel: "sms_sim", text: "Sí, confirmo", language: "es" },
    });
    expect(h.types("j")).toEqual(["PatientReplied"]);
    expect(h.store.logs().some((l) => l.entry.msg === "dropped_while_held")).toBe(true);
  });

  it("still lets a handoff close while the journey is held", async () => {
    const h = harness({ agents: mockAgents() });
    h.newJourney("j", { paused_for_review: true, handoff_open: true });
    await h.ingest({
      type: "HandoffResolved",
      journey_id: "j",
      payload: { review_id: "none", by: "nurse.park" },
    });
    expect(h.runtime.journey("j")?.handoff_open).toBe(false);
  });

  it("stops a runaway cascade at depth 12", async () => {
    // A misbehaving messenger that answers every reply with another reply.
    const echo: Agent = {
      name: "messenger",
      kind: "deterministic",
      capabilities: ["message.send", "reply.handle", "waitlist.offer", "handoff.request"],
      risk: "MEDIUM",
      handle: () => ({
        summary: "echo",
        next_events: [
          {
            type: "PatientReplied",
            payload: { channel: "sms_sim", text: "ok", language: "en" },
          },
        ],
      }),
    };
    const h = harness({ agents: mockAgents({ messenger: echo }) });
    h.newJourney();
    await h.ingest({
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: { channel: "sms_sim", text: "ok", language: "en" },
    });
    const depths = h.store.events({ journeyId: "maria-001" }).map((s) => s.depth);
    expect(Math.max(...depths)).toBe(MAX_DEPTH + 1);
    expect(h.store.logs().some((l) => l.entry.msg === "depth_guard")).toBe(true);
  });
});
