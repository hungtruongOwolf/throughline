"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadEngine, type Engine } from "@throughline/engine/web";
import { t, type OpsOverview, type SimRequest, type StationId } from "@throughline/shared";
import day from "../../../../fixtures/day-2026-11-17.json";
import { IsoMap, type MapRoute } from "../../components/IsoMap";
import { Proposal } from "../../components/Proposal";
import { WaitCurve } from "../../components/WaitCurve";
import { clockTime } from "../../lib/format";
import { clockCommand, fetchOverview, resolveReview, subscribeAll } from "../../lib/runtime";
import { stationName } from "../../lib/stations";

const MANAGER = "manager.demo";
const DAY = day as SimRequest;
const DAY_START = Date.parse(DAY.start);
const DAY_END = Date.parse(DAY.end);

function dateLabel(iso: string): string {
  const d = new Date(Date.parse(iso.slice(0, 10) + "T12:00:00Z"));
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Predicted wait at one station over the day, every 5 minutes, with `extra` servers from `now`. */
function waitSeries(engine: Engine, station: StationId, now: string, extra: number): number[] {
  const actions = Array.from({ length: extra }, (_, i) => ({
    id: `slider-${i}`,
    kind: "open_server" as const,
    station_id: station,
    at: now,
  }));
  const result = engine.simulate({ ...DAY, actions, snapshot_every_min: 5 });
  return result.snapshots.filter((s) => s.station_id === station).map((s) => s.est_wait_min);
}

/**
 * Command center (spec 9.3): the isometric campus is the hero; journeys on the left,
 * proposals on the right, the day strip with the clock and the what-if slider at the bottom.
 */
export function CommandCenter() {
  const [overview, setOverview] = useState<OpsOverview | undefined>();
  const [offline, setOffline] = useState(false);
  const [selectedJourney, setSelectedJourney] = useState<string | undefined>();
  const [station, setStation] = useState<StationId>("imaging_ct");
  const [engine, setEngine] = useState<Engine | undefined>();
  const [route, setRoute] = useState<MapRoute | undefined>();
  const [extra, setExtra] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    fetchOverview()
      .then((o) => {
        setOverview(o);
        setOffline(false);
      })
      .catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    refresh();
    const stop = subscribeAll(refresh);
    const timer = setInterval(refresh, 5_000);
    void loadEngine().then(setEngine);
    return () => {
      stop();
      clearInterval(timer);
    };
  }, [refresh]);

  const journey = overview?.journeys.find(
    (j) => j.id === (selectedJourney ?? overview.journeys[0]?.id),
  );

  // The selected journey's line: from where the patient is, through the stops still ahead.
  useEffect(() => {
    if (!engine || !journey) return;
    const ahead = journey.stops.filter((s) => s.status !== "done" && s.status !== "skipped");
    const waypoints = [journey.last_node, ...ahead.map((s) => s.node_id)];
    const nodes: string[] = [];
    for (let i = 1; i < waypoints.length; i++) {
      const r = engine.walkingRoute({
        from: waypoints[i - 1] as string,
        to: waypoints[i] as string,
        mobility: journey.mobility,
      });
      nodes.push(...(i === 1 ? r.nodes : r.nodes.slice(1)));
    }
    setRoute({ nodes, here: journey.last_node });
  }, [engine, journey]);

  const now = overview?.now ?? DAY.start;
  const baseline = useMemo(
    () => (engine ? waitSeries(engine, station, now, 0) : []),
    [engine, station, now],
  );
  const scenario = useMemo(
    () => (engine ? waitSeries(engine, station, now, extra) : []),
    [engine, station, now, extra],
  );
  const nowFraction = Math.min(
    1,
    Math.max(0, (Date.parse(now) - DAY_START) / (DAY_END - DAY_START)),
  );
  const nowIndex = Math.round(nowFraction * (scenario.length - 1));
  const peak = Math.round(Math.max(0, ...scenario.slice(nowIndex)));

  const decide = (reviewId: string, decision: "approved" | "rejected") => {
    setBusy(true);
    void resolveReview(reviewId, decision, MANAGER).finally(() => {
      setBusy(false);
      refresh();
    });
  };

  if (!overview) {
    return (
      <p className="p-8">{offline ? t("en", "ops.unavailable") : t("en", "patient.loading")}</p>
    );
  }

  return (
    <div className="grid h-dvh grid-cols-[240px_1fr_360px] grid-rows-[64px_1fr_190px] bg-paper text-ink">
      <header className="col-span-3 flex items-center justify-between gap-6 px-6">
        <div className="flex items-baseline gap-6">
          <h1 className="font-bold">{t("en", "hospital.name")}</h1>
          <span className="font-display text-[22px] font-semibold tabular-nums">
            {dateLabel(now)}, {clockTime(now)}
          </span>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={t("en", "ops.speed")}>
          {([1, 10, 60] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={overview.running && overview.speed === speed}
              onClick={() => void clockCommand({ action: "start", speed }).then(refresh)}
              className={`min-h-12 min-w-12 rounded-[12px] px-2 font-display text-[18px] font-semibold ${overview.running && overview.speed === speed ? "bg-ink text-paper" : ""}`}
            >
              {speed}x
            </button>
          ))}
          <button
            type="button"
            onClick={() => void clockCommand({ action: "stop" }).then(refresh)}
            className="min-h-12 rounded-[12px] px-3 text-[15px] font-bold"
          >
            {t("en", "ops.pause")}
          </button>
          <span className="ml-4 text-[13px] text-ink-soft">{t("en", "footer.synthetic")}</span>
        </div>
      </header>

      <nav aria-label={t("en", "ops.journeys_label")} className="overflow-y-auto px-6 pt-2">
        <p className="text-[13px] text-ink-soft">{t("en", "ops.in_house")}</p>
        <p className="font-display text-[64px] leading-none font-bold tabular-nums">
          {overview.in_house}
        </p>
        <ul className="mt-6 space-y-1">
          {overview.journeys.map((j) => (
            <li key={j.id}>
              <button
                type="button"
                aria-pressed={journey?.id === j.id}
                onClick={() => setSelectedJourney(j.id)}
                className={`flex min-h-12 w-full flex-col items-start rounded-[12px] px-3 py-2 text-left ${journey?.id === j.id ? "bg-ink/5" : ""}`}
              >
                <span className="font-display text-[22px] font-semibold">
                  {j.initials} <span className="text-[16px] text-ink-soft">{j.ticket}</span>
                </span>
                <span className="text-[13px]">
                  {j.current ?? ""},{" "}
                  {j.minutes_behind > 0
                    ? t("en", "ops.minutes_behind", { minutes: j.minutes_behind })
                    : t("en", "ops.on_plan")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="min-h-0">
        <IsoMap
          stations={overview.stations}
          {...(route ? { route } : {})}
          onSelectStation={setStation}
        />
      </main>

      <aside aria-label={t("en", "ops.proposals")} className="overflow-y-auto px-6 pt-2">
        <h2 className="font-display text-[28px] font-bold">{t("en", "ops.proposals")}</h2>
        {overview.proposals.length === 0 && (
          <p className="mt-2 text-ink-soft">{t("en", "ops.no_proposals")}</p>
        )}
        <div className="mt-3 space-y-6">
          {[...overview.proposals].reverse().map((p) => (
            <Proposal
              key={p.review_id}
              proposal={p}
              busy={busy}
              onDecide={(d) => decide(p.review_id, d)}
            />
          ))}
        </div>
      </aside>

      <footer className="col-span-3 grid grid-cols-[1fr_auto] items-start gap-10 bg-ink/5 px-6 pt-4">
        <section aria-label={t("en", "ops.timeline")}>
          <p className="text-[13px] text-ink-soft">{t("en", "ops.timeline")}</p>
          <div className="relative mt-2 h-6 bg-paper">
            {overview.bottlenecks.map((b) => {
              const left = (Date.parse(b.from) - DAY_START) / (DAY_END - DAY_START);
              const width = (Date.parse(b.to) - Date.parse(b.from)) / (DAY_END - DAY_START);
              return (
                <span
                  key={`${b.station_id}-${b.from}`}
                  title={`${stationName(b.station_id)} ${clockTime(b.from)} to ${clockTime(b.to)}`}
                  className="absolute top-0 h-full bg-wait-high/70"
                  style={{ left: `${left * 100}%`, width: `${Math.max(0.4, width * 100)}%` }}
                />
              );
            })}
            <span
              aria-hidden
              className="absolute -top-1 h-8 w-[3px] bg-ink"
              style={{ left: `${nowFraction * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[13px] text-ink-soft tabular-nums">
            <span>7:00</span>
            <span>12:00</span>
            <span>17:00</span>
          </div>
          <p className="mt-3 text-[13px] text-ink-soft">{t("en", "ops.source_sim")}</p>
        </section>

        <section className="w-[560px]">
          <label htmlFor="whatif" className="block text-[15px] font-bold">
            {t("en", "ops.whatif_label", { station: stationName(station) })}: {extra}
          </label>
          <input
            id="whatif"
            type="range"
            min={0}
            max={3}
            step={1}
            value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="mt-2 w-full accent-line"
          />
          <WaitCurve
            baseline={baseline}
            scenario={scenario}
            nowFraction={nowFraction}
            width={560}
            height={70}
          />
          <p role="status" className="text-[13px]">
            {engine
              ? t("en", "ops.whatif_result", { peak, now: Math.round(scenario[nowIndex] ?? 0) })
              : t("en", "ops.whatif_running")}
          </p>
        </section>
      </footer>
    </div>
  );
}
