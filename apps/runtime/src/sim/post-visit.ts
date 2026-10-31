import { randomUUID } from "node:crypto";
import type { EventBus } from "../bus/event-bus";
import type { SimClock } from "../bus/sim-clock";
import type { Runtime } from "../core/runtime";

const HOUR = 60;
/** Spec A2: the teach-back goes out a day after the summary. */
const TEACHBACK_AFTER_MIN = 24 * HOUR;
/** Spec A4: a result nobody acknowledged in 48 h becomes a clinician task. */
const ACK_OVERDUE_MIN = 48 * HOUR;
/** The simulated clinician reviews results the next morning at 8:30. */
const ACK_AT = "08:30";
/** Spec A5: the logistics check-in, day 3 after the visit at 10:00. */
const CHECKIN_DAY = 3;
const CHECKIN_AT = "10:00";
const TZ = "-06:00";

function dayAt(iso: string, days: number, time: string): number {
  const d = new Date(Date.parse(iso) + days * 86_400_000 - 6 * 3_600_000);
  return Date.parse(`${d.toISOString().slice(0, 10)}T${time}:00${TZ}`);
}

/**
 * The world after the visit, on the sim clock: the teach-back timer, the ordering clinician
 * acknowledging results (simulated EHR inbox), the 48 h acknowledgment check, and the day-3
 * check-in. Agents decide what to say; this only decides when.
 */
export function startPostVisitSim(deps: {
  bus: EventBus;
  clock: SimClock;
  runtime: Runtime;
}): () => void {
  return deps.bus.subscribe(["VisitCheckedOut", "SummarySent", "ResultReady"], ({ event }) => {
    const journeyId = event.journey_id;
    if (!journeyId) return;
    const now = deps.clock.now();
    if (event.type === "SummarySent") {
      deps.clock.after(TEACHBACK_AFTER_MIN, `teachback:${journeyId}`, async () => {
        await deps.runtime.ingest({
          type: "TeachbackSent",
          journey_id: journeyId,
          payload: { message_id: randomUUID() },
        });
      });
    }
    if (event.type === "ResultReady") {
      const orderId = event.payload.order_id;
      deps.clock.after(ACK_OVERDUE_MIN, `ack-check:${orderId}`, async () => {
        const order = deps.runtime.journey(journeyId)?.orders.find((o) => o.id === orderId);
        if (order?.status !== "resulted") return;
        await deps.runtime.ingest({
          type: "ResultAckOverdue",
          journey_id: journeyId,
          payload: { order_id: orderId, hours: 48 },
        });
      });
    }
    if (event.type === "VisitCheckedOut") {
      deps.clock.at(dayAt(now, 1, ACK_AT), `ack:${journeyId}`, async () => {
        const journey = deps.runtime.journey(journeyId);
        for (const order of journey?.orders.filter((o) => o.status === "resulted") ?? []) {
          await deps.runtime.ingest({
            type: "ResultAcknowledged",
            journey_id: journeyId,
            payload: { order_id: order.id, by: "Dr. Okafor" },
          });
        }
      });
      deps.clock.at(dayAt(now, CHECKIN_DAY, CHECKIN_AT), `checkin:${journeyId}`, async () => {
        await deps.runtime.ingest({
          type: "LogisticsCheckinSent",
          journey_id: journeyId,
          payload: { message_id: randomUUID() },
        });
      });
    }
  });
}
