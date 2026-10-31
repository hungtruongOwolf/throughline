import type { AgentName, Capability, DomainEvent, Journey } from "@throughline/shared";
import { classifyClinical } from "../safety/classifier";
import type { StationState } from "./agent";

export interface Invocation {
  capability: Capability;
  agent: AgentName;
  /** Set when a station event fans out to specific journeys. */
  journey_id?: string;
}

const one = (capability: Capability, agent: AgentName): Invocation[] => [{ capability, agent }];

/**
 * EVENT_TO_CAPABILITY plus state rules (spec 4.3 step 3): which capability, on which agent,
 * handles an event. Events that are outcomes (e.g. HandoffRequested) route nowhere.
 */
export function route(
  event: DomainEvent,
  ctx: { journey?: Journey; station?: StationState },
): Invocation[] {
  switch (event.type) {
    // PRE
    case "ReferralReceived":
    case "ClarificationAnswered":
      return one("referral.extract", "referral_intake");
    case "IntakeExtracted":
      return one("eligibility.check", "eligibility");
    case "EligibilityChecked":
      return event.payload.coverage.auth_required_order_ids.length > 0
        ? one("prior_auth.draft", "authorization")
        : one("schedule.plan", "scheduler");
    case "PriorAuthDrafted":
      return one("prior_auth.submit", "authorization");
    case "PriorAuthDecided":
      return one("schedule.plan", "scheduler");
    case "AppointmentsProposed":
      return one("schedule.book", "scheduler");
    case "AppointmentsBooked":
      return one("prep.compose", "prep");
    case "PatientReplied": {
      const text = event.payload.text ?? event.payload.transcript ?? "";
      // Symptom or other clinical content never reaches intent handling (spec B7, 6.2).
      return classifyClinical(text)
        ? one("handoff.request", "messenger")
        : one("reply.handle", "messenger");
    }
    case "ReplyHandled":
      return event.payload.intent === "reschedule" ? one("schedule.plan", "scheduler") : [];
    case "VisitConfirmed":
      return one("noshow.score", "scheduler");
    case "WaitlistOffered":
      return one("message.send", "messenger");
    // VISIT
    case "PatientArrived":
      return one("itinerary.plan", "itinerary");
    case "ItineraryPlanned":
    case "ItineraryReplanned":
    case "StopCompleted":
    case "PatientLost":
      return one("patient.message", "companion");
    case "PatientLocated":
      return one("directions.send", "companion");
    case "ResultReady":
      return ctx.journey?.phase === "VISIT"
        ? [
            { capability: "result.watch", agent: "results_watcher" },
            { capability: "itinerary.replan", agent: "itinerary" },
          ]
        : one("result.watch", "results_watcher");
    case "VisitCheckedOut":
      return [
        { capability: "summary.draft", agent: "discharge" },
        { capability: "followup.book", agent: "followup" },
      ];
    // POST
    case "SummaryDrafted":
      return one("summary.send", "discharge");
    case "SummarySent":
    case "TeachbackAnswered":
      return one("teachback.run", "discharge");
    case "FollowUpsBooked":
    case "ResultAcknowledged":
      return one("referral.close", "followup");
    case "LogisticsCheckinAnswered":
      return one("logistics.checkin", "followup");
    // OPS
    case "QueueStateUpdated":
      return one("bottleneck.detect", "sensing");
    case "BottleneckDetected":
      return one("ops_action.propose", "ops");
    case "OpsActionProposed":
      return one("ops_action.apply", "ops");
    case "OpsActionApplied":
      // Spec V8: after an approved ops action, every affected journey re-plans.
      return event.payload.affected_journey_ids.map((journey_id) => ({
        capability: "itinerary.replan" as const,
        agent: "itinerary" as const,
        journey_id,
      }));
    default:
      return [];
  }
}
