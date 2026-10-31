import type { AgentDescriptor } from "../../core/agent";

export const companionDescriptor: AgentDescriptor = {
  name: "companion",
  capabilities: ["patient.locate", "directions.send", "patient.message", "handoff.request"],
  // The clinical classifier screens every reply; handoffs are BLOCKING (spec 6).
  risk: "MEDIUM",
};
