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
/** No more than one queue-driven replan per journey in this window (no thrashing). */
export const REPLAN_COOLDOWN_MIN = 10;

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
      if (classifyClinical(text)) return one("handoff.request", "messenger");
      // After the visit a reply answers whatever was last asked (spec A2, A5).
      const journey = ctx.journey;
      if (journey?.state === "TEACHBACK_PENDING") return one("teachback.run", "discharge");
      const checkin = journey?.logistics_checkin;
      if (
        checkin &&
        checkin.medication_picked_up === undefined &&
        checkin.ride_confirmed === undefined &&
        checkin.wants_nurse_call === undefined
      ) {
        return one("logistics.checkin", "followup");
      }
      return one("reply.handle", "messenger");
    }
    case "ReplyHandled":
      return event.payload.intent === "reschedule" ? one("schedule.plan", "scheduler") : [];
    case "VisitConfirmed":
      return one("noshow.score", "scheduler");
    case "WaitlistOffered":
    case "ReminderSent":
      return one("message.send", "messenger");
    // VISIT
    case "PatientArrived":
      return one("itinerary.plan", "itinerary");
    case "ItineraryPlanned":
    case "ItineraryReplanned":
    case "StopCompleted":
    case "PatientLost":
      return one("patient.message", "companion");
    case "PatientLocated": {
      // A check-in scan at the stop itself needs no directions.
      return event.payload.confidence >= 1 ? [] : one("directions.send", "companion");
    }
    case "ResultReady":
      return ctx.journey?.phase === "VISIT"
        ? [
            { capability: "result.watch", agent: "results_watcher" },
            { capability: "itinerary.replan", agent: "itinerary" },
          ]
        : one("result.watch", "results_watcher");
    // Follow-ups are booked first so the summary can name the next visit (spec A3, A1).
    case "VisitCheckedOut":
      return one("followup.book", "followup");
    // POST
    case "FollowUpsBooked":
      return one("summary.draft", "discharge");
    case "SummaryDrafted":
      return one("summary.send", "discharge");
    // The teach-back (SummarySent + 24 h) and the day-3 check-in are sim timers (sim/post-visit).
    case "TeachbackSent":
    case "LogisticsCheckinSent":
      return one("message.send", "messenger");
    case "TeachbackAnswered":
    case "ResultAcknowledged":
    case "LogisticsCheckinAnswered":
      return one("referral.close", "followup");
    case "ResultAckOverdue":
      return one("result_ack.track", "results_watcher");
    // OPS
    case "QueueStateUpdated": {
      const { queue } = event.payload;
      // Journeys whose next stop is here and whose planned wait is now off by > 10 minutes.
      const replans = (ctx.journeys?.() ?? []).flatMap((j) => {
        const next = j.itinerary?.stops.find((s) => s.status !== "done" && s.status !== "skipped");
        // Only patients still on their way: once in line, the queue is the plan.
        if (!next || next.station_id !== queue.station_id) return [];
        if (next.status !== "pending" && next.status !== "in_transit") return [];
        const sincePlan = Date.parse(queue.at) - Date.parse(j.itinerary?.planned_at ?? queue.at);
        if (sincePlan < REPLAN_COOLDOWN_MIN * 60_000) return [];
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
