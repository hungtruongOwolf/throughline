import { describe, expect, it } from "vitest";
import { harness, mockAgents, ScriptedGateway } from "../../test/harness";
import { createMessengerAgent } from "./handler";

describe("messenger reply model", () => {
  it("a clinical reply the keyword lists miss still goes to a nurse when Spark says clinical", async () => {
    const gateway = new ScriptedGateway([
      [
        {
          type: "function_call",
          call_id: "c1",
          name: "handle_reply",
          arguments: JSON.stringify({ intent: "clinical", memory_updates: [] }),
        },
      ],
    ]);
    const h = harness({
      agents: mockAgents({ messenger: createMessengerAgent() as never }),
      gateway,
    });
    h.newJourney();
    await h.ingest({
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: {
        channel: "sms_sim",
        text: "My arm feels funny where the IV went in",
        language: "en",
      },
    });
    expect(gateway.requests).toHaveLength(1);
    expect(h.types()).toContain("HandoffRequested");
    expect(h.types()).not.toContain("ReplyHandled");
    expect(h.store.reviews("pending")[0]).toMatchObject({ kind: "handoff", agent: "messenger" });
    expect(h.runtime.journey("maria-001")?.handoff_open).toBe(true);
  });
});
