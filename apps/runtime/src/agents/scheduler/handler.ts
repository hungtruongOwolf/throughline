import type { Engine } from "@throughline/engine/node";
import {
  DEFAULT_SEED,
  generateSlots,
  PATIENT_AVAILABILITY,
  REFERRAL_AVAILABILITY,
  type Slot,
} from "@throughline/synthetic";
import type {
  Appointment,
  DomainEvent,
  Journey,
  Order,
  ScheduleRequest,
  SchedulePlan,
  StationId,
} from "@throughline/shared";
import type {
  AgentDescriptor,
  DeterministicAgent,
  HandlerContext,
  HandlerResult,
} from "../../core/agent";

export const schedulerDescriptor: AgentDescriptor = {
  name: "scheduler",
  capabilities: ["schedule.plan", "schedule.book", "noshow.score"],
  risk: "LOW",
};

export interface SchedulerDeps {
  engine: Engine;
  /** Other journeys' bookings take slot capacity (no double booking). */
  journeys?: () => Journey[];
}

/** Booked appointments of other journeys, by station and start. */
export function takenSlots(journeys: Journey[], except: string): Map<string, number> {
  const taken = new Map<string, number>();
  for (const j of journeys) {
    if (j.id === except) continue;
    for (const a of j.appointments) {
      if (a.status !== "booked") continue;
      const key = `${a.station_id}@${a.start}`;
      taken.set(key, (taken.get(key) ?? 0) + 1);
    }
  }
  return taken;
}

/** How far ahead the scheduler looks (spec B4: within the referral's two weeks, plus slack). */
const HORIZON_DAYS = 20;
const TZ = "-06:00";

let slotCache: Slot[] | undefined;
function slots(): Slot[] {
  slotCache ??= generateSlots(DEFAULT_SEED, "2026-11-10", 30);
  return slotCache;
}

function addDays(iso: string, days: number): string {
  const d = new Date(Date.parse(iso) + days * 86_400_000 - 6 * 3_600_000);
  return `${d.toISOString().slice(0, 19)}${TZ}`;
}

function label(order: Order): string {
  if (order.kind === "lab") return "Labs";
  if (order.kind === "imaging") return "CT";
  if (order.station_id === "vitals") return "Vitals";
  if (order.kind === "infusion") return "Infusion";
  return "clinic visit";
}

/** Orders that can be scheduled now: not done, and not waiting on a denied authorization. */
function schedulable(journey: Journey): Order[] {
  const denied = new Set(
    journey.auth_packets.filter((p) => p.status === "denied").flatMap((p) => p.order_ids),
  );
  return journey.orders.filter(
    (o) => !denied.has(o.id) && (o.status === "ordered" || o.status === "scheduled"),
  );
}

/**
 * The engine request (spec 7.3). Blood draws at the same station share one appointment, so
 * the labs are one engine order; the group's id is its first order's id.
 */
export function scheduleRequest(
  journey: Journey,
  now: string,
  taken: Map<string, number> = new Map(),
): {
  request: ScheduleRequest;
  groups: Map<string, string[]>;
} {
  const orders = schedulable(journey);
  const groupOf = new Map<string, string>();
  const groups = new Map<string, string[]>();
  for (const o of orders) {
    const lead =
      o.kind === "lab" ? orders.find((x) => x.kind === "lab" && x.station_id === o.station_id) : o;
    const id = (lead ?? o).id;
    groupOf.set(o.id, id);
    groups.set(id, [...(groups.get(id) ?? []), o.id]);
  }
  const stations = [...new Set(orders.map((o) => o.station_id))] as StationId[];
  const authed = new Set(
    journey.auth_packets.filter((p) => p.status === "approved").flatMap((p) => p.order_ids),
  );
  const engineOrders = [...groups.entries()].map(([id, members]) => {
    const all = members.map((m) => orders.find((o) => o.id === m) as Order);
    const lead = all[0] as Order;
    return {
      order_id: id,
      station_id: lead.station_id,
      duration_min: Math.max(...all.map((o) => o.duration_min)),
      label: label(lead),
      // Authorized services are scheduled from the decision on (after_auth).
      ...(all.some((o) => authed.has(o.id)) ? { not_before: now } : {}),
    };
  });
  const seen = new Set<string>();
  const dependencies: NonNullable<ScheduleRequest["dependencies"]> = [];
  for (const o of orders) {
    for (const d of o.depends_on) {
      if (d.kind === "after_auth") continue;
      const order = groupOf.get(o.id);
      const after = groupOf.get(d.order_id);
      if (!order || !after || order === after) continue;
      const key = `${order}|${after}|${d.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dependencies.push({
        order,
        after,
        kind: d.kind,
        ...(d.min_gap_minutes === undefined ? {} : { min_gap_min: d.min_gap_minutes }),
      });
    }
  }
  const today = now.slice(0, 10);
  const last = addDays(now, HORIZON_DAYS).slice(0, 10);
  const calendars = stations.map((station_id) => ({
    station_id,
    slots: slots()
      .filter((s) => s.station_id === station_id && s.date >= today && s.date <= last)
      .map((s) => {
        const start = `${s.date}T${s.time}:00${TZ}`;
        return {
          start,
          capacity: s.capacity - s.booked - (taken.get(`${station_id}@${start}`) ?? 0),
        };
      })
      .filter((s) => s.capacity > 0),
  }));
  const windows =
    PATIENT_AVAILABILITY[journey.patient.id] ?? REFERRAL_AVAILABILITY[journey.patient.id] ?? [];
  const availability = windows.map((w) => ({
    start: `${w.date}T${w.from}:00${TZ}`,
    end: `${w.date}T${w.to}:00${TZ}`,
  }));
  const timeOfDay = journey.memory.preferred_time_of_day;
  return {
    groups,
    request: {
      orders: engineOrders,
      dependencies,
      calendars,
      ...(availability.length > 0 ? { availability } : {}),
      ...(timeOfDay === "morning" || timeOfDay === "afternoon"
        ? { preferences: { time_of_day: timeOfDay } }
        : {}),
      earliest: now,
      latest: addDays(now, HORIZON_DAYS),
    },
  };
}

function appointmentsOf(
  plan: SchedulePlan,
  groups: Map<string, string[]>,
  status: Appointment["status"],
): Appointment[] {
  return plan.appointments.flatMap((a) =>
    (groups.get(a.order_id) ?? [a.order_id]).map((order_id) => ({
      id: `appt-${order_id}`,
      order_id,
      station_id: a.station_id,
      start: a.start,
      end: a.end,
      status,
    })),
  );
}

function plan(ctx: HandlerContext, deps: SchedulerDeps): HandlerResult {
  const journey = ctx.journey as Journey;
  const taken = takenSlots(deps.journeys?.() ?? [], journey.id);
  const { request, groups } = scheduleRequest(journey, ctx.now, taken);
  if (request.orders.length === 0) return { summary: "nothing to schedule", next_events: [] };
  let result: ReturnType<Engine["schedule"]>;
  try {
    result = deps.engine.schedule(request);
  } catch (e) {
    // No slot fits the dependencies and the patient's times: a coordinator books by hand.
    return {
      summary: `no schedule found: ${e instanceof Error ? e.message : String(e)}`,
      tasks: [
        `Book ${journey.patient.display_name} by hand: no open slot fits the orders and their times`,
      ],
      next_events: [],
    };
  }
  // A reschedule request takes the engine's alternative, which avoids the first plan's days.
  const rescheduling = ctx.event.type === "ReplyHandled";
  const chosen = rescheduling ? (result.alternative ?? result.primary) : result.primary;
  const other = rescheduling ? undefined : result.alternative;
  return {
    summary: `proposed ${chosen.visit_days.join(" / ")}`,
    next_events: [
      {
        type: "AppointmentsProposed",
        payload: {
          appointments: appointmentsOf(chosen, groups, "proposed"),
          visit_days: chosen.visit_days,
          ...(other ? { alternative: appointmentsOf(other, groups, "proposed") } : {}),
          explanation: chosen.facts.map((f) => (f.endsWith(".") ? f : `${f}.`)).join(" "),
        },
      },
    ],
  };
}

function book(ctx: HandlerContext): HandlerResult {
  const event = ctx.event as Extract<DomainEvent, { type: "AppointmentsProposed" }>;
  const booked = event.payload.appointments.map((a) => ({ ...a, status: "booked" as const }));
  const ids = new Set(booked.map((a) => a.order_id));
  return {
    summary: `booked ${booked.length}`,
    journey_patch: (j) => ({
      ...j,
      appointments: [...j.appointments.filter((a) => !ids.has(a.order_id)), ...booked],
      visit_days: event.payload.visit_days,
      orders: j.orders.map((o) => (ids.has(o.id) ? { ...o, status: "scheduled" } : o)),
    }),
    next_events: [{ type: "AppointmentsBooked", payload: { appointments: booked } }],
  };
}

/** A transparent no-show score from logistics only, never clinical data (spec B6). */
function noshow(ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const drivers: string[] = [];
  let score = 0.08;
  if (journey.memory.companion_present === "false") {
    score += 0.07;
    drivers.push("coming without a companion");
  }
  if (journey.memory.transport_need && journey.memory.transport_need !== "none") {
    score += 0.1;
    drivers.push("needs a ride");
  }
  if (journey.visit_days.length > 1) {
    score += 0.05;
    drivers.push("more than one visit day");
  }
  return {
    summary: `no-show risk ${score.toFixed(2)}`,
    next_events: [
      { type: "NoShowRiskScored", payload: { score: Number(score.toFixed(2)), drivers } },
    ],
  };
}

/** Scheduler (spec B4): the engine plans days and slots; booking follows the proposal. */
export function createSchedulerAgent(deps: SchedulerDeps): DeterministicAgent {
  return {
    ...schedulerDescriptor,
    kind: "deterministic",
    handle: (ctx) => {
      if (!ctx.journey) return { summary: "no journey", next_events: [] };
      if (ctx.capability === "schedule.plan") return plan(ctx, deps);
      if (ctx.capability === "schedule.book") return book(ctx);
      if (ctx.capability === "noshow.score") return noshow(ctx);
      return { summary: `not handled: ${ctx.capability}`, next_events: [] };
    },
  };
}
