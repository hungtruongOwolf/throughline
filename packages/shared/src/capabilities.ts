import { z } from "zod";

export const CAPABILITIES = [
  "referral.extract",
  "referral.clarify",
  "eligibility.check",
  "prior_auth.draft",
  "prior_auth.submit",
  "schedule.plan",
  "schedule.book",
  "prep.compose",
  "message.send",
  "reply.handle",
  "noshow.score",
  "waitlist.offer",
  "itinerary.plan",
  "itinerary.replan",
  "queue.estimate",
  "patient.locate",
  "directions.send",
  "patient.message",
  "result.watch",
  "bottleneck.detect",
  "ops_action.propose",
  "ops_action.apply",
  "handoff.request",
  "summary.draft",
  "summary.send",
  "teachback.run",
  "followup.book",
  "result_ack.track",
  "logistics.checkin",
  "referral.close",
] as const;

export const Capability = z.enum(CAPABILITIES);
export type Capability = z.infer<typeof Capability>;

/**
 * Park the triggering event and replay it after HumanReviewResolved (spec 5.4).
 * summary.send is only gated when provider review is on; see requiresPreApproval.
 */
export const PRE_APPROVAL: ReadonlySet<Capability> = new Set<Capability>([
  "prior_auth.submit",
  "ops_action.apply",
  "summary.send",
]);

/** Execute, open a review, and suppress downstream events except HumanReviewRequested. */
export const BLOCKING: ReadonlySet<Capability> = new Set<Capability>(["handoff.request"]);

/**
 * Who approves a floor change the Ops planner applies on its own. A change is applied without
 * waiting when it is within policy: it moves few patients and clearly shortens the wait.
 */
export const OPS_AUTOPILOT = "Ops planner (within policy)";
export const OPS_POLICY = { maxAffected: 10, minGain: 0.3 };

export function withinOpsPolicy(effect: {
  wait_before_min: number;
  wait_after_min: number;
  affected_journeys: number;
}): boolean {
  const gain =
    effect.wait_before_min > 0
      ? (effect.wait_before_min - effect.wait_after_min) / effect.wait_before_min
      : 0;
  return effect.affected_journeys <= OPS_POLICY.maxAffected && gain >= OPS_POLICY.minGain;
}

export function requiresPreApproval(
  capability: Capability,
  opts: { providerReviewOn: boolean },
): boolean {
  if (capability === "summary.send") return opts.providerReviewOn;
  return PRE_APPROVAL.has(capability);
}

export const AGENT_NAMES = [
  "referral_intake",
  "eligibility",
  "authorization",
  "scheduler",
  "prep",
  "messenger",
  "sensing",
  "itinerary",
  "companion",
  "results_watcher",
  "ops",
  "discharge",
  "followup",
] as const;
export const AgentName = z.enum(AGENT_NAMES);
export type AgentName = z.infer<typeof AgentName>;

/** Capability grants per agent (spec 6). The safety gate refuses anything outside the grant. */
export const AGENT_GRANTS: Record<AgentName, readonly Capability[]> = {
  referral_intake: ["referral.extract", "referral.clarify"],
  eligibility: ["eligibility.check"],
  authorization: ["prior_auth.draft", "prior_auth.submit"],
  scheduler: ["schedule.plan", "schedule.book", "noshow.score"],
  prep: ["prep.compose"],
  // B7: symptom content in a reply becomes a nurse handoff, so messenger also holds handoff.request.
  messenger: ["message.send", "reply.handle", "waitlist.offer", "handoff.request"],
  sensing: ["queue.estimate", "bottleneck.detect"],
  itinerary: ["itinerary.plan", "itinerary.replan"],
  companion: ["patient.locate", "directions.send", "patient.message", "handoff.request"],
  results_watcher: ["result.watch", "result_ack.track"],
  ops: ["ops_action.propose", "ops_action.apply"],
  discharge: ["summary.draft", "summary.send", "teachback.run"],
  followup: ["followup.book", "logistics.checkin", "referral.close"],
};
