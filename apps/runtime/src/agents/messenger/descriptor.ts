import type { AgentDescriptor } from "../../core/agent";

export const messengerDescriptor: AgentDescriptor = {
  name: "messenger",
  capabilities: ["message.send", "reply.handle", "waitlist.offer", "handoff.request"],
  // Symptom content becomes a BLOCKING nurse handoff (spec B7).
  risk: "MEDIUM",
};
