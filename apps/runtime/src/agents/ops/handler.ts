import type { Engine } from "@throughline/engine/node";
import { z } from "zod";
import type {
  DomainEvent,
  Journey,
  OpsAction,
  OpsActionLite,
  SimRequest,
  StationId,
} from "@throughline/shared";
import { campus } from "@throughline/hospital";
import type { HandlerContext, HandlerResult, ModelAgent } from "../../core/agent";
import { PREAMBLE, requiredToolLine } from "../../safety/preamble";
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
}

/** The engine's what-if for a bottleneck, memoized per event so input and apply agree. */
function analyze(
  ctx: HandlerContext,
  deps: OpsDeps,
  memo: Map<string, Analysis>,
): Analysis | undefined {
  const event = ctx.event;
  if (event.type !== "BottleneckDetected" || !event.station_id) return undefined;
  const hit = memo.get(event.id);
  if (hit) return hit;
  const station = event.station_id;
  const options = candidates(station, ctx.now);
  const result = deps.engine.whatIf({
    ...deps.day,
    candidates: options.map((o) => o.lite),
    replicates: REPLICATES,
    horizon_min: HORIZON_MIN,
  });
  const ranked = result.per_action
    .map((effect, i) => ({ effect, option: options[i] as Candidate }))
    .filter((x) => x.option && x.effect.delta_min > 0)
    .sort((a, b) => b.effect.delta_min - a.effect.delta_min);
  const baseline =
    result.baseline.find((b) => b.station_id === (ranked[0]?.effect.station_id ?? station))
      ?.mean_wait_min ?? 0;
  const analysis = { station, ranked, baseline };
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
  const best = a.ranked[0];
  if (!best) return { summary: "no candidate improves the wait", next_events: [] };
  return proposal(ctx, deps, a, best, { title: best.option.title, written_by: "rule" });
}

function situation(ctx: HandlerContext, a: Analysis): string {
  const event = ctx.event as Extract<DomainEvent, { type: "BottleneckDetected" }>;
  return [
    `Station: ${stationName(a.station)} (${a.station}), at ${ctx.now}`,
    `Bottleneck: ${event.payload.severity}, predicted wait about ${Math.round(event.payload.minutes)} minutes`,
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
