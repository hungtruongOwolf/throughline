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
/** Spec V3: a queue estimate this far from a journey's plan triggers a replan. */
export const REPLAN_DEVIATION_MIN = 10;

export function route(
  event: DomainEvent,
  ctx: { journey?: Journey; station?: StationState; journeys?: () => Journey[] },
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
    case "QueueStateUpdated": {
      const { queue } = event.payload;
      // Journeys whose next stop is here and whose planned wait is now off by > 10 minutes.
      const replans = (ctx.journeys?.() ?? []).flatMap((j) => {
        const next = j.itinerary?.stops.find((s) => s.status !== "done" && s.status !== "skipped");
        if (!next || next.station_id !== queue.station_id || next.status === "in_service")
          return [];
        const planned = next.est_wait_min ?? 0;
        return Math.abs(queue.est_wait_min - planned) > REPLAN_DEVIATION_MIN
          ? [
              {
                capability: "itinerary.replan" as const,
                agent: "itinerary" as const,
                journey_id: j.id,
              },
            ]
          : [];
      });
      return [{ capability: "bottleneck.detect", agent: "sensing" }, ...replans];
    }
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
