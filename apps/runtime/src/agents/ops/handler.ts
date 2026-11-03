import type { Engine } from "@throughline/engine/node";
import { z } from "zod";
import {
  OPS_POLICY,
  type DomainEvent,
  type Incident,
  type Journey,
  type OpsAction,
  type OpsActionLite,
  type SimRequest,
  type StationId,
} from "@throughline/shared";
import { campus } from "@throughline/hospital";
import type { HandlerContext, HandlerResult, ModelAgent, StationState } from "../../core/agent";
import { activeAt, scriptedIncidents } from "../../sim/incidents";
import { BOTTLENECK_MIN } from "../sensing/handler";
import { PREAMBLE, requiredToolLine } from "../../safety/preamble";
import { opsDescriptor } from "./descriptor";

const REPLICATES = 20;
const HORIZON_MIN = 90;
/** A change that saves less than this is not worth moving people for. */
const MIN_SAVING_MIN = 2;

interface Candidate {
  lite: OpsActionLite;
  title: string;
  params: OpsAction["params"];
}

function stationName(id: StationId): string {
  return campus.stations.find((s) => s.id === id)?.name ?? id;
}

function roomName(nodeId: string): string {
  return campus.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;
}

/** "2026-11-17T09:40:00-06:00" → "9:40", in the sim clock's own time zone. */
function clockTime(iso: string): string {
  return iso.slice(11, 16).replace(/^0/, "");
}

/** What the floor shows at this station, in plain words, for the manager and the inbox. */
function causeOf(station: StationId, active: Incident[]): string {
  const name = stationName(station);
  const i = active[0];
  if (!i) return `The wait at ${name} has stayed above ${BOTTLENECK_MIN} minutes`;
  const since = clockTime(i.from);
  if (i.kind === "room_down")
    return i.node_id
      ? `${roomName(i.node_id)} is down since ${since}`
      : `One ${name} room is out of service since ${since}`;
  if (i.kind === "short_staffed") return `${name} is short one staff member since ${since}`;
  return `More patients than usual have arrived at ${name} since ${since}`;
}

/** Patients to move to a sibling: half the gap between the two lines, within policy. */
function divertCount(here: number | undefined, there: number | undefined): number {
  if (here === undefined) return 3;
  const gap = Math.round((here - (there ?? 0)) / 2);
  return Math.min(OPS_POLICY.maxAffected, gap);
}

/**
 * Candidate actions for a bottleneck (spec V8), from the hospital's own data rather than a
 * list per station:
 * - a room is down and the station has another room: move its patients to the free room;
 *   otherwise open one more room or chair (or call in a float, when the station is short);
 * - the stations in the station's `ops.divert_to` take some of the waiting patients;
 * - at a front desk (`ops.front_desk`), a volunteer helps people through the paperwork.
 */
function candidates(
  station: StationId,
  at: string,
  active: Incident[],
  queue: (id: StationId) => number | undefined,
): Candidate[] {
  const list: Candidate[] = [];
  const st = campus.stations.find((s) => s.id === station);
  const name = stationName(station);
  const down = new Set(
    active.flatMap((i) => (i.kind === "room_down" && i.node_id ? [i.node_id] : [])),
  );
  const broken = [...down][0];
  const spare = broken ? st?.nodes.find((n) => !down.has(n)) : undefined;
  if (broken && spare) {
    list.push({
      lite: {
        id: `open-${spare.split(".")[1] ?? spare}-${at}`,
        kind: "open_server",
        station_id: station,
        at,
      },
      title: `Open an extra ${roomName(spare)} slot and move ${roomName(broken)} patients to ${roomName(spare)}`,
      params: { from_node: broken, to_node: spare },
    });
  } else {
    const short = active.some((i) => i.kind === "short_staffed");
    list.push({
      lite: { id: `open-${station}-${at}`, kind: "open_server", station_id: station, at },
      title: short ? `Call in a float staff member to ${name}` : `Open one more ${name} station`,
      params: {},
    });
  }
  for (const sibling of st?.ops?.divert_to ?? []) {
    const count = divertCount(queue(station), queue(sibling));
    if (count < 1) continue;
    list.push({
      lite: {
        id: `divert-${station}-${at}`,
        kind: "divert",
        station_id: station,
        to_station: sibling,
        count,
        at,
      },
      title: `Move ${count} waiting ${count === 1 ? "patient" : "patients"} to ${stationName(sibling)}`,
      params: { to_station: sibling, count },
    });
  }
  if (st?.ops?.front_desk) {
    list.push({
      lite: { id: `volunteer-${station}-${at}`, kind: "call_volunteer", station_id: station, at },
      title: `Call a volunteer to help at ${name}`,
      params: {},
    });
  }
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
  /** The simulated day (fixtures/day-2026-11-17.json). */
  day: SimRequest;
  /** The day the what-if replays, with any incidents staff reported. Defaults to `day`. */
  world?: () => SimRequest;
  /** Changes already applied today; an incident's forecast starts from them. */
  applied?: () => OpsActionLite[];
  /** Scripted and reported incidents. Defaults to the day's scripted disruptions. */
  incidents?: () => Incident[];
  /** Live station state, for the queue lengths a divert is sized from. */
  station?: (id: StationId) => StationState;
  journeys: () => Journey[];
  /** Which model writes proposals right now (OPS_BRAIN), for the proposal's byline. */
  brainLabel?: () => string;
}

const PROPOSE_TOOL = "propose_ops_action";

const Choice = z.object({
  candidate_id: z.string().min(1),
  title: z.string().min(1).max(120),
  rationale: z.string().min(1).max(400),
});
type Choice = z.infer<typeof Choice>;

const SYSTEM = `${PREAMBLE} You are the operations brain of a hospital outpatient campus. A station has a bottleneck. You get candidate actions, each with a simulated effect: the engine ran the rest of the day ${REPLICATES} times with and without it. Choose the one action a manager should approve. Prefer the largest wait reduction; weigh how many patients it moves and how disruptive it is. Use the engine's numbers as given and never invent numbers. Write a short title in plain words (an instruction to staff) and a two-sentence rationale for the manager. ${requiredToolLine(PROPOSE_TOOL)}`;

interface Ranked {
  option: Candidate;
  effect: {
    station_id: StationId;
    mean_wait_min: number;
    delta_min: number;
    affected_journeys: number;
  };
}

interface Analysis {
  station: StationId;
  ranked: Ranked[];
  baseline: number;
  cause: string;
  /** The engine's 90th-percentile wait over the horizon without any action. */
  p90: number;
  /** A reported incident the forecast says the floor absorbs: nothing to do. */
  quiet: boolean;
}

/** The engine's what-if for a bottleneck, memoized per event so input and apply agree. */
function analyze(
  ctx: HandlerContext,
  deps: OpsDeps,
  memo: Map<string, Analysis>,
): Analysis | undefined {
  const event = ctx.event;
  const trigger = event.type === "BottleneckDetected" || event.type === "IncidentReported";
  if (!trigger || !event.station_id) return undefined;
  const hit = memo.get(event.id);
  if (hit) return hit;
  const station = event.station_id;
  const active = activeAt(deps.incidents?.() ?? scriptedIncidents(deps.day), station, ctx.now);
  const queue = (id: StationId) =>
    id === station && ctx.station
      ? ctx.station.queue?.count_fused
      : deps.station?.(id).queue?.count_fused;
  const options = candidates(station, ctx.now, active, queue);
  const world = deps.world?.() ?? deps.day;
  const result = deps.engine.whatIf({
    ...world,
    // A reported incident is forecast from the floor as it is now, changes included. (The
    // sensing path keeps the day as recorded, so recorded runs replay unchanged.)
    ...(event.type === "IncidentReported" ? { actions: deps.applied?.() ?? [] } : {}),
    candidates: options.map((o) => o.lite),
    replicates: REPLICATES,
    horizon_min: HORIZON_MIN,
  });
  const ranked = result.per_action
    .map((effect, i) => ({ effect, option: options[i] as Candidate }))
    .filter((x) => x.option && x.effect.delta_min >= MIN_SAVING_MIN)
    .sort((a, b) => b.effect.delta_min - a.effect.delta_min);
  const base = result.baseline.find(
    (b) => b.station_id === (ranked[0]?.effect.station_id ?? station),
  );
  const baseline = base?.mean_wait_min ?? 0;
  const p90 = base?.p90_wait_min ?? 0;
  // A reported incident is planned for before the line builds: act only when the forecast
  // says the wait will cross the bottleneck line, and never on top of a waiting proposal.
  const quiet =
    event.type === "IncidentReported" &&
    (p90 <= BOTTLENECK_MIN ||
      (ctx.station?.ops_actions ?? []).some((x) => x.status === "proposed"));
  const analysis = {
    station,
    ranked: quiet ? [] : ranked,
    baseline,
    cause: causeOf(station, active),
    p90,
    quiet,
  };
  memo.set(event.id, analysis);
  if (memo.size > 50) memo.delete(memo.keys().next().value as string);
  return analysis;
}

function proposal(
  ctx: HandlerContext,
  deps: OpsDeps,
  a: Analysis,
  pick: Ranked,
  words: { title: string; rationale?: string; written_by: string },
): HandlerResult {
  const action: OpsAction = {
    id: pick.option.lite.id,
    kind: pick.option.lite.kind,
    params: pick.option.params,
    title: words.title,
    predicted_effect: {
      station_id: pick.effect.station_id,
      wait_before_min: a.baseline,
      wait_after_min: pick.effect.mean_wait_min,
      affected_journeys: pick.effect.affected_journeys,
    },
    evidence: {
      run_id: `whatif-${a.station}-${ctx.now}`,
      seed: deps.day.seed,
      replicates: REPLICATES,
      horizon_min: HORIZON_MIN,
    },
    status: "proposed",
    ...(words.rationale ? { rationale: words.rationale } : {}),
    written_by: words.written_by,
    cause: a.cause,
  };
  return {
    summary: `proposed: ${action.title} (${words.written_by})`,
    station_patch: (s) => ({ ...s, ops_actions: [...s.ops_actions, action] }),
    next_events: [{ type: "OpsActionProposed", station_id: a.station, payload: { action } }],
  };
}

/** The rule (spec 6 fallback): the engine's best option with its fixed title. */
function rule(ctx: HandlerContext, deps: OpsDeps, memo: Map<string, Analysis>): HandlerResult {
  const a = analyze(ctx, deps, memo);
  if (!a) return { summary: "not a bottleneck", next_events: [] };
  if (a.quiet)
    return {
      summary: `forecast wait at most ${Math.round(a.p90)} min; no change needed`,
      next_events: [],
    };
  const best = a.ranked[0];
  if (!best) {
    // Nothing the planner may do shortens the wait: a person decides, with the numbers.
    const event = ctx.event;
    const wait =
      event.type === "BottleneckDetected"
        ? `Wait about ${Math.round(event.payload.minutes)} min`
        : `Forecast wait up to about ${Math.round(a.p90)} min`;
    return {
      summary: "no candidate improves the wait; asked the manager",
      // The manager gets the same 30 minutes an applied change gets before the next flag.
      station_patch: (st) => ({ ...st, last_action_at: ctx.now }),
      next_events: [],
      tasks: [
        `${a.cause}. ${wait}. None of the changes the planner can make shortens it, so a manager needs to decide.`,
      ],
    };
  }
  return proposal(ctx, deps, a, best, { title: best.option.title, written_by: "rule" });
}

function situation(ctx: HandlerContext, a: Analysis): string {
  const event = ctx.event;
  return [
    `Station: ${stationName(a.station)} (${a.station}), at ${ctx.now}`,
    event.type === "BottleneckDetected"
      ? `Bottleneck: ${event.payload.severity}, predicted wait about ${Math.round(event.payload.minutes)} minutes`
      : `Reported by staff: ${a.cause}. Forecast 90th-percentile wait without action (engine): ${a.p90.toFixed(1)} minutes`,
    `Mean wait without action (engine): ${a.baseline.toFixed(1)} minutes`,
    `Candidates:`,
    ...a.ranked.map(
      (r) =>
        `- id ${r.option.lite.id}: ${r.option.title}. Mean wait after: ${r.effect.mean_wait_min.toFixed(1)} min (saves ${r.effect.delta_min.toFixed(1)}). Patients re-planned: ${r.effect.affected_journeys}.`,
    ),
  ].join("\n");
}

/**
 * The ops agent (spec 6, V8): the engine's what-if ranks the candidates with its numbers; the
 * ops brain (Muse Spark Open on Baseten, or Spark 1.3, by OPS_BRAIN) picks one and explains it
 * to the manager. The rule is the fallback. Applying waits for a manager (PRE_APPROVAL).
 */
export function createOpsAgent(deps: OpsDeps): ModelAgent<Choice> {
  const memo = new Map<string, Analysis>();
  return {
    ...opsDescriptor,
    kind: "model",
    modelCapabilities: ["ops_action.propose"],
    model: {
      system: SYSTEM,
      input: (ctx) => {
        const a = analyze(ctx, deps, memo);
        if (!a || a.ranked.length === 0) throw new Error("nothing to propose");
        return situation(ctx, a);
      },
      tools: [
        {
          type: "function",
          name: PROPOSE_TOOL,
          description: "Propose one candidate action to the operations manager.",
          strict: true,
          parameters: {
            type: "object",
            additionalProperties: false,
            required: ["candidate_id", "title", "rationale"],
            properties: {
              candidate_id: { type: "string", description: "The id of the chosen candidate" },
              title: { type: "string", description: "Short instruction to staff, plain words" },
              rationale: { type: "string", description: "Two sentences for the manager" },
            },
          },
        },
      ],
      readTools: {},
      readSchemas: {},
      requiredTool: PROPOSE_TOOL,
      requiredSchema: Choice,
      effort: "low",
      maxSteps: 2,
      maxOutputTokens: 2000,
      apply: (args, ctx) => {
        const a = analyze(ctx, deps, memo);
        const pick = a?.ranked.find((r) => r.option.lite.id === args.candidate_id);
        // An id that is not a candidate is a failed call: retry, then the rule.
        if (!a || !pick) throw new Error(`unknown candidate ${args.candidate_id}`);
        return proposal(ctx, deps, a, pick, {
          title: args.title,
          rationale: args.rationale,
          written_by: deps.brainLabel?.() ?? "Muse Spark",
        });
      },
    },
    fallback: (ctx) => rule(ctx, deps, memo),
    handle: (ctx) =>
      ctx.capability === "ops_action.apply"
        ? apply(ctx, deps)
        : { summary: `not handled: ${ctx.capability}`, next_events: [] },
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
