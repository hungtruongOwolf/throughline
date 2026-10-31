import type { Engine } from "@throughline/engine/node";
import type {
  Constraint,
  ItineraryPlan,
  ItineraryRequest,
  Journey,
  Stop,
  StationId,
  StopReq,
} from "@throughline/shared";
import type {
  DeterministicAgent,
  HandlerContext,
  HandlerResult,
  StationState,
} from "../../core/agent";
import { itineraryDescriptor } from "./descriptor";

export interface ItineraryDeps {
  engine: Engine;
  station: (id: StationId) => StationState;
}

/** Room moves from applied ops actions, e.g. CT 1 → CT 2 after the outage. */
function roomMoves(station: StationState): Map<string, string> {
  const moves = new Map<string, string>();
  for (const a of station.ops_actions) {
    const from = a.params.from_node;
    const to = a.params.to_node;
    if (a.status === "applied" && typeof from === "string" && typeof to === "string") {
      moves.set(from, to);
    }
  }
  return moves;
}

/** Order dependencies as engine constraints (spec 7.2): results back, provider sign-off. */
function constraints(journey: Journey): Constraint[] {
  const out: Constraint[] = [];
  for (const order of journey.orders) {
    for (const d of order.depends_on) {
      if (d.kind === "after_auth") continue;
      out.push({ kind: "before", a: d.order_id, b: order.id, min_gap_min: d.min_gap_minutes ?? 0 });
    }
  }
  return out;
}

/** The request the engine needs, rebuilt from the journey and live station state. */
export function itineraryRequest(
  journey: Journey,
  now: string,
  deps: ItineraryDeps,
): ItineraryRequest {
  const stops = journey.itinerary?.stops ?? [];
  const stations = new Set(stops.map((s) => s.station_id));
  const reqStops: StopReq[] = stops.map((s) => {
    const order = journey.orders.find((o) => o.id === s.order_id);
    const moved = roomMoves(deps.station(s.station_id)).get(s.node_id);
    const booked = journey.appointments.find((a) => a.order_id === s.order_id)?.start;
    const status =
      s.status === "done" ? "done" : s.status === "in_service" ? "in_service" : "pending";
    return {
      order_id: s.order_id,
      station_id: s.station_id,
      duration_min: order?.duration_min ?? 15,
      ...(moved || s.node_id ? { node_id: moved ?? s.node_id } : {}),
      // Moving to another room gives up the booked slot in the old one.
      ...(booked && !moved && status === "pending" ? { not_before: booked } : {}),
      status,
    };
  });
  const queues = [...stations].flatMap((id) => {
    const st = deps.station(id);
    if (st.queue === undefined && st.open_servers === undefined) return [];
    return [
      {
        station_id: id,
        count: st.queue?.count_fused ?? 0,
        ...(st.open_servers !== undefined ? { open_servers: st.open_servers } : {}),
      },
    ];
  });
  return {
    now,
    location: journey.last_location?.node_id ?? "mp1.lobby",
    mobility: journey.memory.mobility === "wheelchair" ? "wheelchair" : "walking",
    stops: reqStops,
    queues,
    constraints: constraints(journey),
  };
}

/** Engine plan → journey itinerary, keeping each stop's status. */
function toItinerary(
  plan: ItineraryPlan,
  previous: Stop[],
  now: string,
): NonNullable<Journey["itinerary"]> {
  return {
    planned_at: now,
    reason: plan.reason,
    stops: plan.stops.map((p) => ({
      order_id: p.order_id,
      station_id: p.station_id,
      node_id: p.node_id,
      status: previous.find((s) => s.order_id === p.order_id)?.status ?? "pending",
      eta_start: p.eta_start,
      eta_end: p.eta_end,
      people_ahead: p.people_ahead,
      est_wait_min: p.est_wait_min,
    })),
  };
}

/**
 * The itinerary agent (spec 6): the engine plans and re-plans; no model is involved.
 * Replans fire on ops actions, result-ready events, and queue deviations.
 */
export function createItineraryAgent(deps: ItineraryDeps): DeterministicAgent {
  return {
    ...itineraryDescriptor,
    kind: "deterministic",
    handle: (ctx) => (ctx.capability === "itinerary.plan" ? plan(ctx, deps) : replan(ctx, deps)),
  };
}

/** On arrival there is no itinerary yet: today's stops come from the orders (spec V2). */
function stopsFromOrders(journey: Journey, now: string): Stop[] {
  return journey.orders
    .filter((o) => o.status !== "resulted" && o.status !== "acknowledged")
    .map((o) => ({
      order_id: o.id,
      station_id: o.station_id,
      node_id: "",
      status: "pending" as const,
      eta_start: now,
      eta_end: now,
    }));
}

function plan(ctx: HandlerContext, deps: ItineraryDeps): HandlerResult {
  const journey = ctx.journey;
  if (!journey) return { summary: "nothing to plan", next_events: [] };
  const stops = journey.itinerary?.stops ?? stopsFromOrders(journey, ctx.now);
  if (stops.length === 0) return { summary: "nothing to plan", next_events: [] };
  const withStops = { ...journey, itinerary: { planned_at: ctx.now, reason: [], stops } };
  const req = itineraryRequest(withStops, ctx.now, deps);
  const result = deps.engine.planItinerary({
    ...req,
    stops: req.stops.map((s) => ({ ...s, status: "pending" as const })),
  });
  return {
    summary: `planned ${result.stops.length} stops`,
    next_events: [
      {
        type: "ItineraryPlanned",
        payload: { itinerary: toItinerary(result, stops, ctx.now) },
      },
    ],
  };
}

function replan(ctx: HandlerContext, deps: ItineraryDeps): HandlerResult {
  const journey = ctx.journey;
  const itinerary = journey?.itinerary;
  if (!journey || !itinerary) return { summary: "nothing to replan", next_events: [] };
  const req = itineraryRequest(journey, ctx.now, deps);
  const current: ItineraryPlan = {
    stops: itinerary.stops.map((s) => ({
      order_id: s.order_id,
      station_id: s.station_id,
      node_id: s.node_id,
      eta_arrive: s.eta_start,
      eta_start: s.eta_start,
      eta_end: s.eta_end,
      people_ahead: s.people_ahead ?? 0,
      est_wait_min: s.est_wait_min ?? 0,
      walk_seconds: 0,
    })),
    total_minutes: 0,
    walking_seconds: 0,
    reason: itinerary.reason,
  };
  const result = deps.engine.replanItinerary({ ...req, current });
  if (result.diff.length === 0) return { summary: "plan unchanged", next_events: [] };
  const next = toItinerary(result.plan, itinerary.stops, ctx.now);
  return {
    summary: `replanned: ${result.reason.join("; ")}`,
    next_events: [
      {
        type: "ItineraryReplanned",
        payload: { itinerary: next, reason: result.reason, diff: result.diff },
      },
    ],
  };
}
