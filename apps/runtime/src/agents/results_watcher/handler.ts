import { t, type Journey } from "@throughline/shared";
import type { DeterministicAgent } from "../../core/agent";
import { outbound } from "../shared/messages";
import { resultsWatcherDescriptor } from "./descriptor";

/**
 * Results are status only (spec V6, A4): a ResultReady tells the patient their sample is done
 * so the next stop can go ahead. It never reads, interprets, or mentions a value; the event
 * type has no value field to read. Acknowledgment tracking (A4) lands with the post-visit work.
 */
export function createResultsWatcherAgent(): DeterministicAgent {
  return {
    ...resultsWatcherDescriptor,
    kind: "deterministic",
    handle: (ctx) => {
      const journey = ctx.journey as Journey | undefined;
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
