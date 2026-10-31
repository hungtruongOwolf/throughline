import { z } from "zod";
import {
  MemoryUpdate,
  t,
  type DomainEvent,
  type Journey,
  type MemoryKey,
} from "@throughline/shared";
import type { HandlerContext, HandlerResult, ModelAgent, NewEvent } from "../../core/agent";
import { PREAMBLE, requiredToolLine } from "../../safety/preamble";
import { outbound, whenText } from "../shared/messages";
import { messengerDescriptor } from "./descriptor";

/** Keyword intent (spec 6 messenger fallback): "yes/sí" confirm, "change/cambiar" reschedule. */
export function keywordIntent(text: string): "confirm" | "reschedule" | "human" {
  const t = text.toLowerCase();
  if (/\b(cambiar|change|reschedule|otro día|another day)\b/.test(t)) return "reschedule";
  if (/(^|[^\p{L}])(s[ií]|yes|confirm\w*|ok|okay|de acuerdo)([^\p{L}]|$)/u.test(t))
    return "confirm";
  return "human";
}

/** Allowlisted memory read from a reply by keywords (spec 5.6); never free text. */
export function keywordMemory(text: string): MemoryUpdate[] {
  const s = text.toLowerCase();
  const out: MemoryUpdate[] = [];
  if (/silla de ruedas|wheelchair/.test(s)) out.push({ key: "mobility", value: "wheelchair" });
  if (
    /(esposo|esposa|hij[oa]|marido)\s+no\s+puede\s+venir|voy\s+sol[oa]|no one can come|coming alone|by myself|(husband|wife|son|daughter) can'?t come/.test(
      s,
    )
  )
    out.push({ key: "companion_present", value: "false" });
  if (/por la mañana|in the morning|mornings?\b/.test(s))
    out.push({ key: "preferred_time_of_day", value: "morning" });
  if (/por la tarde|in the afternoon|afternoons?\b/.test(s))
    out.push({ key: "preferred_time_of_day", value: "afternoon" });
  return out;
}

const REPLY_TOOL = "handle_reply";

const Args = z.object({
  intent: z.enum(["confirm", "reschedule", "question", "human", "clinical"]),
  memory_updates: z.array(MemoryUpdate).max(6),
});
type Args = z.infer<typeof Args>;

const SYSTEM = `${PREAMBLE} You read a patient's reply to their appointment text. Decide the intent: confirm, reschedule, question (about logistics), human, or clinical. Choose clinical whenever the reply mentions a symptom, how they feel, a medicine, a test result, a diagnosis, a side effect, or anything else a nurse or doctor should answer; you never answer those. Extract only these memory keys when the patient states them: mobility (walking or wheelchair), companion_present (true or false), preferred_time_of_day (morning or afternoon), transport_need (none, ride_needed, wheelchair_van). ${requiredToolLine(REPLY_TOOL)}`;

const TOOLS = [
  {
    type: "function" as const,
    name: REPLY_TOOL,
    description: "Submit the reply's intent and any allowlisted memory it states.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["intent", "memory_updates"],
      properties: {
        intent: {
          type: "string",
          enum: ["confirm", "reschedule", "question", "human", "clinical"],
        },
        memory_updates: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["key", "value"],
            properties: {
              key: {
                type: "string",
                enum: ["mobility", "companion_present", "preferred_time_of_day", "transport_need"],
              },
              value: { type: "string" },
            },
          },
        },
      },
    },
  },
];

function replyText(ctx: HandlerContext): string {
  const reply = ctx.event as Extract<DomainEvent, { type: "PatientReplied" }>;
  return reply.payload.text ?? reply.payload.transcript ?? "";
}

/** Records the reply, applies memory, answers, and confirms the visit on a yes. */
function handled(
  args: Args & { intent: Exclude<Args["intent"], "clinical"> },
  ctx: HandlerContext,
): HandlerResult {
  const journey = ctx.journey as Journey;
  const reply = ctx.event as Extract<DomainEvent, { type: "PatientReplied" }>;
  const lang = journey.patient.language;
  const memory: Partial<Record<MemoryKey, string>> = {};
  for (const u of args.memory_updates) memory[u.key] = u.value;
  const wheelchairNew =
    memory.mobility === "wheelchair" && journey.memory.mobility !== "wheelchair";
  const answer =
    args.intent === "confirm"
      ? t(lang, "reply.confirmed")
      : args.intent === "reschedule"
        ? t(lang, "reply.reschedule")
        : undefined;
  const texts = [
    ...(answer ? [answer] : []),
    ...(wheelchairNew ? [t(lang, "reply.noted_wheelchair")] : []),
  ];
  const out = texts.length > 0 ? outbound(journey, texts.join(" "), ctx.now) : undefined;
  const next: NewEvent[] = [
    {
      type: "ReplyHandled",
      payload: { intent: args.intent, memory_keys: Object.keys(memory) as MemoryKey[] },
    },
  ];
  if (args.intent === "confirm" && journey.state === "PREP_SENT") {
    next.push({ type: "VisitConfirmed", payload: {} });
  }
  return {
    summary: `reply: ${args.intent}${Object.keys(memory).length ? `, memory ${Object.keys(memory).join(", ")}` : ""}`,
    journey_patch: (j) => {
      const recorded: Journey = {
        ...j,
        outreach_log: [
          ...j.outreach_log,
          {
            id: reply.id,
            direction: "in",
            channel: reply.payload.channel,
            language: reply.payload.language,
            text: replyText(ctx),
            disclaimer: false,
            at: reply.occurred_at,
          },
        ],
        memory: { ...j.memory, ...memory },
        patient:
          memory.mobility === "wheelchair" || memory.mobility === "walking"
            ? { ...j.patient, mobility: memory.mobility }
            : j.patient,
        ...(args.intent === "confirm"
          ? { confirmation: { confirmed_at: ctx.now, channel: reply.payload.channel } }
          : {}),
      };
      return out ? out.patch(recorded) : recorded;
    },
    ...(out ? { outbound: out.outbound } : {}),
    next_events: next,
  };
}

/** A reminder timer fired (sim/pre-visit): send it with the event's message id. */
function reminder(ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const event = ctx.event as Extract<DomainEvent, { type: "ReminderSent" }>;
  const lang = journey.patient.language;
  const first = [...journey.appointments]
    .filter((a) => a.status === "booked")
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  if (!first) return { summary: "no booked visit", next_events: [] };
  const key = event.payload.hours_before >= 72 ? "reminder.72h" : "reminder.24h";
  const text = t(lang, key, { when: whenText(first.start, lang) });
  const out = outbound(journey, text, ctx.now);
  const messages = out.messages.map((m) =>
    m.text === text ? { ...m, id: event.payload.message_id } : m,
  );
  return {
    summary: `reminder ${event.payload.hours_before}h`,
    journey_patch: (j) => ({ ...j, outreach_log: [...j.outreach_log, ...messages] }),
    outbound: out.outbound,
    next_events: [],
  };
}

/** The next booked appointment after now (the follow-up, once the visit is over). */
function nextBooked(journey: Journey, now: string) {
  return [...journey.appointments]
    .filter((a) => a.status === "booked" && Date.parse(a.start) > Date.parse(now))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
}

/** After the visit (spec A2, A5): the teach-back questions and the day-3 logistics check-in. */
function postVisit(ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const lang = journey.patient.language;
  const event = ctx.event as Extract<
    DomainEvent,
    { type: "TeachbackSent" } | { type: "LogisticsCheckinSent" }
  >;
  const next = nextBooked(journey, ctx.now);
  const when = next ? whenText(next.start, lang) : "";
  const teachback = event.type === "TeachbackSent";
  const text = teachback ? t(lang, "teachback.questions") : t(lang, "checkin.questions", { when });
  const out = outbound(journey, text, ctx.now);
  const messages = out.messages.map((m) =>
    m.text === text ? { ...m, id: event.payload.message_id } : m,
  );
  return {
    summary: teachback ? "teach-back questions sent" : "logistics check-in sent",
    journey_patch: (j) => ({
      ...j,
      outreach_log: [...j.outreach_log, ...messages],
      ...(teachback
        ? { teachback: { sent_at: ctx.now, answers: {} } }
        : { logistics_checkin: { sent_at: ctx.now } }),
    }),
    outbound: out.outbound,
    next_events: [],
  };
}

function handoff(ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const out = outbound(journey, t(journey.patient.language, "handoff.nurse"), ctx.now);
  return {
    summary: "nurse handoff",
    review_reason: "Patient asked a clinical question",
    journey_patch: out.patch,
    outbound: out.outbound,
    next_events: [{ type: "HandoffRequested", payload: { reason: "clinical_question" } }],
  };
}

/**
 * Messenger (spec B6/B7): Spark `handle_reply` reads intent and allowlisted memory from a
 * reply (keyword fallback without a model). Clinical content the keyword lists catch never gets
 * here; what they miss, Spark answers `clinical`, and both become a BLOCKING nurse handoff. Reminders go out from sim timers.
 */
export function createMessengerAgent(): ModelAgent<Args> {
  return {
    ...messengerDescriptor,
    kind: "model",
    modelCapabilities: ["reply.handle"],
    model: {
      system: SYSTEM,
      input: (ctx) => `Patient reply: ${replyText(ctx)}`,
      tools: TOOLS,
      readTools: {},
      readSchemas: {},
      requiredTool: REPLY_TOOL,
      requiredSchema: Args,
      effort: "minimal",
      maxSteps: 2,
      maxOutputTokens: 400,
      apply: (args, ctx) =>
        args.intent === "clinical" ? handoff(ctx) : handled({ ...args, intent: args.intent }, ctx),
    },
    fallback: (ctx) => {
      if (ctx.capability === "handoff.request") return handoff(ctx);
      const text = replyText(ctx);
      return handled({ intent: keywordIntent(text), memory_updates: keywordMemory(text) }, ctx);
    },
    handle: (ctx) => {
      if (!ctx.journey) return { summary: "no journey", next_events: [] };
      if (ctx.capability === "handoff.request") return handoff(ctx);
      if (ctx.capability === "message.send" && ctx.event.type === "ReminderSent")
        return reminder(ctx);
      if (
        ctx.capability === "message.send" &&
        (ctx.event.type === "TeachbackSent" || ctx.event.type === "LogisticsCheckinSent")
      )
        return postVisit(ctx);
      return { summary: `not handled: ${ctx.capability}`, next_events: [] };
    },
  };
}
