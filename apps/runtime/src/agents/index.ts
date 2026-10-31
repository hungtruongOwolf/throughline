import type { Engine } from "@throughline/engine/node";
import type { Journey, SimRequest, StationId } from "@throughline/shared";
import type { Agent, StationState } from "../core/agent";
import { createItineraryAgent } from "./itinerary/handler";
import { createOpsAgent } from "./ops/handler";
import { createSensingAgent } from "./sensing/handler";
import { createCompanionAgent } from "./companion/handler";
import { createMessengerAgent } from "./messenger/handler";
import { createResultsWatcherAgent } from "./results_watcher/handler";

export interface AgentDeps {
  engine: Engine;
  day: SimRequest;
  journeys: () => Journey[];
  station: (id: StationId) => StationState;
}

/** The registry's agents (spec 6). Model agents join as their clients land (D2-2, D2-4). */
export function createAgents(deps: AgentDeps): Agent[] {
  return [
    createOpsAgent(deps),
    createItineraryAgent(deps),
    createSensingAgent(),
    createCompanionAgent(deps) as unknown as Agent,
    createMessengerAgent(),
    createResultsWatcherAgent(),
  ];
}
