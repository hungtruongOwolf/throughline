import type { Engine } from "@throughline/engine/node";
import type {
  DomainEvent,
  Journey,
  OpsAction,
  OpsActionLite,
  SimRequest,
  StationId,
} from "@throughline/shared";
import { campus } from "@throughline/hospital";
import type { DeterministicAgent, HandlerContext, HandlerResult } from "../../core/agent";
import { opsDescriptor } from "./descriptor";

/** Clinic pods are siblings: a divert moves waiting patients to the other pod. */
const SIBLINGS: Partial<Record<StationId, StationId>> = {
  clinic_2a: "clinic_2b",
  clinic_2b: "clinic_2a",
};

const REPLICATES = 20;
const HORIZON_MIN = 90;

interface Candidate {
  lite: OpsActionLite;
  title: string;
  params: OpsAction["params"];
}

function stationName(id: StationId): string {
  return campus.stations.find((s) => s.id === id)?.name ?? id;
}

/**
 * Candidate actions for a bottleneck (spec V8): open a server, divert to a sibling, call a
 * volunteer to the lobby. For CT, "open a server" means opening a CT 2 slot and moving CT 1
 * patients there, which is how the outage is handled in the scenario.
 */
function candidates(station: StationId, at: string): Candidate[] {
  const list: Candidate[] = [];
  if (station === "imaging_ct") {
    list.push({
      lite: { id: `open-ct2-${at}`, kind: "open_server", station_id: station, at },
      title: "Open an extra CT 2 slot and move CT 1 patients to CT 2",
      params: { from_node: "mp2.ct1", to_node: "mp2.ct2" },
    });
  } else {
    list.push({
      lite: { id: `open-${station}-${at}`, kind: "open_server", station_id: station, at },
      title: `Open one more ${stationName(station)} station`,
      params: {},
    });
  }
  const sibling = SIBLINGS[station];
  if (sibling) {
    list.push({
      lite: {
        id: `divert-${station}-${at}`,
        kind: "divert",
        station_id: station,
        to_station: sibling,
        count: 3,
        at,
      },
      title: `Move 3 waiting patients to ${stationName(sibling)}`,
      params: { to_station: sibling, count: 3 },
    });
  }
  list.push({
    lite: { id: `volunteer-${at}`, kind: "call_volunteer", station_id: "registration", at },
    title: "Call a volunteer to the main lobby",
    params: {},
  });
  return list;
}

/** Live journeys whose next stop is at `station`: the ones an action there re-plans. */
function affected(journeys: Journey[], station: StationId): string[] {
  return journeys
    .filter((j) => {
      const next = j.itinerary?.stops.find((s) => s.status !== "done" && s.status !== "skipped");
      return next?.station_id === station && next.status !== "in_service";
    })
    .map((j) => j.id);
}

export interface OpsDeps {
  engine: Engine;
  /** Applying an action changes the simulated world from then on. */
  onApplied?: (action: OpsActionLite) => void;
  /** The simulated day the what-if replays (fixtures/day-2026-11-17.json). */
  day: SimRequest;
  journeys: () => Journey[];
}

/**
 * The ops agent, deterministic path (spec 6, fallback "rule"): the engine's what-if ranks the
 * candidates and the best one becomes a proposal with its evidence. D4-4 adds the Spark /
 * Spark Open brain that writes the proposal; the numbers stay the engine's.
 */
export function createOpsAgent(deps: OpsDeps): DeterministicAgent {
  return {
    ...opsDescriptor,
    kind: "deterministic",
    handle: (ctx) =>
      ctx.capability === "ops_action.apply" ? apply(ctx, deps) : propose(ctx, deps),
  };
}

function propose(ctx: HandlerContext, deps: OpsDeps): HandlerResult {
  const event = ctx.event;
  if (event.type !== "BottleneckDetected" || !event.station_id) {
    return { summary: "not a bottleneck", next_events: [] };
  }
  const station = event.station_id;
  const options = candidates(station, ctx.now);
  const result = deps.engine.whatIf({
    ...deps.day,
    candidates: options.map((o) => o.lite),
    replicates: REPLICATES,
    horizon_min: HORIZON_MIN,
  });
  const ranked = result.per_action
    .map((effect, i) => ({ effect, option: options[i] }))
    .filter((x) => x.option && x.effect.delta_min > 0)
    .sort((a, b) => b.effect.delta_min - a.effect.delta_min);
  const best = ranked[0];
  if (!best?.option) return { summary: "no candidate improves the wait", next_events: [] };

  const baseline = result.baseline.find((b) => b.station_id === best.effect.station_id);
  const action: OpsAction = {
    id: best.option.lite.id,
    kind: best.option.lite.kind,
    params: best.option.params,
    title: best.option.title,
    predicted_effect: {
      station_id: best.effect.station_id,
      wait_before_min: baseline?.mean_wait_min ?? 0,
      wait_after_min: best.effect.mean_wait_min,
      affected_journeys: best.effect.affected_journeys,
    },
    evidence: {
      run_id: `whatif-${station}-${ctx.now}`,
      seed: deps.day.seed,
      replicates: REPLICATES,
      horizon_min: HORIZON_MIN,
    },
    status: "proposed",
  };
  return {
    summary: `proposed: ${action.title}`,
    station_patch: (s) => ({ ...s, ops_actions: [...s.ops_actions, action] }),
    next_events: [{ type: "OpsActionProposed", station_id: station, payload: { action } }],
  };
}

function apply(ctx: HandlerContext, deps: OpsDeps): HandlerResult {
  const event = ctx.event as Extract<DomainEvent, { type: "OpsActionProposed" }>;
  const action = event.payload.action;
  const station = action.predicted_effect.station_id;
  const servers = campus.stations.find((s) => s.id === station)?.servers ?? 1;
  const affectedIds = affected(deps.journeys(), station);
  deps.onApplied?.({
    id: action.id,
    kind: action.kind,
    station_id: station,
    at: ctx.now,
    ...(typeof action.params.count === "number" ? { count: action.params.count } : {}),
    ...(typeof action.params.to_station === "string"
      ? { to_station: action.params.to_station as OpsActionLite["station_id"] }
      : {}),
  });
  return {
    summary: `applied: ${action.title} (approved by ${ctx.approved_by ?? "unknown"})`,
    station_patch: (s) => ({
      ...s,
      ...(action.kind === "open_server" ? { open_servers: (s.open_servers ?? servers) + 1 } : {}),
      last_action_at: ctx.now,
      ops_actions: s.ops_actions.map((a) => (a.id === action.id ? { ...a, status: "applied" } : a)),
    }),
    next_events: [
      {
        type: "OpsActionApplied",
        station_id: station,
        payload: { action_id: action.id, affected_journey_ids: affectedIds },
      },
    ],
  };
}
