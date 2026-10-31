import { loadEngine } from "@throughline/engine/node";
import {
  ItineraryRequest,
  t,
  type Appointment,
  type Journey,
  type Message,
  type Order,
  type Stop,
} from "@throughline/shared";
import { MARIA, ORGS } from "@throughline/synthetic";
import mariaRequest from "../../../../packages/engine/fixtures/maria-request.json";
import type { SimBackground } from "../board";
import type { SimClock } from "../bus/sim-clock";
import type { RuntimeStore } from "../bus/store";
import { createJourney } from "../core/journeys";
import type { Runtime } from "../core/runtime";

export const MARIA_JOURNEY_ID = "maria-001";

/**
 * Scripted beats of Maria's Nov 17 (spec 10.3) for the visit-day surfaces, until the agents
 * play the whole scenario from the referral. Each beat resets the runtime and the sim clock.
 * - `ct_outage` 09:46: CT 1 is down, Maria waits at imaging, sensing reports a bottleneck.
 * - `lab` 10:20: CT is done and Maria waits at the lab.
 */
export type DemoBeat = "ct_outage" | "lab";

const at = (hhmm: string) => `2026-11-17T${hhmm}:00-06:00`;

/** Orders with the dependencies the engine turns into constraints. */
function orders(request: ItineraryRequest): Order[] {
  const kind = (station: string): Order["kind"] =>
    station === "lab_draw"
      ? "lab"
      : station === "imaging_ct"
        ? "imaging"
        : station === "infusion"
          ? "infusion"
          : "visit";
  const deps: Record<string, Order["depends_on"]> = {
    "o-visit": [
      { order_id: "o-cbc", kind: "resulted_before", min_gap_minutes: 45 },
      { order_id: "o-vitals", kind: "same_day_after", min_gap_minutes: 0 },
    ],
    "o-infusion": [{ order_id: "o-visit", kind: "same_day_after", min_gap_minutes: 35 }],
  };
  return request.stops.map((s) => ({
    id: s.order_id,
    kind: kind(s.station_id),
    code_as_written: s.order_id,
    station_id: s.station_id,
    duration_min: s.duration_min,
    depends_on: deps[s.order_id] ?? [],
    auth_required: s.station_id === "imaging_ct",
    status: "scheduled",
  }));
}

function appointments(request: ItineraryRequest): Appointment[] {
  return request.stops
    .filter((s) => s.not_before)
    .map((s) => ({
      id: `appt-${s.order_id}`,
      order_id: s.order_id,
      station_id: s.station_id,
      start: s.not_before as string,
      end: new Date(Date.parse(s.not_before as string) + s.duration_min * 60_000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z"),
      status: "booked",
    }));
}

function message(id: string, direction: Message["direction"], text: string, time: string): Message {
  return {
    id,
    direction,
    channel: direction === "in" ? "voice_sim" : "sms_sim",
    language: "es",
    text,
    disclaimer: id === "m1",
    at: time,
  };
}

function mariaJourney(statuses: Stop["status"][], lastNode: string, now: string): Journey {
  const request = ItineraryRequest.parse(mariaRequest);
  const plan = loadEngine().planItinerary(request);
  const base = createJourney({
    id: MARIA_JOURNEY_ID,
    patient: { ...MARIA, mobility: "wheelchair" },
    referring_provider: ORGS.referring_clinic,
    service_requested: "Medical oncology, new patient",
    now: "2026-11-10T08:12:00-06:00",
  });
  return {
    ...base,
    phase: "VISIT",
    state: "ACTIVE",
    orders: orders(request),
    appointments: appointments(request),
    visit_days: ["2026-11-14", "2026-11-17"],
    itinerary: {
      planned_at: request.now,
      reason: plan.reason,
      stops: plan.stops.map((s, i) => ({
        order_id: s.order_id,
        station_id: s.station_id,
        node_id: s.node_id,
        status: statuses[i] ?? "pending",
        eta_start: s.eta_start,
        eta_end: s.eta_end,
        people_ahead: s.people_ahead,
        est_wait_min: s.est_wait_min,
      })),
    },
    last_location: { node_id: lastNode, at: now, source: "checkin" },
    outreach_log: [
      message("m1", "out", t("es", "disclosure.first_contact"), at("09:12")),
      message(
        "m2",
        "in",
        "Sí, confirmo. Pero mi esposo no puede venir, voy a necesitar una silla de ruedas.",
        "2026-11-13T17:05:00-06:00",
      ),
    ],
    memory: { preferred_language: "es", mobility: "wheelchair", companion_present: "false" },
    kpis: { planned_minutes_on_site: plan.total_minutes, replans: 0, direction_requests: 0 },
  };
}

export async function seedDemo(
  ctx: { runtime: Runtime; store: RuntimeStore; clock: SimClock; background: SimBackground },
  beat: DemoBeat,
): Promise<Journey> {
  const { runtime, store, clock, background } = ctx;
  store.reset();
  if (beat === "lab") {
    clock.reset(at("10:20"));
    return runtime.saveJourney(
      mariaJourney(["done", "waiting", "pending", "pending", "pending"], "mp2.ct1", clock.now()),
    );
  }

  clock.reset(at("09:46"));
  const journey = runtime.saveJourney(
    mariaJourney(
      ["waiting", "pending", "pending", "pending", "pending"],
      "mp2.imaging_wait",
      clock.now(),
    ),
  );
  // CT 1 has been down since 09:40; counts come from the simulated day (source "sim").
  const snapshot = [...background.get().snapshots]
    .reverse()
    .find((s) => s.station_id === "imaging_ct" && s.at <= clock.now());
  const count = (snapshot?.count ?? 0) + 1;
  runtime.saveStation({
    ...runtime.station("imaging_ct"),
    open_servers: 1,
    queue: {
      station_id: "imaging_ct",
      at: clock.now(),
      count_fused: count,
      est_wait_min: count * 25,
      source: "sim",
    },
  });
  // Sensing would raise this after three samples over threshold (spec V3, V8).
  await runtime.ingest({
    type: "BottleneckDetected",
    station_id: "imaging_ct",
    payload: { severity: "high", minutes: count * 25 },
  });
  return runtime.journey(journey.id) ?? journey;
}
