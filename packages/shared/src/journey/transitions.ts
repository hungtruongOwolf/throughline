import type { EventType } from "../events";
import type { JourneyState } from "./states";

export interface Transition {
  event: EventType;
  from: readonly JourneyState[];
  to: JourneyState;
  /** Outside `from`, the event only updates details (e.g. a result acknowledged during the visit). */
  soft?: true;
}

/**
 * The phase/state table (spec 5.2). Events not listed here never change `journey.state`;
 * they update details (itinerary stops, flags, orders) only. A test asserts every handler
 * produces only these transitions.
 */
export const TRANSITIONS: readonly Transition[] = [
  // PRE
  {
    event: "IntakeExtracted",
    from: ["REFERRAL_RECEIVED", "CLARIFICATION_NEEDED"],
    to: "INTAKE_EXTRACTED",
  },
  {
    event: "ClarificationNeeded",
    from: ["REFERRAL_RECEIVED", "INTAKE_EXTRACTED"],
    to: "CLARIFICATION_NEEDED",
  },
  { event: "EligibilityChecked", from: ["INTAKE_EXTRACTED"], to: "ELIGIBILITY_CHECKED" },
  { event: "PriorAuthDrafted", from: ["ELIGIBILITY_CHECKED"], to: "AUTH_DRAFTED" },
  { event: "PriorAuthSubmitted", from: ["AUTH_DRAFTED"], to: "AUTH_SUBMITTED" },
  { event: "PriorAuthDecided", from: ["AUTH_SUBMITTED"], to: "AUTH_DECIDED" },
  // AUTH_* is skipped when no order needs authorization.
  {
    event: "AppointmentsBooked",
    from: ["ELIGIBILITY_CHECKED", "AUTH_DECIDED", "SCHEDULED", "PREP_SENT", "CONFIRMED"],
    to: "SCHEDULED",
  },
  { event: "PrepPlanSent", from: ["SCHEDULED"], to: "PREP_SENT" },
  { event: "VisitConfirmed", from: ["PREP_SENT"], to: "CONFIRMED" },
  // VISIT
  { event: "PatientArrived", from: ["PREP_SENT", "CONFIRMED"], to: "ARRIVED" },
  { event: "ItineraryPlanned", from: ["ARRIVED"], to: "PLANNED" },
  { event: "StopStarted", from: ["PLANNED", "ACTIVE"], to: "ACTIVE" },
  { event: "VisitCheckedOut", from: ["ACTIVE"], to: "CHECKED_OUT" },
  // POST
  { event: "SummaryDrafted", from: ["CHECKED_OUT"], to: "SUMMARY_DRAFTED" },
  { event: "SummarySent", from: ["SUMMARY_DRAFTED"], to: "SUMMARY_SENT" },
  { event: "TeachbackSent", from: ["SUMMARY_SENT"], to: "TEACHBACK_PENDING" },
  { event: "TeachbackAnswered", from: ["TEACHBACK_PENDING"], to: "TEACHBACK_DONE", soft: true },
  {
    event: "FollowUpsBooked",
    from: ["SUMMARY_SENT", "TEACHBACK_PENDING", "TEACHBACK_DONE"],
    to: "FOLLOWUPS_BOOKED",
    soft: true,
  },
  {
    event: "ResultAcknowledged",
    from: ["FOLLOWUPS_BOOKED"],
    to: "RESULTS_ACKNOWLEDGED",
    soft: true,
  },
  { event: "ReferralClosed", from: ["RESULTS_ACKNOWLEDGED"], to: "REFERRAL_CLOSED" },
];

export const TERMINAL_STATES: readonly JourneyState[] = ["REFERRAL_CLOSED"];

/** Returns the next state, `undefined` if the event does not move the state, or throws if illegal. */
export function nextState(current: JourneyState, event: EventType): JourneyState | undefined {
  const rows = TRANSITIONS.filter((t) => t.event === event);
  if (rows.length === 0) return undefined;
  if (TERMINAL_STATES.includes(current)) throw new Error(`journey is closed: ${event}`);
  const row = rows.find((t) => t.from.includes(current));
  if (row) return row.to;
  if (rows.some((t) => t.soft)) return undefined;
  throw new Error(`illegal transition: ${event} from ${current}`);
}
