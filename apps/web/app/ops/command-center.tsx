"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadEngine, type Engine } from "@throughline/engine/web";
import { t, type OpsOverview, type SimRequest, type StationId } from "@throughline/shared";
import day from "../../../../fixtures/day-2026-11-17.json";
import { CampusHero } from "../../components/CampusHero";
import { Proposal } from "../../components/Proposal";
import { WaitCurve } from "../../components/WaitCurve";
import { clockTime } from "../../lib/format";
import { fetchOverview, resolveReview, subscribeAll } from "../../lib/runtime";
import { stationName } from "../../lib/stations";

const MANAGER = "Operations manager";
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
export function CommandCenter({
  by = MANAGER,
  onApproved,
}: { by?: string; onApproved?: () => void } = {}) {
  const [overview, setOverview] = useState<OpsOverview | undefined>();
  const [offline, setOffline] = useState(false);
  const [station, setStation] = useState<StationId>("imaging_ct");
  const [engine, setEngine] = useState<Engine | undefined>();
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
    if (decision === "approved") onApproved?.();
    void resolveReview(reviewId, decision, by).finally(() => {
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
    <div className="grid min-h-full grid-cols-1 bg-canvas text-ink lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr_auto]">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1 px-6 pt-5 lg:col-span-2">
        <h1 className="font-figure text-[22px] font-semibold">Today on the floor</h1>
        <p className="text-[15px] text-ink-soft">
          {overview.in_house} people in the building.{" "}
          {(() => {
            const worst = [...overview.stations].sort((a, b) => b.est_wait_min - a.est_wait_min)[0];
            return worst && worst.est_wait_min >= 10
              ? `Longest wait: ${worst.name}, about ${Math.round(worst.est_wait_min)} minutes.`
              : "Waits are short everywhere.";
          })()}{" "}
          Select a station to forecast it.
        </p>
        <span className="ml-auto font-figure text-[15px] text-ink-soft tabular-nums">
          {dateLabel(now)}, {clockTime(now)}
        </span>
      </header>

      <main className="min-h-0 px-2">
        <CampusHero stations={overview.stations} selected={station} onSelect={setStation} />
      </main>

      <aside aria-label={t("en", "ops.proposals")} className="px-6 pt-2 lg:overflow-y-auto">
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

      <footer className="grid items-start gap-8 border-t border-rule bg-panel px-6 py-4 lg:col-span-2 lg:grid-cols-[1fr_minmax(0,560px)]">
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

        <section className="min-w-0">
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
