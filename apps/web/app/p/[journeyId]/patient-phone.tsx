"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Journey, Message, Stop as ItineraryStop } from "@throughline/shared";
import { ZoneChip } from "../../../components/ZoneChip";
import { Wayfinding } from "../../../components/Wayfinding";
import { clockTime } from "../../../lib/format";
import { fetchJourney, postAction, postReply, subscribeJourney } from "../../../lib/runtime";
import { stationDisplay } from "../../../lib/stations";

type Load = { status: "loading" } | { status: "offline" } | { status: "ok"; journey: Journey };
type Tab = "before" | "today" | "after";

const DAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-11-14T07:00:00-06:00" → "Sat, Nov 14" (campus-local date, no conversion). */
function dayLabel(iso: string): string {
  return DAY.format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

/** 270 → "4½ hours", 40 → "40 minutes". */
function duration(minutes: number): string {
  if (minutes < 90) return `${minutes} minutes`;
  const halves = Math.round(minutes / 30) / 2;
  const whole = Math.floor(halves);
  return `${whole}${halves % 1 ? "½" : ""} hours`;
}

function currentIndex(stops: ItineraryStop[]): number {
  return stops.findIndex((s) => s.status !== "done" && s.status !== "skipped");
}

function tabFor(journey: Journey): Tab {
  if (journey.phase === "PRE") return "before";
  if (journey.phase === "VISIT") return "today";
  return "after";
}

function Check({
  done,
  title,
  children,
}: {
  done: boolean;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-[12px] bg-white p-4 ring-1 ring-ink/10">
      <span
        aria-hidden
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
          done ? "bg-line text-white" : "border-2 border-ink/25 text-ink-soft"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {title}
          <span className="sr-only">{done ? " (done)" : " (in progress)"}</span>
        </p>
        {children && <div className="mt-1 text-[15px] text-ink-soft">{children}</div>}
      </div>
    </li>
  );
}

function Texts({ messages }: { messages: Message[] }) {
  if (messages.length === 0) return null;
  return (
    <section aria-labelledby="texts" className="mt-8">
      <h2 id="texts" className="font-display text-[24px] font-bold">
        Texts with Halden
      </h2>
      <ul className="mt-3 space-y-3">
        {messages.map((m) => (
          <li key={m.id} className={`flex ${m.direction === "in" ? "justify-end" : ""}`}>
            <div
              className={`max-w-[85%] rounded-[16px] px-4 py-2.5 text-[16px] ${
                m.direction === "in" ? "bg-line text-white" : "bg-white ring-1 ring-ink/10"
              }`}
            >
              <p>{m.text}</p>
              <p
                className={`mt-1 text-[12px] ${m.direction === "in" ? "text-white" : "text-ink-soft"}`}
              >
                {dayLabel(m.at)} · {clockTime(m.at)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BeforeVisit({ journey, onConfirm }: { journey: Journey; onConfirm: () => void }) {
  const auth = journey.auth_packets.at(-1);
  const booked = [...journey.appointments]
    .filter((a) => a.status === "booked")
    .sort((a, b) => a.start.localeCompare(b.start));
  const days = [...new Set(booked.map((a) => a.start.slice(0, 10)))];
  const prep = journey.prep_plan;
  const confirmed = !!journey.confirmation;
  const authText = !auth
    ? journey.coverage?.auth_required_order_ids.length
      ? "Your care team is preparing a request to your insurer."
      : "Not needed for your visit."
    : auth.status === "approved"
      ? "Approved by your insurer."
      : auth.status === "denied"
        ? "Your insurer asked for more information. Your care team is handling it."
        : "Your care team is checking with your insurer. You don't need to do anything.";
  return (
    <div>
      <p className="font-display text-[32px] leading-tight font-bold">
        {confirmed
          ? `You're all set for ${dayLabel(booked[0]?.start ?? "")}.`
          : booked.length > 0
            ? "Please confirm your visit."
            : "We're getting your visit ready."}
      </p>
      <ul className="mt-5 space-y-3">
        <Check done title="Referral received">
          From {journey.referral.referring_provider}.
        </Check>
        <Check done={!!journey.coverage} title="Insurance checked">
          {journey.coverage
            ? `Coverage is active. Your specialist copay is $${journey.coverage.copay_cents / 100}.`
            : "We're checking your coverage."}
        </Check>
        <Check done={!auth || auth.status === "approved"} title="Insurance approval">
          {authText}
        </Check>
        <Check done={booked.length > 0} title="Appointments">
          {booked.length === 0 ? (
            "We're finding times that work for you."
          ) : (
            <ul className="space-y-2">
              {days.map((d) => (
                <li key={d}>
                  <span className="font-bold text-ink">{dayLabel(d)}</span>
                  <ul>
                    {booked
                      .filter((a) => a.start.startsWith(d))
                      .filter(
                        (a, i, all) =>
                          all.findIndex(
                            (x) => x.start === a.start && x.station_id === a.station_id,
                          ) === i,
                      )
                      .map((a) => (
                        <li key={a.id}>
                          {clockTime(a.start)} · {stationDisplay(a.station_id).name}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Check>
        {prep && (
          <Check done title="How to prepare">
            <ul className="list-disc space-y-1 pl-5">
              {prep.fasting_window_as_written && (
                <li>
                  From your doctor: <q>{prep.fasting_window_as_written}</q>
                </li>
              )}
              <li>Come in through the Main Entrance. Park in Garage A, level 1.</li>
              <li>
                Plan for about {duration(prep.estimated_minutes_on_site)} at the hospital on your
                longest day.
              </li>
              {journey.memory.mobility === "wheelchair" && (
                <li>A wheelchair will be waiting for you at the entrance.</li>
              )}
              <li>Bring your insurance card and a photo ID.</li>
            </ul>
          </Check>
        )}
        <Check done={confirmed} title="Visit confirmed">
          {confirmed ? (
            "Thank you. We'll text you a reminder the day before."
          ) : booked.length > 0 ? (
            <button
              type="button"
              onClick={onConfirm}
              className="mt-2 min-h-12 rounded-[12px] bg-line px-5 text-[17px] font-bold text-white"
            >
              Yes, I&apos;ll be there
            </button>
          ) : (
            "You'll be able to confirm once your times are booked."
          )}
        </Check>
      </ul>
    </div>
  );
}

function Today({
  journey,
  onDirections,
  onImHere,
}: {
  journey: Journey;
  onDirections: () => void;
  onImHere: (orderId: string) => void;
}) {
  const stops = journey.itinerary?.stops ?? [];
  const index = currentIndex(stops);
  const now = stops[index];
  const changed = (journey.kpis.replans ?? 0) > 0;
  if (!now) {
    return (
      <p className="font-display text-[32px] leading-tight font-bold">
        That was your last stop today. Thank you for coming in.
      </p>
    );
  }
  const d = stationDisplay(now.station_id, now.node_id);
  const ahead = now.people_ahead ?? 0;
  const wait = Math.round(now.est_wait_min ?? 0);
  return (
    <div>
      {changed && (
        <div
          role="status"
          className="mb-4 rounded-[12px] bg-held-bg p-4 text-[16px] ring-1 ring-held/30"
        >
          <p className="font-bold text-held">Your plan changed</p>
          <p className="mt-1">
            {journey.itinerary?.reason[0] ?? "We moved things around to save you time."}
          </p>
          <p className="mt-1 text-ink-soft">
            The times below are up to date. Nothing else changes.
          </p>
        </div>
      )}
      <section aria-labelledby="now" className="rounded-[16px] bg-white p-5 ring-1 ring-ink/10">
        <p className="text-[15px] font-bold text-line">
          {now.status === "waiting" || now.status === "in_service" ? "You're here" : "Go to"}
        </p>
        <h2 id="now" className="font-display text-[44px] leading-none font-bold">
          {d.name}
        </h2>
        <div className="mt-2">
          <ZoneChip zone={d.zone} floor={d.floor} lang="en" />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-[13px] text-ink-soft">Ahead of you</dt>
            <dd className="font-display text-[40px] leading-none font-bold">{ahead}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-soft">Wait</dt>
            <dd className="font-display text-[40px] leading-none font-bold">
              {wait}
              <span className="ml-1 text-[20px]">min</span>
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onDirections}
            className="min-h-12 flex-1 rounded-[12px] bg-line px-5 text-[17px] font-bold text-white"
          >
            Directions
          </button>
          {now.status !== "waiting" && now.status !== "in_service" && (
            <button
              type="button"
              onClick={() => onImHere(now.order_id)}
              className="min-h-12 flex-1 rounded-[12px] px-5 text-[17px] font-bold text-line ring-2 ring-line"
            >
              I&apos;m here
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="day" className="mt-8">
        <h2 id="day" className="font-display text-[24px] font-bold">
          Your day
        </h2>
        <ol className="mt-3 border-l-[6px] border-line/30 pl-5">
          {stops.map((s, i) => {
            const sd = stationDisplay(s.station_id, s.node_id);
            const state = i < index ? "done" : i === index ? "now" : "next";
            return (
              <li key={s.order_id} className="relative pb-4">
                <span
                  aria-hidden
                  className={`absolute top-1 -left-[32px] h-4 w-4 ${
                    state === "done"
                      ? "bg-ink"
                      : state === "now"
                        ? "h-5 w-5 bg-line"
                        : "border-2 border-ink bg-paper"
                  }`}
                />
                <p
                  className={`flex justify-between gap-3 ${state === "now" ? "font-bold" : state === "done" ? "text-ink-soft" : ""}`}
                >
                  <span>{sd.name}</span>
                  <span className="tabular-nums">
                    {state === "done"
                      ? `done ${clockTime(s.eta_end)}`
                      : `about ${clockTime(s.eta_start)}`}
                  </span>
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function After({ journey }: { journey: Journey }) {
  const summary = journey.summary;
  return (
    <div>
      <p className="font-display text-[32px] leading-tight font-bold">
        {summary ? "Your visit summary" : "Your summary will appear here after your visit."}
      </p>
      {summary && (
        <ul className="mt-4 space-y-3">
          {summary.draft.map((s) => (
            <li key={s.heading} className="rounded-[12px] bg-white p-4 ring-1 ring-ink/10">
              <p className="font-bold">{s.heading}</p>
              <p className="mt-1">{s.plain}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Maria's phone (UX research: MyChart-style checklist before, Delta "Today"-style card on the
 * day, gate-change banner when the plan moves, step-free 2D wayfinding). "Talk to a person"
 * never moves.
 */
export function PatientPhone({ journeyId }: { journeyId: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [tab, setTab] = useState<Tab | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [directions, setDirections] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const refresh = useCallback(() => {
    fetchJourney(journeyId)
      .then((journey) => setLoad({ status: "ok", journey }))
      .catch(() => setLoad({ status: "offline" }));
  }, [journeyId]);

  useEffect(() => {
    refresh();
    return subscribeJourney(journeyId, refresh);
  }, [journeyId, refresh]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (directions && !d.open) d.showModal();
    if (!directions && d.open) d.close();
  }, [directions]);

  const journey = load.status === "ok" ? load.journey : undefined;
  const active = tab ?? (journey ? tabFor(journey) : "today");
  const stops = journey?.itinerary?.stops ?? [];
  const now = stops[currentIndex(stops)];
  const from = journey?.last_location?.node_id ?? "mp1.entrance";

  const onImHere = (orderId: string) =>
    void postAction(journeyId, { action: "im_here", order_id: orderId }).then((ok) =>
      setNotice(
        ok
          ? "Thanks, the desk knows you're here."
          : "We couldn't record that. Show this screen at the desk.",
      ),
    );
  const onTalk = () =>
    void postAction(journeyId, { action: "talk_to_person" }).then((ok) =>
      setNotice(
        ok
          ? "A person from the clinic will call you soon."
          : "We couldn't reach the clinic. Call 555-0100.",
      ),
    );
  const onConfirm = () => void postReply(journeyId, "Yes, I'll be there.").then(refresh);

  return (
    <div className="min-h-dvh bg-paper">
      <div className="hidden bg-ink px-4 py-1.5 text-[13px] text-white/80 md:block">
        <Link href="/" className="font-bold text-white">
          ← Throughline demo
        </Link>{" "}
        · This is Maria&apos;s phone. Synthetic data.
      </div>
      <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-6 pb-4 text-[17px]">
        <header>
          <p className="text-[15px] font-bold text-ink-soft">Halden Medical Center</p>
          <p className="font-display text-[28px] font-bold">
            Hi, {journey?.patient.display_name.split(" ")[0] ?? "there"}
          </p>
          <div
            role="tablist"
            aria-label="Your care"
            className="mt-4 grid grid-cols-3 rounded-[12px] bg-ink/5 p-1"
          >
            {(
              [
                ["before", "Before"],
                ["today", "Visit day"],
                ["after", "After"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={active === id}
                onClick={() => setTab(id)}
                className={`min-h-11 rounded-[10px] text-[15px] font-bold ${active === id ? "bg-white shadow-sm" : "text-ink-soft"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <main className="mt-6 flex-1">
          {load.status === "loading" && <p className="text-ink-soft">Loading your plan</p>}
          {load.status === "offline" && (
            <p role="alert">
              We can&apos;t reach the hospital right now. Your plan may be out of date.
            </p>
          )}
          {journey && active === "before" && (
            <BeforeVisit journey={journey} onConfirm={onConfirm} />
          )}
          {journey &&
            active === "today" &&
            (journey.phase === "VISIT" ? (
              <Today
                journey={journey}
                onDirections={() => setDirections(true)}
                onImHere={onImHere}
              />
            ) : (
              <p className="font-display text-[28px] leading-tight font-bold">
                {journey.phase === "PRE"
                  ? "Your plan for the visit day will appear here."
                  : "Your visit day is over. See After."}
              </p>
            ))}
          {journey && active === "after" && <After journey={journey} />}
          {notice && (
            <p role="status" className="mt-4 rounded-[12px] bg-white p-3 ring-1 ring-ink/10">
              {notice}
            </p>
          )}
          {journey && <Texts messages={journey.outreach_log} />}
        </main>

        <footer className="sticky bottom-0 -mx-5 mt-6 border-t border-ink/10 bg-paper px-5 pt-3 pb-2">
          <button
            type="button"
            onClick={onTalk}
            className="min-h-12 text-[17px] font-bold text-line"
          >
            Talk to a person
          </button>
          <p className="text-[13px] text-ink-soft">Synthetic demo data. Not a real patient.</p>
        </footer>
      </div>

      <dialog
        ref={dialog}
        onClose={() => setDirections(false)}
        aria-label="Directions"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-paper p-0 backdrop:bg-ink/40"
      >
        <div className="mx-auto max-w-[480px] px-5 pt-4 pb-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDirections(false)}
              className="min-h-12 px-2 text-[17px] font-bold text-line"
            >
              Close
            </button>
          </div>
          {directions && now && (
            <Wayfinding
              from={from}
              to={now.node_id}
              title={stationDisplay(now.station_id, now.node_id).name}
              mobility={journey?.memory.mobility === "wheelchair" ? "wheelchair" : "walking"}
            />
          )}
        </div>
      </dialog>
    </div>
  );
}
