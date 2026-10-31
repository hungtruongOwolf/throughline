"use client";

import { useCallback, useEffect, useState } from "react";
import { loadEngine } from "@throughline/engine/web";
import {
  t,
  type Journey,
  type Language,
  type Message,
  type Stop as ItineraryStop,
  type WalkingRoute,
} from "@throughline/shared";
import { CurrentStop } from "../../../components/CurrentStop";
import { DirectionsSheet } from "../../../components/DirectionsSheet";
import { MessageBlock } from "../../../components/MessageBlock";
import { Stop } from "../../../components/Stop";
import { Throughline, type ThroughlineStop } from "../../../components/Throughline";
import { fetchJourney, postAction, subscribeJourney } from "../../../lib/runtime";
import { stationDisplay } from "../../../lib/stations";

type Load = { status: "loading" } | { status: "offline" } | { status: "ok"; journey: Journey };

/** The stop the patient should act on now: the first one that is not done or skipped. */
function currentIndex(stops: ItineraryStop[]): number {
  return stops.findIndex((s) => s.status !== "done" && s.status !== "skipped");
}

/** Stops and today's messages on one line, in time order. */
function lineItems(
  journey: Journey,
  lang: Language,
  handlers: { onShowWay: () => void; onImHere: (orderId: string) => void },
): ThroughlineStop[] {
  const stops = journey.itinerary?.stops ?? [];
  const current = currentIndex(stops);
  const day = journey.itinerary?.planned_at.slice(0, 10);
  const messages = journey.outreach_log.filter((m) => m.at.slice(0, 10) === day);
  const items: { at: string; item: ThroughlineStop }[] = [];

  stops.forEach((s, i) => {
    const d = stationDisplay(s.station_id, s.node_id);
    const status = i < current || current === -1 ? "done" : i === current ? "current" : "future";
    items.push({
      at: s.eta_start,
      item: {
        key: s.order_id,
        zone: d.zone,
        status,
        content:
          status === "current" ? (
            <CurrentStop
              name={d.name}
              zone={d.zone}
              floor={d.floor}
              peopleAhead={s.people_ahead ?? 0}
              waitMinutes={s.est_wait_min ?? 0}
              lang={lang}
              onShowWay={handlers.onShowWay}
              onImHere={() => handlers.onImHere(s.order_id)}
            />
          ) : (
            <Stop
              name={d.name}
              status={status}
              time={status === "done" ? s.eta_end : s.eta_start}
              lang={lang}
            />
          ),
      },
    });
  });
  messages.forEach((m: Message) =>
    items.push({
      at: m.at,
      item: { key: m.id, status: "note", content: <MessageBlock message={m} lang={lang} /> },
    }),
  );
  return items.sort((a, b) => a.at.localeCompare(b.at)).map((x) => x.item);
}

/**
 * Patient phone, visit day (spec 9.3): "where do I go next and how long will it take".
 * Left-aligned; the current stop is the only large thing; "Talk to a person" never moves.
 */
export function PatientPhone({ journeyId }: { journeyId: string }) {
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [sheet, setSheet] = useState(false);
  const [route, setRoute] = useState<WalkingRoute | undefined>();
  const [notice, setNotice] = useState<"handoff" | "check_in_failed" | undefined>();

  const refresh = useCallback(() => {
    fetchJourney(journeyId)
      .then((journey) => setLoad({ status: "ok", journey }))
      .catch(() => setLoad({ status: "offline" }));
  }, [journeyId]);

  useEffect(() => {
    refresh();
    return subscribeJourney(journeyId, refresh);
  }, [journeyId, refresh]);

  const journey = load.status === "ok" ? load.journey : undefined;
  const language: Language = journey?.patient.language ?? "en";
  const stops = journey?.itinerary?.stops ?? [];
  const current = stops[currentIndex(stops)];
  const from = journey?.last_location?.node_id ?? "mp1.entrance";
  const mobility = journey?.memory.mobility === "wheelchair" ? "wheelchair" : "walking";

  useEffect(() => {
    if (!sheet || !current) return;
    loadEngine()
      .then((engine) => setRoute(engine.walkingRoute({ from, to: current.node_id, mobility })))
      .catch(() => setRoute(undefined));
  }, [sheet, current, from, mobility]);

  const onImHere = (orderId: string) =>
    void postAction(journeyId, { action: "im_here", order_id: orderId }).then((ok) =>
      setNotice(ok ? undefined : "check_in_failed"),
    );
  const onTalk = () =>
    void postAction(journeyId, { action: "talk_to_person" }).then((ok) =>
      setNotice(ok ? "handoff" : "check_in_failed"),
    );

  return (
    <div
      lang={language}
      className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 pt-8 pb-6 text-[17px]"
    >
      <header className="flex items-center justify-between">
        <span className="font-bold">{t(language, "hospital.name")}</span>
      </header>

      <main className="mt-6 flex-1">
        {load.status === "loading" && (
          <p className="text-ink-soft">{t(language, "patient.loading")}</p>
        )}
        {load.status === "offline" && <p role="alert">{t(language, "patient.offline")}</p>}
        {journey && journey.phase !== "VISIT" && <p>{t(language, "patient.not_visit_day")}</p>}
        {journey && journey.phase === "VISIT" && (
          <Throughline
            label={t(language, "patient.itinerary_label")}
            stops={lineItems(journey, language, { onShowWay: () => setSheet(true), onImHere })}
          />
        )}
        {notice && (
          <p role="status" className="mt-2">
            {notice === "handoff"
              ? t(language, "patient.handoff_sent")
              : t(language, "patient.check_in_failed")}
          </p>
        )}
      </main>

      <footer className="sticky bottom-0 -mx-6 bg-paper px-6 pt-3 pb-1">
        <button type="button" onClick={onTalk} className="min-h-12 text-[17px] font-bold text-line">
          {t(language, "patient.talk_to_person")}
        </button>
        <p className="mt-1 text-[13px] text-ink-soft">{t(language, "footer.synthetic")}</p>
      </footer>

      {current && (
        <DirectionsSheet
          open={sheet}
          onClose={() => setSheet(false)}
          journeyId={journeyId}
          from={from}
          place={stationDisplay(current.station_id, current.node_id).name}
          route={route}
          lang={language}
        />
      )}
    </div>
  );
}
