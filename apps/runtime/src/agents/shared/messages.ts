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
