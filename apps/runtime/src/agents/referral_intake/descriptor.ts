import type { AgentDescriptor } from "../../core/agent";

export const referralIntakeDescriptor: AgentDescriptor = {
  name: "referral_intake",
  capabilities: ["referral.extract", "referral.clarify"],
  // Attribute extraction only, never identity search (spec 6, 11.1).
  risk: "MEDIUM",
};
