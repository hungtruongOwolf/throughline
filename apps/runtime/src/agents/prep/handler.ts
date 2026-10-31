import { campus } from "@throughline/hospital";
import { ORDER_TEMPLATES } from "@throughline/synthetic";
import { t, type Appointment, type Journey, type PrepPlan } from "@throughline/shared";
import type { AgentDescriptor, DeterministicAgent, HandlerResult } from "../../core/agent";
import { outboundMany, whenText } from "../shared/messages";

export const prepDescriptor: AgentDescriptor = {
  name: "prep",
  capabilities: ["prep.compose"],
  risk: "LOW",
};

const ENTRANCE = "mp1.entrance";
const ARRIVE_EARLY_MIN = 15;

function stationName(id: string): string {
  return campus.stations.find((s) => s.id === id)?.name ?? id;
}

/** Fasting instructions exactly as the ordering template wrote them, never invented. */
function fastingAsWritten(journey: Journey): string | undefined {
  const templates = Object.values(ORDER_TEMPLATES).flat();
  return journey.orders
    .map((o) => templates.find((tpl) => tpl.code_as_written === o.code_as_written))
    .find((tpl) => tpl?.fasting_as_written)?.fasting_as_written;
}

/** Minutes on site on the longest visit day, from the booked times plus arriving early. */
function minutesOnSite(appointments: Appointment[]): number {
  const byDay = new Map<string, Appointment[]>();
  for (const a of appointments)
    byDay.set(a.start.slice(0, 10), [...(byDay.get(a.start.slice(0, 10)) ?? []), a]);
  let longest = 0;
  for (const day of byDay.values()) {
    const start = Math.min(...day.map((a) => Date.parse(a.start)));
    const end = Math.max(...day.map((a) => Date.parse(a.end)));
    longest = Math.max(longest, (end - start) / 60_000);
  }
  return Math.max(1, Math.round(longest + ARRIVE_EARLY_MIN));
}

/** 270 → "4½ hours" ("4½ horas"), 40 → "40 minutes". */
function duration(minutes: number, lang: Journey["patient"]["language"]): string {
  if (minutes < 90) return lang === "es" ? `${minutes} minutos` : `${minutes} minutes`;
  const halves = Math.round(minutes / 30) / 2;
  const text = `${Math.floor(halves)}${halves % 1 ? "½" : ""}`;
  return lang === "es" ? `${text} horas` : `${text} hours`;
}

/** One line per appointment time; blood draws booked together appear once. */
function bookedList(appointments: Appointment[], lang: Journey["patient"]["language"]): string {
  const seen = new Set<string>();
  return [...appointments]
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .filter((a) => {
      const key = `${a.station_id}|${a.start}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((a) => `${whenText(a.start, lang)}, ${stationName(a.station_id)}`)
    .join("; ");
}

/**
 * Prep (spec B5): what to bring, fasting as written, entrance and parking, and how long to
 * plan for, sent in the patient's language after booking. Reminders are timers (sim/pre-visit).
 */
export function createPrepAgent(): DeterministicAgent {
  return {
    ...prepDescriptor,
    kind: "deterministic",
    handle: (ctx): HandlerResult => {
      const journey = ctx.journey;
      if (!journey) return { summary: "no journey", next_events: [] };
      const lang = journey.patient.language;
      const booked = journey.appointments.filter((a) => a.status === "booked");
      if (booked.length === 0) return { summary: "nothing booked", next_events: [] };
      const fasting = fastingAsWritten(journey);
      const minutes = minutesOnSite(booked);
      const entrance = t(lang, "prep.entrance");
      const wheelchair = journey.memory.mobility === "wheelchair";
      const plan: PrepPlan = {
        items: [
          { kind: "bring", text: t(lang, "prep.bring") },
          ...(fasting ? [{ kind: "fasting" as const, text: fasting }] : []),
          { kind: "entrance", text: entrance },
          { kind: "parking", text: t(lang, "prep.parking") },
          ...(wheelchair ? [{ kind: "transport" as const, text: t(lang, "prep.wheelchair") }] : []),
        ],
        ...(fasting ? { fasting_window_as_written: fasting } : {}),
        entrance: ENTRANCE,
        parking: t(lang, "prep.parking"),
        estimated_minutes_on_site: minutes,
        cards: [
          {
            id: "card-entrance",
            uri: "/cards/smoke-entrance.webp",
            alt: entrance,
          },
        ],
      };
      const texts = [
        t(lang, "prep.booked", { list: bookedList(booked, lang) }),
        ...(fasting ? [t(lang, "prep.fasting", { text: fasting })] : []),
        t(lang, "prep.arrive", {
          entrance,
          parking: plan.parking,
          duration: duration(minutes, lang),
        }),
        ...(wheelchair ? [t(lang, "prep.wheelchair")] : []),
        t(lang, "prep.bring"),
      ];
      const out = outboundMany(journey, texts, ctx.now);
      return {
        summary: `prep sent (${texts.length} messages)`,
        journey_patch: (j) => out.patch({ ...j, prep_plan: plan }),
        outbound: out.outbound,
        next_events: [
          {
            type: "PrepPlanSent",
            payload: { message_ids: out.messages.map((m) => m.id) },
          },
        ],
      };
    },
  };
}
