import { randomUUID } from "node:crypto";
import { t, type Journey, type Language, type Message, type RouteStep } from "@throughline/shared";
import type { OutboundText } from "../../core/agent";

const DAY_MS = 24 * 60 * 60_000;

/**
 * Spec 11.2: the AI disclosure goes on first contact and whenever a conversation resumes
 * after 24 hours of silence.
 */
export function needsDisclosure(journey: Journey, now: string): boolean {
  const last = [...journey.outreach_log].reverse().find((m) => m.direction === "out");
  return !last || Date.parse(now) - Date.parse(last.at) >= DAY_MS;
}

/**
 * Builds an outbound patient message (and the disclosure before it when due) plus the
 * journey patch that records it. The text is also returned for the clinical-content screen.
 */
export function outbound(
  journey: Journey,
  text: string,
  now: string,
): { messages: Message[]; outbound: OutboundText[]; patch: (j: Journey) => Journey } {
  const lang = journey.patient.language;
  const messages: Message[] = [];
  if (needsDisclosure(journey, now)) {
    messages.push({
      id: randomUUID(),
      direction: "out",
      channel: "sms_sim",
      language: lang,
      text: t(lang, "disclosure.first_contact"),
      disclaimer: true,
      at: now,
    });
  }
  messages.push({
    id: randomUUID(),
    direction: "out",
    channel: "sms_sim",
    language: lang,
    text,
    disclaimer: false,
    at: now,
  });
  return {
    messages,
    outbound: [{ text, language: lang }],
    patch: (j) => ({ ...j, outreach_log: [...j.outreach_log, ...messages] }),
  };
}

/** Consecutive walking legs merged into one step, as on the phone (spec 9.3). */
export function directionSteps(steps: RouteStep[], lang: Language): string[] {
  const merged: RouteStep[] = [];
  for (const step of steps) {
    const prev = merged[merged.length - 1];
    if (prev?.kind === "walk" && step.kind === "walk") {
      merged[merged.length - 1] = { ...step, seconds: prev.seconds + step.seconds };
    } else {
      merged.push(step);
    }
  }
  return merged.map((s) =>
    s.kind === "elevator"
      ? t(lang, "directions.elevator", { place: s.to_label, floor: s.floor ?? "" })
      : s.kind === "stairs"
        ? t(lang, "directions.stairs", { floor: s.floor ?? "" })
        : t(lang, "directions.walk", { place: s.to_label, seconds: Math.round(s.seconds) }),
  );
}

/** Several outbound messages in one go; the disclosure (when due) goes before the first. */
export function outboundMany(
  journey: Journey,
  texts: string[],
  now: string,
): { messages: Message[]; outbound: OutboundText[]; patch: (j: Journey) => Journey } {
  const lang = journey.patient.language;
  const first = outbound(journey, texts[0] ?? "", now);
  const rest: Message[] = texts.slice(1).map((text) => ({
    id: randomUUID(),
    direction: "out",
    channel: "sms_sim",
    language: lang,
    text,
    disclaimer: false,
    at: now,
  }));
  const messages = [...first.messages, ...rest];
  return {
    messages,
    outbound: texts.map((text) => ({ text, language: lang })),
    patch: (j) => ({ ...j, outreach_log: [...j.outreach_log, ...messages] }),
  };
}

const WEEKDAYS: Record<Language, string[]> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  es: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
};
const MONTHS: Record<Language, string[]> = {
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  es: [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ],
};

/** "Monday, November 17 at 9:00" / "lunes 17 de noviembre a las 9:00", in campus local time. */
export function whenText(iso: string, lang: Language): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const weekday = WEEKDAYS[lang][date.getUTCDay()];
  const month = MONTHS[lang][Number(mo) - 1];
  const time = `${Number(h)}:${mi}`;
  return lang === "es"
    ? `${weekday} ${Number(d)} de ${month} a las ${time}`
    : `${weekday}, ${month} ${Number(d)} at ${time}`;
}
