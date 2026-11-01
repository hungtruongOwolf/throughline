"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Journey, Message, Stop as ItineraryStop } from "@throughline/shared";
import { PatientComposer } from "../../../components/patient-composer";
import { SignPhoto } from "../../../components/sign-photo";
import { Wayfinding } from "../../../components/Wayfinding";
import { useUser, useHospital } from "../../../lib/session";
import { clockTime } from "../../../lib/format";
import {
  fetchJourney,
  fetchJourneyEvents,
  postAction,
  postReply,
  subscribeJourney,
  type JourneyEventView,
} from "../../../lib/runtime";
import { stationDisplay } from "../../../lib/stations";
import { guideFor, type Guide } from "../../../lib/visit-guide";

export type Phase = "before" | "visit" | "after";

// ---- formatting ------------------------------------------------------------------------

const LONG_DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const SHORT_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Campus-local date from a sim time; the offset is already in the string. */
function localDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}
const longDay = (iso: string) => LONG_DAY.format(localDate(iso));
const shortDay = (iso: string) => SHORT_DAY.format(localDate(iso));

/** "…T07:00…" → "7:00 am"; `shift` moves the clock by whole hours (wrapping at midnight). */
function amPm(iso: string, shift = 0): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return iso;
  const h = (((Number(m[1]) + shift) % 24) + 24) % 24;
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

/** When to stop eating: 8 hours before a blood draw, "midnight" rather than "1:00 am". */
function fastFrom(labStart: string): string {
  const m = /T(\d{2})/.exec(labStart);
  const h = m ? (Number(m[1]) + 16) % 24 : 0;
  return h >= 0 && h < 5 ? "midnight" : amPm(labStart, -8);
}

function hours(minutes: number): string {
  if (minutes < 90) return `${Math.round(minutes)} minutes`;
  const halves = Math.round(minutes / 30) / 2;
  return `${Math.floor(halves)}${halves % 1 ? "½" : ""} hours`;
}

function place(stationId: string, nodeId?: string): string {
  const d = stationDisplay(stationId, nodeId);
  return `${d.name}, Level ${d.floor}`;
}

const shortTitle = (g: Guide) => g.short;

// ---- data shaping ----------------------------------------------------------------------

interface PatientAppointment {
  key: string;
  start: string;
  station_id: string;
  guide: Guide;
}

/** Booked appointments as the patient sees them: blood tests drawn together are one. */
function appointments(journey: Journey): PatientAppointment[] {
  const out: PatientAppointment[] = [];
  const sorted = [...journey.appointments]
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => a.start.localeCompare(b.start));
  for (const a of sorted) {
    if (out.some((o) => o.station_id === a.station_id && o.start === a.start)) continue;
    const order = journey.orders.find((o) => o.id === a.order_id);
    out.push({
      key: a.id,
      start: a.start,
      station_id: a.station_id,
      guide: guideFor(order ?? { kind: "visit", station_id: a.station_id }),
    });
  }
  return out;
}

function trips(list: PatientAppointment[]): { day: string; items: PatientAppointment[] }[] {
  const days = [...new Set(list.map((a) => a.start.slice(0, 10)))];
  return days.map((day) => ({ day, items: list.filter((a) => a.start.startsWith(day)) }));
}

function dated(events: JourneyEventView[], type: string): string | undefined {
  const at = events.find((e) => e.event.type === type)?.event.occurred_at;
  return at ? shortDay(at) : undefined;
}

/** Checked out is the end of the visit day for the system, but "after" for the patient. */
function phaseOf(journey: Journey): Phase {
  if (journey.phase === "PRE") return "before";
  if (journey.phase === "VISIT" && journey.state !== "CHECKED_OUT") return "visit";
  return "after";
}

// ---- pieces ----------------------------------------------------------------------------

/** One dated entry on the line. The marker says done, needs you now, or coming up. */
function LineItem({
  date,
  state,
  title,
  children,
}: {
  date?: string;
  state: "done" | "now" | "later";
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[64px_24px_1fr] gap-x-3 pb-7 sm:grid-cols-[76px_24px_1fr]">
      <span className="pt-0.5 text-right font-display text-[19px] font-semibold text-ink-soft">
        {date ?? ""}
      </span>
      <span aria-hidden className="relative flex justify-center">
        <span className="absolute top-0 -bottom-7 w-[6px] bg-line/25" />
        <span
          className={`relative mt-1 block ${
            state === "done"
              ? "h-4 w-4 bg-line"
              : state === "now"
                ? "h-5 w-5 bg-held"
                : "h-4 w-4 border-[3px] border-line bg-paper"
          }`}
        />
      </span>
      <div className="min-w-0">
        <p className={`text-[18px] ${state === "later" ? "" : "font-bold"}`}>
          {title}
          <span className="sr-only">
            {state === "done" ? " (done)" : state === "now" ? " (needs you now)" : " (coming up)"}
          </span>
        </p>
        {children && <div className="mt-1 max-w-[62ch] text-[16px] text-ink-soft">{children}</div>}
      </div>
    </li>
  );
}

/** An appointment that opens to what it is, why, how long, and what to do. */
function AppointmentDetail({ a }: { a: PatientAppointment }) {
  return (
    <details className="group mt-3 border-l-[3px] border-ink/10 pl-4">
      <summary className="cursor-pointer list-none text-[17px] text-ink [&::-webkit-details-marker]:hidden">
        <span className="font-bold">{amPm(a.start)}</span> {a.guide.title}
        <span className="text-ink-soft">, {place(a.station_id)}. </span>
        <span className="text-[15px] font-bold text-line underline group-open:hidden">
          What to expect
        </span>
      </summary>
      <dl className="mt-2 grid max-w-[62ch] gap-2 pb-2 text-[16px]">
        <div>
          <dt className="font-bold text-ink">What happens</dt>
          <dd>{a.guide.what}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink">Why it is in this order</dt>
          <dd>{a.guide.why}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink">How long</dt>
          <dd>{a.guide.howLong}</dd>
        </div>
        <div>
          <dt className="font-bold text-ink">What you do</dt>
          <dd>
            <ul className="list-disc pl-5">
              {a.guide.youDo.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </details>
  );
}

const PHASES: [Phase, string][] = [
  ["before", "Before your visits"],
  ["visit", "Visit days"],
  ["after", "After your visit"],
];

/** The three parts of her care as one line; the part she is in is marked. */
function PhaseLine({
  shown,
  current,
  onChange,
}: {
  shown: Phase;
  current: Phase;
  onChange: (p: Phase) => void;
}) {
  const reachedUpTo = PHASES.findIndex(([id]) => id === current);
  return (
    <nav aria-label="Parts of your care" className="mt-5 grid grid-cols-3">
      {PHASES.map(([id, label], i) => (
        <button
          key={id}
          type="button"
          aria-current={shown === id ? "page" : undefined}
          onClick={() => onChange(id)}
          className="group text-left"
        >
          <span
            aria-hidden
            className={`block h-[6px] ${i <= reachedUpTo ? "bg-line" : "bg-line/20"}`}
          />
          <span
            className={`mt-2 block font-display text-[20px] sm:text-[22px] ${
              shown === id
                ? "font-bold text-ink underline decoration-[3px] underline-offset-[6px]"
                : "font-semibold text-ink-soft group-hover:text-ink"
            }`}
          >
            {label}
          </span>
          {id === current && (
            <span className="block text-[14px] font-bold text-held">You are here</span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ---- phases ----------------------------------------------------------------------------

function Before({
  journey,
  events,
  onConfirm,
}: {
  journey: Journey;
  events: JourneyEventView[];
  onConfirm?: () => void;
}) {
  const list = appointments(journey);
  const byTrip = trips(list);
  const confirmed = !!journey.confirmation;
  const auth = journey.auth_packets.at(-1);
  const next = list[0];
  const lab = list.find((a) => a.guide.title === "Blood tests");
  const authNames = journey.orders
    .filter((o) => journey.coverage?.auth_required_order_ids.includes(o.id))
    .map((o) => shortTitle(guideFor(o)));

  return (
    <div>
      <section aria-labelledby="next-heading">
        <h2 id="next-heading" className="text-[17px] font-bold text-ink-soft">
          Next for you
        </h2>
        {list.length === 0 ? (
          <p className="mt-1 font-display text-[40px] leading-tight font-bold">
            We are setting up your visits. You don&apos;t need to do anything yet.
          </p>
        ) : !confirmed ? (
          <>
            <p className="mt-1 font-display text-[40px] leading-tight font-bold">
              Please confirm your {byTrip.length === 1 ? "visit" : `${byTrip.length} trips`}:{" "}
              {byTrip.map((t) => longDay(t.day)).join(" and ")}.
            </p>
            {onConfirm && (
              <button
                type="button"
                onClick={onConfirm}
                className="mt-4 min-h-12 rounded-[12px] bg-line px-6 text-[17px] font-bold text-white"
              >
                Confirm my visits
              </button>
            )}
          </>
        ) : next ? (
          <>
            <p className="mt-1 font-display text-[40px] leading-tight font-bold">
              {longDay(next.start)}, {amPm(next.start)}: {shortTitle(next.guide)} at{" "}
              {stationDisplay(next.station_id).name}.
            </p>
            {lab && next.key === lab.key && (
              <p className="mt-2 text-[18px]">
                Nothing to eat or drink except water after {fastFrom(lab.start)} the night before.
              </p>
            )}
          </>
        ) : null}
      </section>

      <section aria-labelledby="setup-heading" className="mt-12">
        <h2 id="setup-heading" className="font-display text-[28px] font-bold">
          How your care is being set up
        </h2>
        <ol className="mt-5">
          <LineItem
            date={shortDay(journey.referral.received_at)}
            state="done"
            title="We received your referral"
          >
            {journey.referral.referring_provider} referred you for a first visit with a cancer
            doctor, with blood tests and a CT scan before it.
          </LineItem>
          <LineItem
            date={dated(events, "EligibilityChecked")}
            state={journey.coverage ? "done" : "now"}
            title={
              journey.coverage ? "We checked your insurance" : "We are checking your insurance"
            }
          >
            {journey.coverage
              ? `Your plan is active. Your copay for each specialist visit is $${journey.coverage.copay_cents / 100}.`
              : "This usually takes a few minutes."}
          </LineItem>
          {authNames.length > 0 && (
            <LineItem
              date={
                auth?.decided_at ? shortDay(auth.decided_at) : dated(events, "PriorAuthDrafted")
              }
              state={auth?.status === "approved" ? "done" : "now"}
              title={
                auth?.status === "approved"
                  ? `Your insurer approved the ${authNames.join(" and ")}`
                  : `We asked your insurer to approve the ${authNames.join(" and ")}`
              }
            >
              Your plan has to approve these before we can book them.{" "}
              {auth?.status === "approved"
                ? "That is done."
                : auth?.status === "denied"
                  ? "They asked for more information. Our team is sending it. You don't need to do anything."
                  : "It usually takes two business days. You don't need to do anything."}
            </LineItem>
          )}
          <LineItem
            date={dated(events, "AppointmentsBooked")}
            state={list.length > 0 ? "done" : "later"}
            title={
              list.length > 0
                ? `We booked ${byTrip.length === 1 ? "your visit" : `${byTrip.length} trips`}`
                : "We book your visits"
            }
          >
            {byTrip.length > 1
              ? "Your doctor needs your blood test results two days before you meet, so the blood tests are a short trip of their own. Everything else is on one morning."
              : "We pick mornings when you are free and put everything in the right order."}
          </LineItem>
          <LineItem
            date={journey.confirmation ? shortDay(journey.confirmation.confirmed_at) : undefined}
            state={confirmed ? "done" : list.length > 0 ? "now" : "later"}
            title={confirmed ? "You confirmed" : "You confirm"}
          >
            {confirmed
              ? "Thank you. We'll text you a reminder the day before each trip."
              : "Reply YES to our text, or use Confirm my visits."}
          </LineItem>
          {byTrip.map((t, i) => (
            <LineItem
              key={t.day}
              date={shortDay(t.day)}
              state={journey.phase === "PRE" ? "later" : "done"}
              title={`Trip ${i + 1}, ${longDay(t.day)}`}
            >
              {t.items.map((a) => (
                <AppointmentDetail key={a.key} a={a} />
              ))}
            </LineItem>
          ))}
        </ol>
      </section>
    </div>
  );
}

function VisitDay({
  journey,
  onImHere,
  onLocated,
}: {
  journey: Journey;
  onImHere: (orderId: string) => void;
  onLocated: () => void;
}) {
  const stops = journey.itinerary?.stops ?? [];
  if (journey.phase === "PRE" || stops.length === 0) {
    const byTrip = trips(appointments(journey));
    return (
      <div>
        <p className="font-display text-[40px] leading-tight font-bold">
          {byTrip.length > 0
            ? "On the day, this page tells you where to go next, how long the wait is, and the way there."
            : "Your visit days will appear here once they are booked."}
        </p>
        {byTrip.map((t, i) => (
          <section key={t.day} className="mt-8">
            <h2 className="font-display text-[28px] font-bold">
              Trip {i + 1}, {longDay(t.day)}
            </h2>
            {t.items.map((a) => (
              <AppointmentDetail key={a.key} a={a} />
            ))}
          </section>
        ))}
        <p className="mt-8 text-[17px]">
          Want to see the building first?{" "}
          <Link href="/map" className="font-bold text-line underline">
            Find your way around the hospital
          </Link>
          .
        </p>
      </div>
    );
  }

  const index = stops.findIndex((s) => s.status !== "done" && s.status !== "skipped");
  const now = stops[index];
  const first = stops[0] as ItineraryStop;
  const last = stops[stops.length - 1] as ItineraryStop;
  const total = (Date.parse(last.eta_end) - Date.parse(first.eta_start)) / 60_000;
  const from = journey.last_location?.node_id ?? "mp1.entrance";
  const changed = (journey.kpis.replans ?? 0) > 0;
  const guideOf = (s: ItineraryStop) =>
    guideFor(
      journey.orders.find((o) => o.id === s.order_id) ?? {
        kind: "visit",
        station_id: s.station_id,
      },
    );
  const here = now && (now.status === "waiting" || now.status === "in_service");
  const nowPlace = now ? stationDisplay(now.station_id, now.node_id) : undefined;

  return (
    <div>
      <p className="text-[17px] font-bold text-ink-soft">Today, {longDay(first.eta_start)}</p>
      <p className="mt-1 font-display text-[40px] leading-tight font-bold">
        {now
          ? `${stops.length} appointments, about ${hours(total)} in all. ${here ? "Now" : "Next"}: ${shortTitle(guideOf(now))}.`
          : "You're done for today. Thank you for coming in."}
      </p>

      {changed && (
        <div
          role="status"
          className="mt-6 border-l-[6px] border-held bg-held-bg px-5 py-4 text-[17px]"
        >
          <p className="font-bold text-held">Your plan changed</p>
          <p className="mt-1">
            {[...journey.outreach_log]
              .reverse()
              .find((m) => m.direction === "out" && m.text.startsWith("Your plan changed"))
              ?.text.replace("Your plan changed: ", "")
              .replace(/^./, (c) => c.toUpperCase()) ?? "We moved things around to save you time."}
          </p>
          <p className="mt-1 text-ink-soft">
            The times below are up to date. You don&apos;t need to do anything else.
          </p>
        </div>
      )}

      {now && nowPlace && (
        <section aria-labelledby="now-heading" className="mt-8">
          <h2 id="now-heading" className="font-display text-[32px] font-bold">
            {here
              ? `You're at ${nowPlace.name}`
              : `Go to ${nowPlace.name}, Level ${nowPlace.floor}`}
          </h2>
          <p className="mt-1 text-[18px]">
            {(now.people_ahead ?? 0) === 0
              ? "No one is ahead of you."
              : `${now.people_ahead} ${now.people_ahead === 1 ? "person is" : "people are"} ahead of you. The wait is about ${Math.max(1, Math.round(now.est_wait_min ?? 0))} minute${Math.round(now.est_wait_min ?? 0) > 1 ? "s" : ""}.`}
          </p>
          {!here && (
            <button
              type="button"
              onClick={() => onImHere(now.order_id)}
              className="mt-4 min-h-12 rounded-[12px] px-5 text-[17px] font-bold text-line ring-2 ring-line"
            >
              I&apos;m here
            </button>
          )}
          {!here && from !== now.node_id && (
            <div className="mt-6">
              <Wayfinding
                from={from}
                to={now.node_id}
                title={nowPlace.name}
                layout="wide"
                mobility={journey.memory.mobility === "wheelchair" ? "wheelchair" : "walking"}
              />
            </div>
          )}
          <SignPhoto journeyId={journey.id} onLocated={onLocated} />
        </section>
      )}

      <section aria-labelledby="day-heading" className="mt-12">
        <h2 id="day-heading" className="font-display text-[28px] font-bold">
          Your day
        </h2>
        <ol className="mt-5">
          {stops.map((s, i) => {
            const guide = guideOf(s);
            const state = index === -1 || i < index ? "done" : i === index ? "now" : "later";
            return (
              <LineItem
                key={s.order_id}
                date={clockTime(state === "done" ? s.eta_end : s.eta_start)}
                state={state}
                title={`${guide.title}, ${place(s.station_id, s.node_id)}`}
              >
                {state === "done" ? "Done." : `${guide.what} ${guide.howLong}`}
              </LineItem>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

const TOPIC_WORDS: Record<string, string> = {
  next_visit: "your next appointment",
  bring: "what to bring",
  who_to_call: "who to call",
};

function After({ journey }: { journey: Journey }) {
  const summary = journey.summary;
  const visitDone = phaseOf(journey) === "after";
  const closed = journey.phase === "COMPLETED";
  const followUps = appointments(journey).filter((a) => a.key.startsWith("appt-o-fu-"));
  const teachback = journey.teachback;
  const unclear = Object.entries(teachback?.answers ?? {})
    .filter(([, v]) => v !== "correct")
    .map(([k]) => TOPIC_WORDS[k] ?? k);
  const resulted = journey.orders.filter(
    (o) => o.status === "resulted" || o.status === "acknowledged",
  );
  const reviewed = resulted.length > 0 && resulted.every((o) => o.status === "acknowledged");
  const checkin = journey.logistics_checkin;
  const checkinAnswered = checkin?.wants_nurse_call !== undefined;
  return (
    <div>
      <p className="font-display text-[40px] leading-tight font-bold">
        {closed
          ? "Everything from this visit is done. Here is what comes next."
          : visitDone
            ? "Here is what happens now that your visit is over."
            : "After your visit, this is what happens, in this order."}
      </p>
      <ol className="mt-8">
        <LineItem
          date={followUps[0] ? shortDay(followUps[0].start) : undefined}
          state={followUps.length > 0 ? "done" : visitDone ? "now" : "later"}
          title="Your next appointments"
        >
          {followUps.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {followUps.map((a) => (
                <li key={a.key}>
                  <span className="font-bold text-ink">{a.guide.title}</span>, {longDay(a.start)} at{" "}
                  {amPm(a.start)}. {place(a.station_id)}.
                </li>
              ))}
            </ul>
          ) : (
            "We book your follow-up visit and blood tests, then send you the times and how to prepare, the same way as this time."
          )}
        </LineItem>
        <LineItem
          date={summary?.sent_at ? shortDay(summary.sent_at) : undefined}
          state={summary?.sent_at ? "done" : visitDone ? "now" : "later"}
          title="A summary of your visit, in plain words"
        >
          {summary?.sent_at ? (
            <div className="mt-1 space-y-3">
              {summary.draft.map((s) => (
                <section key={s.heading}>
                  <h4 className="font-bold text-ink">{s.heading}</h4>
                  <p>{s.plain}</p>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[15px] text-line underline">
                      As your doctor wrote it
                    </summary>
                    <p className="mt-1 text-[15px] text-ink-soft">{s.verbatim}</p>
                  </details>
                </section>
              ))}
              <p className="text-[15px] text-ink-soft">
                {summary.reviewed_by
                  ? `Checked by ${summary.reviewed_by}.`
                  : "Prepared from your care team's notes; not yet checked by a clinician."}
              </p>
            </div>
          ) : summary ? (
            "Your doctor is checking your summary. It arrives here and by text once it is signed."
          ) : (
            "Your care team writes down what you talked about and what comes next. A clinician checks it before it is sent to you here and by text, usually the same day."
          )}
        </LineItem>
        <LineItem
          date={teachback?.sent_at ? shortDay(teachback.sent_at) : undefined}
          state={teachback?.passed !== undefined ? "done" : teachback ? "now" : "later"}
          title="Three short questions to check it made sense"
        >
          {teachback?.passed === true
            ? "You had everything right. Thank you."
            : teachback?.passed === false
              ? `Thank you for answering. A nurse will call you to go over ${unclear.join(", ")}.`
              : teachback
                ? "We sent you three questions by text: when your next blood test is, what to bring, and who to call. Answer in your own words. It is not a test."
                : "For example, when your next appointment is and who to call. If anything is unclear, a nurse calls you. It is not a test."}
        </LineItem>
        <LineItem state={reviewed ? "done" : "later"} title="Your test results">
          {reviewed
            ? "Your doctor has reviewed your test results and goes over them with you at your next visit."
            : "Your doctor reviews your results and goes over them with you. We never send results by text."}
        </LineItem>
        <LineItem
          date={checkin?.sent_at ? shortDay(checkin.sent_at) : undefined}
          state={checkinAnswered ? "done" : checkin ? "now" : "later"}
          title="A check-in a few days later"
        >
          {checkinAnswered
            ? [
                checkin?.medication_picked_up ? "Prescription picked up." : undefined,
                checkin?.ride_confirmed ? "Ride to your next visit arranged." : undefined,
                checkin?.wants_nurse_call ? "A nurse will call you today." : undefined,
              ]
                .filter(Boolean)
                .join(" ") || "Thank you for answering."
            : checkin
              ? "We asked by text whether you picked up your prescription and have a ride to your next visit."
              : "We ask whether you picked up any prescriptions and have a ride to your next visit."}
        </LineItem>
      </ol>
    </div>
  );
}

// ---- page ------------------------------------------------------------------------------

function ToDo({ journey, onConfirm }: { journey: Journey; onConfirm?: () => void }) {
  const list = appointments(journey);
  const lab = list.find((a) => a.guide.title === "Blood tests");
  const items: { done: boolean; text: ReactNode }[] = [];
  const wheelchair = journey.memory.mobility === "wheelchair";
  if (journey.phase === "PRE") {
    if (list.length > 0)
      items.push({
        done: !!journey.confirmation,
        text:
          journey.confirmation || !onConfirm ? (
            "Confirm your visits"
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              className="text-left font-bold text-line underline"
            >
              Confirm your visits
            </button>
          ),
      });
    if (lab)
      items.push({
        done: false,
        text: `The night before ${shortDay(lab.start)}: nothing to eat or drink except water after ${fastFrom(lab.start)}.`,
      });
    items.push({ done: false, text: "Bring your insurance card and a photo ID." });
    items.push({ done: false, text: "Park in Garage A, level 1, next to the Main Entrance." });
    if (wheelchair)
      items.push({
        done: true,
        text: "A wheelchair will be waiting for you at the Main Entrance.",
      });
  } else if (phaseOf(journey) === "visit") {
    items.push({
      done: false,
      text: "When you reach each desk, press I'm here so the staff know.",
    });
    items.push({
      done: false,
      text: "Keep this page open. If your plan changes, it says so at the top.",
    });
    if (wheelchair)
      items.push({
        done: true,
        text: "Staff can push your wheelchair between buildings. Ask at any desk.",
      });
  } else {
    items.push({
      done: !!journey.summary?.sent_at,
      text: "Read your visit summary when it arrives.",
    });
    items.push({
      done: journey.teachback?.passed !== undefined,
      text: "Answer three short questions about it.",
    });
    items.push({
      done: !!journey.logistics_checkin?.medication_picked_up,
      text: "Pick up your prescription at the Outpatient Pharmacy, Level 1.",
    });
    const nextLab = appointments(journey).find((a) => a.key.startsWith("appt-o-fu-"));
    if (nextLab)
      items.push({
        done: !!journey.logistics_checkin?.ride_confirmed,
        text: `Plan a ride for ${shortDay(nextLab.start)}.`,
      });
  }
  return (
    <section aria-labelledby="todo-heading" className="border-[3px] border-ink/10 p-5">
      <h2 id="todo-heading" className="font-display text-[24px] font-bold">
        Your to-do
      </h2>
      <ul className="mt-3 space-y-3 text-[16px]">
        {items.map((it, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden
              className={`mt-0.5 h-5 w-5 shrink-0 ${it.done ? "bg-line" : "border-[3px] border-ink/30"}`}
            />
            <span className={it.done ? "text-ink-soft" : ""}>
              {it.text}
              <span className="sr-only">{it.done ? " (done)" : ""}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Messages({ messages }: { messages: Message[] }) {
  const hospital = useHospital();
  const recent = messages.slice(-4).reverse();
  if (recent.length === 0) return null;
  return (
    <section aria-labelledby="msg-heading" className="mt-8">
      <h2 id="msg-heading" className="font-display text-[24px] font-bold">
        Latest texts
      </h2>
      <ul className="mt-3 space-y-4 text-[16px]">
        {recent.map((m) => (
          <li key={m.id} className={m.direction === "in" ? "border-l-[3px] border-line pl-3" : ""}>
            <p className="text-[14px] text-ink-soft">
              {m.direction === "in" ? "You" : hospital.name}, {shortDay(m.at)} at {amPm(m.at)}
            </p>
            <p>{m.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Maria's patient portal (docs/DESIGN-PORTAL.md): one page, the three parts of her care on a
 * line, one "next for you" answer at the top, and every appointment explained from her side.
 */
export function PatientPortal({
  journeyId,
  embedded = false,
  phase: fixedPhase,
}: {
  journeyId: string;
  /** Inside the story: the story picks the part of care to show and owns the actions. */
  embedded?: boolean;
  phase?: Phase;
}) {
  const hospital = useHospital();
  const [journey, setJourney] = useState<Journey | undefined>();
  const [events, setEvents] = useState<JourneyEventView[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "offline">("loading");
  const [phase, setPhase] = useState<Phase | undefined>();
  const [notice, setNotice] = useState<string | undefined>();

  const { user } = useUser();
  const refresh = useCallback(() => {
    Promise.all([fetchJourney(journeyId), fetchJourneyEvents(journeyId).catch(() => [])])
      .then(([j, e]) => {
        setJourney(j);
        setEvents(e);
        setStatus("ok");
      })
      .catch(() => setStatus("offline"));
  }, [journeyId]);

  useEffect(() => {
    refresh();
    return subscribeJourney(journeyId, refresh);
  }, [journeyId, refresh]);

  const current = journey ? phaseOf(journey) : "before";
  const shown = fixedPhase ?? phase ?? current;
  const onConfirm = () =>
    void postReply(journeyId, "Yes, I'll be there.").then((ok) => {
      setNotice(
        ok
          ? "Confirmed. We'll text you a reminder the day before each trip."
          : `That didn't go through. Call ${hospital.phone} to confirm.`,
      );
      refresh();
    });
  const onImHere = (orderId: string) =>
    void postAction(journeyId, { action: "im_here", order_id: orderId }).then((ok) =>
      setNotice(
        ok
          ? "Thanks. The desk knows you're here."
          : "That didn't go through. Show this page at the desk.",
      ),
    );
  const onTalk = () =>
    void postAction(journeyId, { action: "talk_to_person" }).then((ok) =>
      setNotice(
        ok
          ? "A person from the clinic will call you soon."
          : `That didn't go through. Call ${hospital.phone}.`,
      ),
    );

  return (
    <div className={embedded ? "bg-paper text-ink" : "min-h-dvh bg-paper text-ink"}>
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-4">
          <p className="font-display text-[24px] font-bold">{hospital.name}</p>
          {user && !embedded && (
            <Link href={`/patients/${journeyId}`} className="text-[15px] text-line underline">
              Back to staff view
            </Link>
          )}
          <p className="ml-auto text-[16px]">{journey?.patient.display_name ?? ""}</p>
          <button
            type="button"
            onClick={onTalk}
            className="min-h-11 rounded-[12px] px-4 text-[16px] font-bold text-line ring-2 ring-line"
          >
            Talk to a person
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-8 pb-16">
        <h1 className="font-display text-[48px] leading-none font-bold">Your care plan</h1>
        <PhaseLine shown={shown} current={current} onChange={setPhase} />
        {notice && (
          <p
            role="status"
            className="mt-6 border-l-[6px] border-line bg-white px-4 py-3 text-[17px]"
          >
            {notice}
          </p>
        )}
        {status === "loading" && <p className="mt-10 text-ink-soft">Loading your plan.</p>}
        {status === "offline" && (
          <p role="alert" className="mt-10">
            We can&apos;t reach the hospital right now. Call {hospital.phone} if you need your
            times.
          </p>
        )}
        {journey && (
          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {shown === "before" && (
                <Before journey={journey} events={events} {...(embedded ? {} : { onConfirm })} />
              )}
              {shown === "visit" && (
                <VisitDay journey={journey} onImHere={onImHere} onLocated={refresh} />
              )}
              {shown === "after" && <After journey={journey} />}
            </div>
            <aside>
              <ToDo journey={journey} {...(embedded ? {} : { onConfirm })} />
              <section aria-labelledby="help-heading" className="mt-8">
                <h2 id="help-heading" className="font-display text-[24px] font-bold">
                  Questions
                </h2>
                <p className="mt-2 text-[16px]">
                  About times, directions, or insurance: call{" "}
                  <a href={`tel:${hospital.phone_href}`} className="font-bold text-line">
                    {hospital.phone}
                  </a>{" "}
                  or use Talk to a person.
                </p>
                <p className="mt-2 text-[16px] text-ink-soft">
                  Medical questions always go to a nurse, who calls you back.
                </p>
              </section>
              {!embedded && <PatientComposer journeyId={journeyId} onSent={refresh} />}
              <Messages messages={journey.outreach_log} />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
