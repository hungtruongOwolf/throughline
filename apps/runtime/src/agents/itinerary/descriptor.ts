import type { AgentDescriptor } from "../../core/agent";

export const itineraryDescriptor: AgentDescriptor = {
  name: "itinerary",
  capabilities: ["itinerary.plan", "itinerary.replan"],
  risk: "LOW",
};
