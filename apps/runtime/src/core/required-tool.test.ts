import { describe, expect, it } from "vitest";
import { z } from "zod";
import { harness, mockAgents, PACKET, ScriptedGateway } from "../test/harness";
import type { ModelOutputItem } from "../models/types";
import type { ModelAgent } from "./agent";

const Args = z.object({ display_name: z.string().min(1) });

function intakeAgent(fallbacks: string[]): ModelAgent<z.infer<typeof Args>> {
  return {
    name: "referral_intake",
    kind: "model",
    capabilities: ["referral.extract", "referral.clarify"],
    risk: "MEDIUM",
    model: {
      system: "You are Throughline.",
      input: () => "Extract the referral.",
      tools: [],
      readTools: { get_documents: () => ({ documents: ["fax"] }) },
      readSchemas: { get_documents: z.object({}) },
      requiredTool: "submit_referral_packet",
      requiredSchema: Args,
      effort: "medium",
      maxSteps: 4,
      maxOutputTokens: 500,
      apply: (args) => ({
        summary: `extracted ${args.display_name}`,
        next_events: [{ type: "IntakeExtracted", payload: { packet: structuredClone(PACKET) } }],
      }),
    },
    fallback: () => {
      fallbacks.push("fallback");
      return {
        summary: "clarify",
        next_events: [
          { type: "ClarificationNeeded", payload: { question: "Member id?", field: "member_id" } },
        ],
      };
    },
  };
}

const call = (name: string, args: unknown, id = name): ModelOutputItem => ({
  type: "function_call",
  call_id: id,
  name,
  arguments: JSON.stringify(args),
});

async function run(script: ModelOutputItem[][]) {
  const fallbacks: string[] = [];
  const gateway = new ScriptedGateway(script);
  const h = harness({
    agents: mockAgents({ referral_intake: intakeAgent(fallbacks) as never }),
    gateway,
  });
  h.newJourney();
  await h.ingest({
    type: "ReferralReceived",
    journey_id: "maria-001",
    payload: { documents: [{ id: "d1", kind: "referral_fax", uri: "x", mime: "application/pdf" }] },
  });
  return { h, gateway, fallbacks };
}

describe("required tool (test 6)", () => {
  it("a loop that never calls the required tool is retried once, then falls back", async () => {
    const { h, gateway, fallbacks } = await run([
      [{ type: "message", text: "done" }],
      [{ type: "message", text: "done again" }],
    ]);
    expect(gateway.requests).toHaveLength(2);
    expect(JSON.stringify(gateway.requests[1]?.input)).toContain("required tool missing");
    expect(fallbacks).toEqual(["fallback"]);
    expect(h.types()).toContain("ClarificationNeeded");
    expect(h.store.modelCalls().some((r) => r.used_fallback)).toBe(true);
  });

  it("calling the required tool twice fails validation and triggers the retry", async () => {
    const { h, gateway, fallbacks } = await run([
      [
        call("submit_referral_packet", { display_name: "Maria Diaz" }, "c1"),
        call("submit_referral_packet", { display_name: "Maria Diaz" }, "c2"),
      ],
      [call("submit_referral_packet", { display_name: "Maria Diaz" })],
    ]);
    expect(gateway.requests).toHaveLength(2);
    expect(JSON.stringify(gateway.requests[1]?.input)).toContain("duplicated");
    expect(fallbacks).toEqual([]);
    expect(h.types()).toContain("IntakeExtracted");
  });

  it("invalid arguments go back to the model as a function_call_output error", async () => {
    const { h, gateway } = await run([
      [call("get_documents", {})],
      [call("submit_referral_packet", { display_name: "" }, "bad")],
      [call("submit_referral_packet", { display_name: "Maria Diaz" }, "good")],
    ]);
    const third = gateway.requests[2]?.input ?? [];
    const errorOutput = third.find(
      (i) => "type" in i && i.type === "function_call_output" && i.call_id === "bad",
    );
    expect(errorOutput && "output" in errorOutput ? errorOutput.output : "").toContain("error");
    const docs = third.find(
      (i) => "type" in i && i.type === "function_call_output" && i.call_id === "get_documents",
    );
    expect(docs && "output" in docs ? docs.output : "").toContain("fax");
    expect(h.types()).toContain("IntakeExtracted");
    const records = h.store.modelCalls();
    expect(records).toHaveLength(3);
    expect(records.map((r) => r.required_tool_valid)).toEqual([undefined, false, true]);
  });
});
