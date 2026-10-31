import { PAYER_RULES } from "@throughline/synthetic";
import type { AgentDescriptor, DeterministicAgent } from "../../core/agent";

export const eligibilityDescriptor: AgentDescriptor = {
  name: "eligibility",
  capabilities: ["eligibility.check"],
  risk: "LOW",
};

/** Eligibility (spec B2): deterministic rules against the synthetic payer table. */
export function createEligibilityAgent(): DeterministicAgent {
  return {
    ...eligibilityDescriptor,
    kind: "deterministic",
    handle: (ctx) => {
      const journey = ctx.journey;
      if (!journey) return { summary: "no journey", next_events: [] };
      const authCodes = new Set<string>(PAYER_RULES.auth_required_codes);
      const needAuth = journey.orders
        .filter((o) => authCodes.has(o.code_as_written))
        .map((o) => o.id);
      const coverage = {
        plan_id: PAYER_RULES.plan_id,
        active: true,
        copay_cents: PAYER_RULES.specialist_copay_cents,
        auth_required_order_ids: needAuth,
      };
      return {
        summary: `active, ${needAuth.length} order(s) need authorization`,
        journey_patch: (j) => ({
          ...j,
          coverage,
          orders: j.orders.map((o) => ({ ...o, auth_required: needAuth.includes(o.id) })),
        }),
        next_events: [{ type: "EligibilityChecked", payload: { coverage } }],
      };
    },
  };
}
