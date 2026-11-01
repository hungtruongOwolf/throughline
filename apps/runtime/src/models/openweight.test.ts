import { describe, expect, it } from "vitest";
import { ScriptedGateway } from "../test/harness";
import { BrainRouter } from "./openweight";
import type { ModelRequest } from "./types";

const request = (capability: ModelRequest["capability"]): ModelRequest => ({
  capability,
  input: [{ role: "user", content: "hi" }],
  tools: [],
  effort: "low",
  maxOutputTokens: 100,
  phiProbe: "hi",
});

describe("ops brain switch (D4-4)", () => {
  it("sends only ops proposals to the open-weight brain, and only when it is on", async () => {
    const meta = new ScriptedGateway([]);
    const open = new ScriptedGateway([]);
    let brain: "cloud" | "open" = "open";
    const router = new BrainRouter(meta, open, () => brain);
    await router.respond(request("ops_action.propose"));
    await router.respond(request("patient.message"));
    brain = "cloud";
    await router.respond(request("ops_action.propose"));
    expect(open.requests.map((r) => r.capability)).toEqual(["ops_action.propose"]);
    expect(meta.requests.map((r) => r.capability)).toEqual([
      "patient.message",
      "ops_action.propose",
    ]);
  });
});
