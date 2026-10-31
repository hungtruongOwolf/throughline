import { z } from "zod";

export const Phase = z.enum(["PRE", "VISIT", "POST", "COMPLETED"]);
export type Phase = z.infer<typeof Phase>;

/** Spec 5.2, in phase order. CLARIFICATION_NEEDED is a PRE side state. */
export const STATES_BY_PHASE = {
  PRE: [
    "REFERRAL_RECEIVED",
    "INTAKE_EXTRACTED",
    "CLARIFICATION_NEEDED",
    "ELIGIBILITY_CHECKED",
    "AUTH_DRAFTED",
    "AUTH_SUBMITTED",
    "AUTH_DECIDED",
    "SCHEDULED",
    "PREP_SENT",
    "CONFIRMED",
  ],
  VISIT: ["ARRIVED", "PLANNED", "ACTIVE", "CHECKED_OUT"],
  POST: [
    "SUMMARY_DRAFTED",
    "SUMMARY_SENT",
    "TEACHBACK_PENDING",
    "TEACHBACK_DONE",
    "FOLLOWUPS_BOOKED",
    "RESULTS_ACKNOWLEDGED",
  ],
  // ReferralClosed ends the journey: phase COMPLETED (spec A6) is reached through this state.
  COMPLETED: ["REFERRAL_CLOSED"],
} as const satisfies Record<Phase, readonly string[]>;

export const JOURNEY_STATES = Object.values(STATES_BY_PHASE).flat();
export const JourneyState = z.enum(
  JOURNEY_STATES as unknown as [
    (typeof STATES_BY_PHASE)[Phase][number],
    ...(typeof STATES_BY_PHASE)[Phase][number][],
  ],
);
export type JourneyState = z.infer<typeof JourneyState>;

export function phaseOf(state: JourneyState): Phase {
  for (const phase of Phase.options) {
    if ((STATES_BY_PHASE[phase] as readonly string[]).includes(state)) return phase;
  }
  throw new Error(`unknown state ${state}`);
}
