import { loadEngine } from "@throughline/engine/node";
import { ItineraryRequest, t, type Journey, type Message } from "@throughline/shared";
import { MARIA, ORGS } from "@throughline/synthetic";
import mariaRequest from "../../../../packages/engine/fixtures/maria-request.json";
import type { Runtime } from "../core/runtime";
import { createJourney } from "../core/journeys";

export const MARIA_JOURNEY_ID = "maria-001";

/**
 * Demo state for the visit-day surfaces until the agents run the whole scenario: Maria on
 * Nov 17 after her CT, waiting at the lab. The itinerary comes from the real engine plan;
 * everything else is the synthetic scenario of spec 10.3.
 */
export function seedMariaVisitDay(runtime: Runtime, now: string): Journey {
  const request = ItineraryRequest.parse(mariaRequest);
  const plan = loadEngine().planItinerary(request);
  const at = (hhmm: string) => `2026-11-17T${hhmm}:00-06:00`;
  const msg = (
    id: string,
    direction: Message["direction"],
    text: string,
    time: string,
  ): Message => ({
    id,
    direction,
    channel: direction === "in" ? "voice_sim" : "sms_sim",
    language: "es",
    text,
    disclaimer: id === "m1",
    at: time,
  });

  const base = createJourney({
    id: MARIA_JOURNEY_ID,
    patient: { ...MARIA, mobility: "wheelchair" },
    referring_provider: ORGS.referring_clinic,
    service_requested: "Medical oncology, new patient",
    now: "2026-11-10T08:12:00-06:00",
  });
  const journey: Journey = {
    ...base,
    phase: "VISIT",
    state: "ACTIVE",
    orders: request.stops.map((s) => ({
      id: s.order_id,
      kind:
        s.station_id === "lab_draw"
          ? "lab"
          : s.station_id === "imaging_ct"
            ? "imaging"
            : s.station_id === "infusion"
              ? "infusion"
              : "visit",
      code_as_written: s.order_id,
      station_id: s.station_id,
      duration_min: s.duration_min,
      depends_on: [],
      auth_required: s.station_id === "imaging_ct",
      status: s.order_id === "o-ct" ? "in_progress" : "scheduled",
    })),
    visit_days: ["2026-11-14", "2026-11-17"],
    itinerary: {
      planned_at: request.now,
      reason: plan.reason,
      stops: plan.stops.map((s, i) => ({
        order_id: s.order_id,
        station_id: s.station_id,
        node_id: s.node_id,
        status: i === 0 ? "done" : i === 1 ? "waiting" : "pending",
        eta_start: s.eta_start,
        eta_end: s.eta_end,
        people_ahead: s.people_ahead,
        est_wait_min: s.est_wait_min,
      })),
    },
    last_location: { node_id: plan.stops[0]?.node_id ?? "mp1.lobby", at: now, source: "checkin" },
    outreach_log: [
      msg("m1", "out", t("es", "disclosure.first_contact"), at("09:12")),
      msg(
        "m2",
        "in",
        "Sí, confirmo. Pero mi esposo no puede venir, voy a necesitar una silla de ruedas.",
        "2026-11-13T17:05:00-06:00",
      ),
    ],
    memory: {
      preferred_language: "es",
      mobility: "wheelchair",
      companion_present: "false",
    },
    kpis: { planned_minutes_on_site: plan.total_minutes, replans: 0, direction_requests: 0 },
  };
  return runtime.saveJourney(journey);
}
