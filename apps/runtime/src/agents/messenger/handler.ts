import { t, type DomainEvent, type Journey } from "@throughline/shared";
import type { DeterministicAgent, HandlerResult } from "../../core/agent";
import { outbound } from "../shared/messages";
import { messengerDescriptor } from "./descriptor";

/** Keyword intent (spec 6 messenger fallback): "yes/sí" confirm, "change/cambiar" reschedule. */
export function keywordIntent(text: string): "confirm" | "reschedule" | "human" {
  const t = text.toLowerCase();
  if (/\b(cambiar|change|reschedule|otro día|another day)\b/.test(t)) return "reschedule";
  if (/\b(s[ií]|yes|confirm\w*|ok|okay|de acuerdo)\b/.test(t)) return "confirm";
  return "human";
}

/**
 * Messenger, deterministic path for the visit day: nurse handoffs for clinical content (the
 * orchestrator routes those here before any intent handling) and keyword intents. The model
 * path (Voice Transcribe + Spark `handle_reply`) is D3-2.
 */
export function createMessengerAgent(): DeterministicAgent {
  return {
    ...messengerDescriptor,
    kind: "deterministic",
    handle: (ctx): HandlerResult => {
      const journey = ctx.journey as Journey | undefined;
      if (!journey) return { summary: "no journey", next_events: [] };
      const lang = journey.patient.language;
      if (ctx.capability === "handoff.request") {
        const out = outbound(journey, t(lang, "handoff.nurse"), ctx.now);
        return {
          summary: "nurse handoff",
          review_reason: "Patient asked a clinical question",
          journey_patch: out.patch,
          outbound: out.outbound,
          next_events: [{ type: "HandoffRequested", payload: { reason: "clinical_question" } }],
        };
      }
      if (ctx.capability === "reply.handle") {
        const reply = ctx.event as Extract<DomainEvent, { type: "PatientReplied" }>;
        const text = reply.payload.text ?? reply.payload.transcript ?? "";
        return {
          summary: "reply handled by keywords",
          journey_patch: (j) => ({
            ...j,
            outreach_log: [
              ...j.outreach_log,
              {
                id: reply.id,
                direction: "in",
                channel: reply.payload.channel,
                language: reply.payload.language,
                text,
                disclaimer: false,
                at: reply.occurred_at,
              },
            ],
          }),
          next_events: [
            { type: "ReplyHandled", payload: { intent: keywordIntent(text), memory_keys: [] } },
          ],
        };
      }
      return { summary: `not handled: ${ctx.capability}`, next_events: [] };
    },
  };
}
