import { randomUUID } from "node:crypto";
import { DEFAULT_SEED, PAYER_RULES, payerDecision } from "@throughline/synthetic";
import type { DomainEvent } from "@throughline/shared";
import type { EventBus } from "../bus/event-bus";
import type { SimClock } from "../bus/sim-clock";
import type { Runtime } from "../core/runtime";

const REMINDER_HOURS = [72, 24] as const;

/**
 * The outside world before the visit, on the sim clock (spec 4.5, 10.1): the payer decides a
 * submitted authorization after its delay, and appointment reminders fire 72 h and 24 h out.
 */
export function startPreVisitSim(deps: {
  bus: EventBus;
  clock: SimClock;
  runtime: Runtime;
  seed?: number;
}): () => void {
  const reminders = new Map<string, number[]>();
  return deps.bus.subscribe(["PriorAuthSubmitted", "PrepPlanSent"], ({ event }) => {
    const journeyId = event.journey_id;
    if (!journeyId) return;
    if (event.type === "PriorAuthSubmitted") payer(event, journeyId);
    if (event.type === "PrepPlanSent") remind(journeyId);
  });

  function payer(event: Extract<DomainEvent, { type: "PriorAuthSubmitted" }>, journeyId: string) {
    const packetId = event.payload.packet_id;
    deps.clock.after(PAYER_RULES.decision_delay_days * 24 * 60, `payer:${packetId}`, async () => {
      const decision = payerDecision(deps.seed ?? DEFAULT_SEED, packetId);
      await deps.runtime.ingest({
        type: "PriorAuthDecided",
        journey_id: journeyId,
        payload: {
          packet_id: packetId,
          decision,
          ...(decision === "denied" ? { reason: PAYER_RULES.denial_reason } : {}),
        },
      });
    });
  }

  function remind(journeyId: string) {
    // A new plan (e.g. after a reschedule) replaces the old reminders.
    for (const id of reminders.get(journeyId) ?? []) deps.clock.cancel(id);
    const journey = deps.runtime.journey(journeyId);
    const first = journey?.appointments
      .filter((a) => a.status === "booked")
      .map((a) => Date.parse(a.start))
      .sort((a, b) => a - b)[0];
    if (first === undefined) return;
    const ids = REMINDER_HOURS.flatMap((hours) => {
      const at = first - hours * 3_600_000;
      if (at <= deps.clock.nowMsValue()) return [];
      return [
        deps.clock.at(at, `reminder:${journeyId}:${hours}h`, async () => {
          await deps.runtime.ingest({
            type: "ReminderSent",
            journey_id: journeyId,
            payload: { message_id: randomUUID(), hours_before: hours },
          });
        }),
      ];
    });
    reminders.set(journeyId, ids);
  }
}
