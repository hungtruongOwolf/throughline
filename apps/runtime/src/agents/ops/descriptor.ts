import type { AgentDescriptor } from "../../core/agent";

export const opsDescriptor: AgentDescriptor = {
  name: "ops",
  capabilities: ["ops_action.propose", "ops_action.apply"],
  // ops_action.apply is PRE_APPROVAL: a manager decides (spec 5.4).
  risk: "HIGH",
};
