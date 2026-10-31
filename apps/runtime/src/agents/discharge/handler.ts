import { randomUUID } from "node:crypto";
import { z } from "zod";
import { MARIA_VISIT_NOTES } from "@throughline/synthetic";
import { t, type DomainEvent, type Journey } from "@throughline/shared";
import type {
  AgentDescriptor,
  HandlerContext,
  HandlerResult,
  ModelAgent,
  ModelSpec,
} from "../../core/agent";
import { PREAMBLE, requiredToolLine } from "../../safety/preamble";
import { outbound, whenText } from "../shared/messages";

export const dischargeDescriptor: AgentDescriptor = {
  name: "discharge",
  capabilities: ["summary.draft", "summary.send", "teachback.run"],
  // Restates clinician instructions; summary.send is PRE_APPROVAL when provider review is on.
  risk: "HIGH",
};

const SUMMARY_TOOL = "submit_summary";
const GRADE_TOOL = "grade_teachback";

const Summary = z.object({
  sections: z.array(z.object({ heading: z.string().min(1), plain: z.string().min(1) })).min(1),
});
type Summary = z.infer<typeof Summary>;

const Grade = z.object({
  next_visit: z.enum(["correct", "wrong", "not_sure"]),
  bring: z.enum(["correct", "wrong", "not_sure"]),
  who_to_call: z.enum(["correct", "wrong", "not_sure"]),
});
type Grade = z.infer<typeof Grade>;
type Topic = keyof Grade;
const TOPICS: Topic[] = ["next_visit", "bring", "who_to_call"];

const SUMMARY_SYSTEM = `${PREAMBLE} You restate a clinician's after-visit notes for the patient in plain words, one section per note section, same headings, same order. Keep every instruction, number, dose, and phone number exactly; do not add advice, explain the illness, or interpret results. Short sentences, the patient's language. Where the notes say when something happens, use the booked dates you are given. ${requiredToolLine(SUMMARY_TOOL)}`;

const GRADE_SYSTEM = `${PREAMBLE} You check a patient's answers to three teach-back questions against the expected answers: next_visit (when the next blood test is), bring (what to bring), who_to_call (who to call with questions). For each, answer correct if the patient's words match the expected answer in meaning (a date alone is enough for next_visit), not_sure if they say they do not know or are unsure, wrong otherwise. Judge only these three; never comment on health. ${requiredToolLine(GRADE_TOOL)}`;

function summaryTools() {
  return [
    {
      type: "function" as const,
      name: SUMMARY_TOOL,
      description: "Submit the plain-language restatement, one entry per note section.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["sections"],
        properties: {
          sections: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["heading", "plain"],
              properties: { heading: { type: "string" }, plain: { type: "string" } },
            },
          },
        },
      },
    },
  ];
}

function gradeTools() {
  const answer = { type: "string", enum: ["correct", "wrong", "not_sure"] };
  return [
    {
      type: "function" as const,
      name: GRADE_TOOL,
      description: "Submit one grade per teach-back question.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: TOPICS,
        properties: { next_visit: answer, bring: answer, who_to_call: answer },
      },
    },
  ];
}

/** Follow-up appointments, soonest first. */
function followUps(journey: Journey) {
  return journey.appointments
    .filter((a) => a.order_id.startsWith("o-fu-") && a.status === "booked")
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

function bookedFacts(journey: Journey): string {
  const lang = journey.patient.language;
  const lines = followUps(journey).map((a) => {
    const order = journey.orders.find((o) => o.id === a.order_id);
    return `${order?.code_as_written ?? a.order_id}: ${whenText(a.start, lang)}`;
  });
  return lines.length > 0 ? lines.join("\n") : "None booked yet.";
}

function notesText(): string {
  return MARIA_VISIT_NOTES.sections.map((s) => `${s.heading}: ${s.verbatim}`).join("\n");
}

// ---- A1 summary --------------------------------------------------------------------------

function drafted(plain: string[]): HandlerResult {
  const draft = MARIA_VISIT_NOTES.sections.map((s, i) => ({
    heading: s.heading,
    verbatim: s.verbatim,
    plain: plain[i] ?? s.verbatim,
  }));
  return {
    summary: `summary drafted, ${draft.length} sections`,
    journey_patch: (j) => ({ ...j, summary: { draft, disclaimer_mode: false } }),
    next_events: [{ type: "SummaryDrafted", payload: { sections: draft.length } }],
  };
}

function applySummary(args: Summary): HandlerResult {
  const sections = MARIA_VISIT_NOTES.sections;
  // The restatement must line up with the notes; otherwise it is not used.
  if (args.sections.length !== sections.length) throw new Error("section count differs");
  return drafted(args.sections.map((s) => s.plain));
}

/** Sends the "summary ready" text. Reviewed by a clinician, or else in disclaimer mode. */
function send(ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const lang = journey.patient.language;
  const reviewedBy = ctx.approved_by;
  const disclaimerMode = !reviewedBy;
  const ready = t(lang, "summary.ready", { author: MARIA_VISIT_NOTES.author });
  const text = disclaimerMode ? `${ready} ${t(lang, "disclosure.summary_unreviewed")}` : ready;
  const messageId = randomUUID();
  const out = outbound(journey, text, ctx.now);
  const messages = out.messages.map((m) =>
    m.text === text ? { ...m, id: messageId, disclaimer: disclaimerMode } : m,
  );
  return {
    summary: reviewedBy
      ? `summary sent, reviewed by ${reviewedBy}`
      : "summary sent with disclaimer",
    journey_patch: (j) => ({
      ...j,
      outreach_log: [...j.outreach_log, ...messages],
      ...(j.summary
        ? {
            summary: {
              ...j.summary,
              sent_at: ctx.now,
              disclaimer_mode: disclaimerMode,
              ...(reviewedBy ? { reviewed_by: reviewedBy } : {}),
            },
          }
        : {}),
    }),
    outbound: out.outbound,
    next_events: [
      { type: "SummarySent", payload: { disclaimer_mode: disclaimerMode, message_id: messageId } },
    ],
  };
}

// ---- A2 teach-back -----------------------------------------------------------------------

function replyText(ctx: HandlerContext): string {
  const reply = ctx.event as Extract<DomainEvent, { type: "PatientReplied" }>;
  return reply.payload.text ?? reply.payload.transcript ?? "";
}

function expected(journey: Journey): Record<Topic, string> {
  const next = followUps(journey)[0];
  return {
    // The day is enough; nobody is expected to recite the time.
    next_visit: next ? dayText(next.start) : "not booked",
    bring: "insurance card and a photo ID",
    who_to_call: "the clinic at 555-0100, or reply NURSE",
  };
}

function dayText(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** Keyword grading, used when the model is unavailable. Splits the reply into sentences. */
export function keywordGrade(text: string, journey: Journey): Grade {
  const parts = text.toLowerCase().split(/[.?!\n]+/);
  const unsure = (s: string) => /\b(not sure|don't know|do not know|no sé|no estoy segur)/.test(s);
  const find = (re: RegExp) => parts.find((s) => re.test(s));
  const next = followUps(journey)[0];
  const day = next ? new Date(Date.parse(next.start) - 6 * 3_600_000) : undefined;
  const dateRe = day
    ? new RegExp(
        `${MONTHS[day.getUTCMonth()]}\\s+${day.getUTCDate()}\\b|${day.getUTCMonth() + 1}/${day.getUTCDate()}\\b`,
      )
    : /$^/;
  const grade = (about: RegExp, right: (s: string) => boolean): Grade[Topic] => {
    const s = find(about);
    if (!s || unsure(s)) return "not_sure";
    return right(s) ? "correct" : "wrong";
  };
  return {
    next_visit: grade(/\b(next|blood|test|lab|appointment|visit|cita|análisis)\b/, (s) =>
      dateRe.test(s),
    ),
    bring: grade(
      /\b(bring|traigo|traer)\b/,
      (s) => /card|tarjeta/.test(s) && /\bid\b|identific/.test(s),
    ),
    who_to_call: grade(/\b(call|llam)/, (s) => /555|clinic|clínica|nurse|enfermera/.test(s)),
  };
}

function graded(args: Grade, ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const lang = journey.patient.language;
  const reply = ctx.event as Extract<DomainEvent, { type: "PatientReplied" }>;
  const missed = TOPICS.filter((k) => args[k] !== "correct");
  const passed = missed.length === 0;
  const topics = missed.map((k) => t(lang, `teachback.topic.${k}`)).join(", ");
  const next = followUps(journey)[0];
  const text = passed
    ? t(lang, "teachback.passed", { when: next ? whenText(next.start, lang) : "" })
    : t(lang, "teachback.nurse", { topics });
  const out = outbound(journey, text, ctx.now);
  return {
    summary: passed ? "teach-back passed" : `teach-back: nurse call for ${missed.join(", ")}`,
    journey_patch: (j) => ({
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
        ...out.messages,
      ],
      teachback: { sent_at: j.teachback?.sent_at ?? ctx.now, answers: args, passed },
    }),
    outbound: out.outbound,
    ...(passed
      ? {}
      : {
          tasks: [`Nurse call to ${journey.patient.display_name}: teach-back unclear on ${topics}`],
        }),
    next_events: [{ type: "TeachbackAnswered", payload: { answers: args, passed } }],
  };
}

function gradeSpec(): ModelSpec<Grade> {
  return {
    system: GRADE_SYSTEM,
    input: (ctx) => {
      const want = expected(ctx.journey as Journey);
      return [
        `Expected answers:`,
        `next_visit: ${want.next_visit}`,
        `bring: ${want.bring}`,
        `who_to_call: ${want.who_to_call}`,
        ``,
        `Patient's reply: ${replyText(ctx)}`,
      ].join("\n");
    },
    tools: gradeTools(),
    readTools: {},
    readSchemas: {},
    requiredTool: GRADE_TOOL,
    requiredSchema: Grade,
    effort: "low",
    maxSteps: 2,
    maxOutputTokens: 2000,
    apply: (args, ctx) => graded(args, ctx),
  };
}

/**
 * Discharge (spec A1, A2): Spark restates Dr. Okafor's notes in plain words beside the verbatim
 * text (fallback: the verbatim text alone), a clinician approves before it is sent, and a day
 * later Spark checks the patient's teach-back answers (fallback: keyword grading). Anything
 * unclear becomes a nurse call; the agent never answers clinical questions.
 */
export function createDischargeAgent(): ModelAgent<Summary> {
  const grade = gradeSpec();
  return {
    ...dischargeDescriptor,
    kind: "model",
    modelCapabilities: ["summary.draft", "teachback.run"],
    model: {
      system: SUMMARY_SYSTEM,
      input: (ctx) =>
        [
          `Patient language: ${(ctx.journey as Journey).patient.language}`,
          `Clinician notes (${MARIA_VISIT_NOTES.author}):`,
          notesText(),
          ``,
          `Booked follow-ups:`,
          bookedFacts(ctx.journey as Journey),
        ].join("\n"),
      tools: summaryTools(),
      readTools: {},
      readSchemas: {},
      requiredTool: SUMMARY_TOOL,
      requiredSchema: Summary,
      effort: "low",
      maxSteps: 2,
      maxOutputTokens: 1500,
      apply: (args) => applySummary(args),
    },
    modelFor: (ctx) =>
      ctx.capability === "teachback.run" ? (grade as ModelSpec<unknown>) : undefined,
    fallback: (ctx) => {
      if (ctx.capability === "teachback.run") {
        return graded(keywordGrade(replyText(ctx), ctx.journey as Journey), ctx);
      }
      return drafted([]);
    },
    handle: (ctx) => {
      if (!ctx.journey) return { summary: "no journey", next_events: [] };
      if (ctx.capability === "summary.send") return send(ctx);
      return { summary: `not handled: ${ctx.capability}`, next_events: [] };
    },
  };
}
