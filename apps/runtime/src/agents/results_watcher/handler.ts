import { t, type Journey } from "@throughline/shared";
import type { DeterministicAgent } from "../../core/agent";
import { outbound } from "../shared/messages";
import { resultsWatcherDescriptor } from "./descriptor";

/**
 * Results are status only (spec V6, A4): a ResultReady tells the patient their sample is done
 * so the next stop can go ahead. It never reads, interprets, or mentions a value; the event
 * type has no value field to read. Unacknowledged results become a clinician task (A4).
 */
export function createResultsWatcherAgent(): DeterministicAgent {
  return {
    ...resultsWatcherDescriptor,
    kind: "deterministic",
    handle: (ctx) => {
      const journey = ctx.journey as Journey | undefined;
      // A4: a result nobody acknowledged in 48 h becomes a task for the ordering clinician.
      const event = ctx.event;
      if (ctx.capability === "result_ack.track" && journey && event.type === "ResultAckOverdue") {
        const order = journey.orders.find((o) => o.id === event.payload.order_id);
        if (!order || order.status !== "resulted")
          return { summary: "already acknowledged", next_events: [] };
        return {
          summary: `result not acknowledged after ${event.payload.hours} h`,
          tasks: [
            `Acknowledge the ${order.code_as_written} result for ${journey.patient.display_name}`,
          ],
          next_events: [],
        };
      }
      if (ctx.capability !== "result.watch" || !journey || journey.phase !== "VISIT") {
        return { summary: "result tracked", next_events: [] };
      }
      const out = outbound(journey, t(journey.patient.language, "companion.result_ready"), ctx.now);
      return {
        summary: "patient told the sample is done",
        journey_patch: out.patch,
        outbound: out.outbound,
        next_events: [],
      };
    },
  };
}
