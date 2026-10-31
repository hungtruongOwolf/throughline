import type { AgentDescriptor } from "../../core/agent";

export const resultsWatcherDescriptor: AgentDescriptor = {
  name: "results_watcher",
  capabilities: ["result.watch", "result_ack.track"],
  // Status only, never reads values; no model call (spec 6, 11.1).
  risk: "LOW",
};
