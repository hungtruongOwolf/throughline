import { campus } from "@throughline/hospital";
import {
  initials,
  ticketNumber,
  type DomainEvent,
  type Journey,
  type OpsOverview,
  type OpsProposal,
} from "@throughline/shared";
import type { SimBackground } from "./board";
import type { SimClock } from "./bus/sim-clock";
import type { RuntimeStore } from "./bus/store";
import type { Runtime } from "./core/runtime";

const BOTTLENECK_MIN = 15;

/** Everything the command center draws (spec 9.3), at the current sim time. */
export function buildOverview(
  store: RuntimeStore,
  runtime: Runtime,
  clock: SimClock,
  background: SimBackground,
): OpsOverview {
  const now = clock.now();
  const nowMs = Date.parse(now);
  const sim = background.get();

  const stations = campus.stations.map((s) => {
    const rows = sim.snapshots.filter((x) => x.station_id === s.id);
    const latest = [...rows].reverse().find((x) => Date.parse(x.at) <= nowMs);
    const series = rows
      .filter((x) => Date.parse(x.at) <= nowMs && Date.parse(x.at) > nowMs - 30 * 60_000)
      .map((x) => x.count);
    // Live station state (ops actions, sensing) overrides the simulated background.
    const live = runtime.station(s.id);
    const count = live.queue?.count_fused ?? latest?.count ?? 0;
    const open = live.open_servers ?? latest?.open_servers ?? s.servers;
    return {
      id: s.id,
      name: s.name,
      node_id: s.nodes[0] ?? "",
      waiting_node: s.waiting_node,
      count,
      open_servers: open,
      servers: s.servers,
      est_wait_min:
        Math.round(
          (open > 0 ? (count * s.service_min.mean) / open : count * s.service_min.mean) * 10,
        ) / 10,
      source: live.queue?.source ?? ("sim" as const),
      series,
    };
  });

  const journeys = store.listAggregates<Journey>("journey").map((j) => {
    const stops = j.itinerary?.stops ?? [];
    const current = stops.find((s) => s.status !== "done" && s.status !== "skipped");
    const behind = current
      ? Math.max(0, Math.round((nowMs - Date.parse(current.eta_start)) / 60_000))
      : 0;
    return {
      id: j.id,
      initials: initials(j.patient.display_name),
      ticket: ticketNumber(j.id),
      ...(current
        ? {
            current:
              campus.stations.find((s) => s.id === current.station_id)?.name ?? current.station_id,
          }
        : {}),
      minutes_behind: behind,
      mobility: j.memory.mobility === "wheelchair" ? ("wheelchair" as const) : ("walking" as const),
      last_node: j.last_location?.node_id ?? "mp1.entrance",
      stops: stops.map((s) => ({ station_id: s.station_id, node_id: s.node_id, status: s.status })),
    };
  });

  const proposals: OpsProposal[] = store
    .reviews()
    .filter((r) => r.capability === "ops_action.apply")
    .flatMap((r) => {
      const parked = r.pending_event as
        Extract<DomainEvent, { type: "OpsActionProposed" }> | undefined;
      if (!parked) return [];
      return [
        {
          review_id: r.id,
          status: r.status,
          ...(r.resolved_by ? { resolved_by: r.resolved_by } : {}),
          action: parked.payload.action,
        },
      ];
    });

  const bottlenecks: OpsOverview["bottlenecks"] = [];
  for (const s of campus.stations) {
    let from: string | undefined;
    let last: string | undefined;
    for (const snap of sim.snapshots) {
      if (snap.station_id !== s.id) continue;
      if (snap.est_wait_min > BOTTLENECK_MIN) {
        from ??= snap.at;
        last = snap.at;
      } else if (from && last) {
        bottlenecks.push({ station_id: s.id, from, to: last });
        from = undefined;
      }
    }
    if (from && last) bottlenecks.push({ station_id: s.id, from, to: last });
  }

  const inHouse =
    (sim.visits ?? []).reduce((set, v) => {
      if (Date.parse(v.reach) <= nowMs && (!v.end || Date.parse(v.end) > nowMs))
        set.add(v.patient_id);
      return set;
    }, new Set<string>()).size + journeys.length;

  return {
    now,
    speed: clock.speed,
    running: clock.running,
    in_house: inHouse,
    stations,
    journeys,
    proposals,
    bottlenecks,
  };
}
