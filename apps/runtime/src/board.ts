import { campus } from "@throughline/hospital";
import type { Engine } from "@throughline/engine/node";
import {
  initials,
  ticketNumber,
  type BoardRow,
  type BoardTask,
  type BoardView,
  type HumanReview,
  type Journey,
  type OpsActionLite,
  type SimRequest,
  type SimResult,
  type StationId,
} from "@throughline/shared";
import { generatePatients } from "@throughline/synthetic";
import type { RuntimeStore } from "./bus/store";

const minutesBetween = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 60_000;

function stationMeta(id: string) {
  const station = campus.stations.find((s) => s.id === id);
  const node = campus.nodes.find((n) => n.id === station?.nodes[0]);
  return {
    name: station?.name ?? id,
    floor: node?.floor ?? 1,
    zone: node?.zone ?? ("blue" as const),
  };
}

function nodeLabel(id: string): string {
  return campus.nodes.find((n) => n.id === id)?.label ?? id;
}

/**
 * The simulated day behind the boards: everyone except the live journeys, from
 * fixtures/day-2026-11-17.json. Computed once; the board reads it at the current sim time.
 */
export class SimBackground {
  private result: SimResult | undefined;
  private readonly actions: OpsActionLite[] = [];
  private readonly names: Map<string, string>;

  constructor(
    private readonly engine: Engine,
    private readonly day: SimRequest,
  ) {
    this.names = new Map(generatePatients(day.seed).map((p) => [p.id, p.display_name]));
  }

  get(): SimResult {
    this.result ??= this.engine.simulate({
      ...this.day,
      actions: [...this.actions],
      include_visits: true,
      snapshot_every_min: 1,
    });
    return this.result;
  }

  /** An approved ops action changes the simulated world from its time on (same seed). */
  apply(action: OpsActionLite): void {
    this.actions.push(action);
    this.result = undefined;
  }

  /** Demo reset: the day without any approved actions. */
  reset(): void {
    this.actions.length = 0;
    this.result = undefined;
  }

  name(patientId: string): string {
    return this.names.get(patientId) ?? patientId;
  }
}

/** Builds the station board (spec 9.3) at sim time `now`. */
export function buildBoard(
  stationId: StationId,
  now: string,
  store: RuntimeStore,
  background: SimBackground,
): BoardView {
  const meta = stationMeta(stationId);
  const sim = background.get();
  const journeys = store.listAggregates<Journey>("journey");
  const live = new Set(journeys.map((j) => j.patient.id));
  const nowMs = Date.parse(now);

  const rows: BoardRow[] = [];
  const tasks: BoardTask[] = [];
  const reviews = store.reviews("pending");

  // Live journeys whose current stop is here.
  for (const j of journeys) {
    const stops = j.itinerary?.stops ?? [];
    const i = stops.findIndex((s) => s.status !== "done" && s.status !== "skipped");
    const stop = stops[i];
    if (!stop || stop.station_id !== stationId) continue;
    const prev = stops[i - 1];
    const status =
      stop.status === "in_service"
        ? "in_service"
        : stop.status === "waiting"
          ? "waiting"
          : "walking";
    rows.push({
      key: `${j.id}:${stop.order_id}`,
      initials: initials(j.patient.display_name),
      ticket: ticketNumber(j.id),
      eta: stop.eta_start,
      status,
      ...(prev ? { from: stationMeta(prev.station_id).name } : {}),
      room: nodeLabel(stop.node_id),
      simulated: false,
      journey_id: j.id,
      order_id: stop.order_id,
    });
    if (j.lost) {
      tasks.push({
        key: `lost:${j.id}`,
        kind: "lost",
        ticket: ticketNumber(j.id),
        initials: initials(j.patient.display_name),
        journey_id: j.id,
        order_id: stop.order_id,
        minutes: Math.max(0, Math.round(minutesBetween(stop.eta_start, now))),
        reason: "no check-in",
      });
    }
    for (const r of reviews.filter((x) => x.journey_id === j.id && x.kind !== "approval")) {
      tasks.push(taskFromReview(r, j));
    }
  }

  // Simulated patients: walking here in the next 30 minutes, waiting, or in service.
  const prevStation = new Map<string, string>();
  for (const v of sim.visits ?? []) {
    if (live.has(v.patient_id)) continue;
    const reach = Date.parse(v.reach);
    const start = v.start ? Date.parse(v.start) : Infinity;
    const end = v.end ? Date.parse(v.end) : Infinity;
    if (v.station_id === stationId) {
      let status: BoardRow["status"] | undefined;
      if (reach > nowMs && reach <= nowMs + 30 * 60_000) status = "walking";
      else if (reach <= nowMs && nowMs < start) status = "waiting";
      else if (start <= nowMs && nowMs < end) status = "in_service";
      if (status) {
        const from = prevStation.get(v.patient_id);
        rows.push({
          key: `sim:${v.patient_id}:${v.reach}`,
          initials: initials(background.name(v.patient_id)),
          ticket: ticketNumber(v.patient_id),
          eta: status === "walking" ? v.reach : (v.start ?? v.reach),
          status,
          ...(from ? { from: stationMeta(from).name } : {}),
          room: nodeLabel(campus.stations.find((x) => x.id === stationId)?.nodes[0] ?? ""),
          simulated: true,
        });
      }
    }
    if (v.end && Date.parse(v.end) <= nowMs) prevStation.set(v.patient_id, v.station_id);
  }

  const order = { in_service: 0, waiting: 1, walking: 2 } as const;
  rows.sort((a, b) => order[a.status] - order[b.status] || a.eta.localeCompare(b.eta));

  const series = sim.snapshots
    .filter((s) => s.station_id === stationId)
    .filter((s) => {
      const t = Date.parse(s.at);
      return t <= nowMs && t > nowMs - 30 * 60_000;
    })
    .map((s) => ({ at: s.at, count: s.count }));
  const liveWaiting = rows.filter((r) => !r.simulated && r.status === "waiting").length;

  return {
    station_id: stationId,
    ...meta,
    now,
    // Live rows always ship; simulated rows are capped.
    arriving: [
      ...rows.filter((r) => !r.simulated),
      ...rows.filter((r) => r.simulated).slice(0, 8),
    ].sort((a, b) => order[a.status] - order[b.status] || a.eta.localeCompare(b.eta)),
    waiting_now: (series[series.length - 1]?.count ?? 0) + liveWaiting,
    series,
    source: "sim",
    tasks,
  };
}

function taskFromReview(r: HumanReview, j: Journey): BoardTask {
  return {
    key: `review:${r.id}`,
    kind: r.kind === "handoff" ? "handoff" : "task",
    ticket: ticketNumber(j.id),
    initials: initials(j.patient.display_name),
    journey_id: j.id,
    review_id: r.id,
    reason: r.reason,
  };
}
