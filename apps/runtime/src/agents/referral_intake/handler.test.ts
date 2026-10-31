import { describe, expect, it } from "vitest";
import { AgentRunner } from "../../core/agent-runner";
import type { HandlerContext } from "../../core/agent";
import { createJourney } from "../../core/journeys";
import { MARIA_DOCUMENTS } from "../../demo/referral";
import { ScriptedGateway } from "../../test/harness";
import { createReferralIntakeAgent } from "./handler";

const reading = {
  patient_name: "Maria Diaz",
  dob: "1955-03-08",
  phone: "+1 555 0101",
  language: "en",
  // Spark writes the word "null" for the smudged ID now and then; it still means unread.
  member_id: "null",
  referring_provider: "Hannah Whitcombe, MD",
  services: ["CBC w/ diff", "CMP"],
  diagnosis_code_as_written: "C34.90",
  urgency_as_written: "Routine, within 2 weeks",
  missing_fields: ["member_id"],
};

describe("referral intake", () => {
  it("sends the fax image to Spark and asks a coordinator for the unread member ID", async () => {
    const gateway = new ScriptedGateway([
      [
        {
          type: "function_call",
          call_id: "c1",
          name: "submit_referral_packet",
          arguments: JSON.stringify(reading),
        },
      ],
    ]);
    const runner = new AgentRunner(gateway, () => {});
    const journey = createJourney({
      id: "maria-001",
      patient: {
        id: "pt-001",
        display_name: "New referral",
        dob: "1900-01-01",
        language: "en",
        mobility: "walking",
        phone_sim: "+1 555 0101",
      },
      referring_provider: "",
      service_requested: "",
      now: "2026-11-10T08:05:00-06:00",
    });
    const ctx = {
      event: { type: "ReferralReceived", payload: { documents: MARIA_DOCUMENTS } },
      capability: "referral.extract",
      now: "2026-11-10T08:05:00-06:00",
      journey,
    } as unknown as HandlerContext;

    const { result, usedFallback } = await runner.run(createReferralIntakeAgent() as never, ctx);

    expect(usedFallback).toBe(false);
    expect(result.next_events[0]).toMatchObject({
      type: "ClarificationNeeded",
      payload: { field: "member_id" },
    });
    const user = gateway.requests[0]?.input[1];
    const parts = user && "role" in user && Array.isArray(user.content) ? user.content : [];
    // Only the fax is read; the insurance card is for the coordinator.
    expect(parts.filter((p) => p.type === "input_image")).toHaveLength(1);
  });
});
