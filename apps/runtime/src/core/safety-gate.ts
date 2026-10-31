import { AGENT_GRANTS, BLOCKING, requiresPreApproval, type Capability } from "@throughline/shared";
import type { Agent } from "./agent";

export type GateVerdict =
  | { verdict: "allowed"; blocking: boolean }
  | { verdict: "requires_human_approval"; reason: string }
  | { verdict: "blocked"; reason: string };

/** Spec 4.3 step 4: grant check, then the human gates. Content screening runs on handler output. */
export function checkGate(
  agent: Agent,
  capability: Capability,
  opts: { providerReviewOn: boolean; approvedBy?: string },
): GateVerdict {
  const granted =
    AGENT_GRANTS[agent.name].includes(capability) && agent.capabilities.includes(capability);
  if (!granted) {
    return { verdict: "blocked", reason: `${agent.name} is not granted ${capability}` };
  }
  if (!opts.approvedBy && requiresPreApproval(capability, opts)) {
    return {
      verdict: "requires_human_approval",
      reason: `${capability} needs a person to approve`,
    };
  }
  return { verdict: "allowed", blocking: BLOCKING.has(capability) };
}
