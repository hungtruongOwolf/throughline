"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { t, type CopyKey, type Journey } from "@throughline/shared";
import { Throughline } from "../../../components/Throughline";
import { clockTime } from "../../../lib/format";
import {
  clockCommand,
  fetchEvents,
  fetchJourney,
  startScenario,
  subscribeAll,
  type StoredEventView,
} from "../../../lib/runtime";

const LANG = "en" as const;

type Ev = StoredEventView["event"];

/** The visit-day beats of spec 10.3, each recognized from the event log. */
const BEATS: { key: CopyKey; match: (e: Ev) => boolean }[] = [
  { key: "control.beat.arrived", match: (e) => e.type === "PatientArrived" },
  {
    key: "control.beat.outage",
    match: (e) => e.type === "BottleneckDetected" && e.station_id === "imaging_ct",
  },
  { key: "control.beat.approved", match: (e) => e.type === "OpsActionApproved" },
  {
    key: "control.beat.ct",
    match: (e) => e.type === "StopStarted" && e.station_id === "imaging_ct",
  },
  { key: "control.beat.lost", match: (e) => e.type === "PatientLost" },
  { key: "control.beat.photo", match: (e) => e.type === "DirectionsSent" },
  { key: "control.beat.result", match: (e) => e.type === "ResultReady" },
  {
    key: "control.beat.clinic",
    match: (e) => e.type === "StopStarted" && e.station_id === "clinic_2a",
  },
  {
    key: "control.beat.infusion",
    match: (e) => e.type === "StopStarted" && e.station_id === "infusion",
  },
  { key: "control.beat.nurse", match: (e) => e.type === "HandoffRequested" },
  { key: "control.beat.checkout", match: (e) => e.type === "VisitCheckedOut" },
];

const HELD = new Set(["HumanReviewRequested", "OpsActionProposed"]);
const DECIDED = new Set([
  "OpsActionApproved",
  "OpsActionRejected",
  "HandoffResolved",
  "HumanReviewResolved",
]);

/** "OpsActionProposed" → "Ops action proposed". */
function words(type: string): string {
  const s = type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Frame({
  label,
  src,
  width,
  height,
  scale,
}: {
  label: string;
  src: string;
  width: number;
  height: number;
  scale: number;
}) {
  return (
    <figure
      aria-label={label}
      className="shrink-0 overflow-hidden border-2 border-ink"
      style={{ width: width * scale, height: height * scale }}
    >
      <iframe
        title={label}
        src={src}
        width={width}
        height={height}
        style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}
        className="border-0"
      />
    </figure>
  );
}

/**
 * Journey Control (spec 9.3): the demo and judging page. Three live frames (phone, the station
 * board for Maria's current stop, the campus map), the day as one line of beats, and the event
 * cascade with HELD markers where a person decided.
 */
export function JourneyControl({ journeyId }: { journeyId: string }) {
  const [events, setEvents] = useState<StoredEventView[]>([]);
  const [journey, setJourney] = useState<Journey | undefined>();
  const [autopilot, setAutopilot] = useState(true);

  const refresh = useCallback(() => {
    void fetchEvents()
      .then(setEvents)
      .catch(() => undefined);
    void fetchJourney(journeyId)
      .then(setJourney)
      .catch(() => undefined);
  }, [journeyId]);

  useEffect(() => {
    refresh();
    const stop = subscribeAll(refresh);
    const timer = setInterval(refresh, 3_000);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [refresh]);

  const beats = useMemo(() => {
    const found = BEATS.map((b) => events.find((s) => b.match(s.event))?.event);
    const firstOpen = found.findIndex((f) => !f);
    return BEATS.map((b, i) => ({
      key: b.key,
      status: found[i]
        ? ("done" as const)
        : i === firstOpen
          ? ("current" as const)
          : ("future" as const),
      content: (
        <span>
          {t(LANG, b.key)}
          {found[i] && (
            <span className="block tabular-nums text-ink-soft">
              {clockTime(found[i]?.occurred_at ?? "")}
            </span>
          )}
        </span>
      ),
    }));
  }, [events]);

  const current = journey?.itinerary?.stops.find(
    (s) => s.status !== "done" && s.status !== "skipped",
  );
  const boardStation = current?.station_id ?? "imaging_ct";
  const now = events.at(-1)?.event.occurred_at;

  return (
    <div className="grid h-dvh grid-rows-[64px_auto_1fr] bg-paper text-ink">
      <header className="flex items-center justify-between gap-6 px-6">
        <div className="flex items-baseline gap-6">
          <h1 className="font-display text-[28px] font-bold">{t(LANG, "control.title")}</h1>
          <span className="font-display text-[22px] font-semibold tabular-nums">
            {now ? clockTime(now) : ""}
          </span>
          <span className="text-[13px] text-ink-soft">{t(LANG, "control.note")}</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex min-h-12 items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={autopilot}
              onChange={(e) => setAutopilot(e.target.checked)}
              className="size-5 accent-line"
            />
            {t(LANG, "control.autopilot")}
          </label>
          <button
            type="button"
            onClick={() => void startScenario(autopilot, 60).then(refresh)}
            className="min-h-12 rounded-[12px] bg-line px-4 text-[15px] font-bold text-paper"
          >
            {t(LANG, "control.start")}
          </button>
          {([10, 60, 600] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              onClick={() => void clockCommand({ action: "start", speed })}
              className="min-h-12 min-w-12 rounded-[12px] font-display text-[18px] font-semibold"
            >
              {speed}x
            </button>
          ))}
          <button
            type="button"
            onClick={() => void clockCommand({ action: "stop" })}
            className="min-h-12 rounded-[12px] px-3 text-[15px] font-bold"
          >
            {t(LANG, "ops.pause")}
          </button>
        </div>
      </header>

      <section aria-label={t(LANG, "ops.timeline")} className="px-10 pb-4">
        <Throughline orientation="horizontal" label={t(LANG, "ops.timeline")} stops={beats} />
      </section>

      <main className="grid min-h-0 grid-cols-[auto_auto_1fr] gap-6 px-6 pb-6">
        <Frame
          label="Patient phone"
          src={`/p/${journeyId}`}
          width={390}
          height={844}
          scale={0.78}
        />
        <div className="flex flex-col gap-4">
          <Frame label="Campus map" src="/ops" width={1536} height={960} scale={0.42} />
          <Frame
            label="Station board"
            src={`/board/${boardStation}`}
            width={1280}
            height={800}
            scale={0.38}
          />
        </div>
        <aside aria-label={t(LANG, "control.events")} className="min-h-0 overflow-y-auto">
          <h2 className="font-display text-[22px] font-bold">{t(LANG, "control.events")}</h2>
          <ol className="mt-2 space-y-1 text-[13px]">
            {[...events].reverse().map(({ event }) => {
              const held = HELD.has(event.type);
              const decided = DECIDED.has(event.type);
              const by = typeof event.payload.by === "string" ? event.payload.by : undefined;
              return (
                <li
                  key={event.id}
                  className={`flex gap-2 py-0.5 ${held ? "bg-held-bg px-1 font-bold text-held" : ""}`}
                >
                  <span className="w-11 shrink-0 tabular-nums text-ink-soft">
                    {clockTime(event.occurred_at)}
                  </span>
                  <span>
                    {decided && (
                      <span aria-hidden className="mr-1 text-line">
                        ✓
                      </span>
                    )}
                    {words(event.type)}
                    {event.station_id && <span className="text-ink-soft"> {event.station_id}</span>}
                    {held && <span className="ml-1">({t(LANG, "control.held")})</span>}
                    {decided && by && (
                      <span className="text-ink-soft">
                        {" "}
                        {t(LANG, "control.decided", { name: by })}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>
      </main>
    </div>
  );
}
