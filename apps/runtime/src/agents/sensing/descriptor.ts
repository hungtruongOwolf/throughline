import type { AgentDescriptor } from "../../core/agent";

export const sensingDescriptor: AgentDescriptor = {
  name: "sensing",
  capabilities: ["queue.estimate", "bottleneck.detect"],
  // Counts only, no identity; frames are discarded after counting (spec 6, 11.1).
  risk: "LOW",
};
