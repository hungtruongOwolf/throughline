import type { Engine } from "@throughline/engine/node";
import type { Journey, SimRequest, StationId } from "@throughline/shared";
import type { Agent, StationState } from "../core/agent";
import { createItineraryAgent } from "./itinerary/handler";
import { createOpsAgent, type OpsDeps } from "./ops/handler";
import { createSensingAgent } from "./sensing/handler";
import { createCompanionAgent } from "./companion/handler";
import { createMessengerAgent } from "./messenger/handler";
import { createResultsWatcherAgent } from "./results_watcher/handler";
import { createReferralIntakeAgent } from "./referral_intake/handler";
import { createEligibilityAgent } from "./eligibility/handler";
import { createAuthorizationAgent } from "./authorization/handler";
import { createSchedulerAgent } from "./scheduler/handler";
import { createPrepAgent } from "./prep/handler";
import { createDischargeAgent } from "./discharge/handler";
import { createFollowupAgent } from "./followup/handler";

export interface AgentDeps {
  engine: Engine;
  day: SimRequest;
  journeys: () => Journey[];
  station: (id: StationId) => StationState;
  onApplied?: OpsDeps["onApplied"];
}

/** The registry's agents (spec 6). */
export function createAgents(deps: AgentDeps): Agent[] {
  return [
    createReferralIntakeAgent() as unknown as Agent,
    createEligibilityAgent(),
    createAuthorizationAgent() as unknown as Agent,
    createSchedulerAgent(deps),
    createPrepAgent(),
    createOpsAgent(deps),
    createItineraryAgent(deps),
    createSensingAgent(),
    createCompanionAgent(deps) as unknown as Agent,
    createMessengerAgent() as unknown as Agent,
    createResultsWatcherAgent(),
    createDischargeAgent() as unknown as Agent,
    createFollowupAgent(deps),
  ];
}
