import { campus } from "@throughline/hospital";
import type { DomainEvent, Journey } from "@throughline/shared";

/**
 * Detail updates that follow directly from an event, applied when it is appended (event
 * sourcing: the log is enough to rebuild them). Decisions stay in agents; this only records
 * what happened, e.g. a stop started at the station's scan.
 */
export function projectJourney(journey: Journey, event: DomainEvent): Journey {
  const itinerary = journey.itinerary;
  switch (event.type) {
    case "StopStarted":
    case "StopCompleted": {
      if (!itinerary) return journey;
      const { order_id } = event.payload;
      const started = event.type === "StopStarted";
      const stops = itinerary.stops.map((s) =>
        s.order_id === order_id ? ({ ...s, status: started ? "in_service" : "done" } as const) : s,
      );
      // After a stop completes, the next pending stop is the one the patient walks to.
      if (!started) {
        const next = stops.findIndex((s) => s.status === "pending");
        const nextStop = stops[next];
        if (nextStop) stops[next] = { ...nextStop, status: "in_transit" };
      }
      const stop = itinerary.stops.find((s) => s.order_id === order_id);
      return {
        ...journey,
        itinerary: { ...itinerary, stops },
        orders: journey.orders.map((o) =>
          o.id === order_id && started ? { ...o, status: "in_progress" } : o,
        ),
        lost: false,
        ...(stop
          ? {
              last_location: {
                node_id: stop.node_id,
                at: event.occurred_at,
                source: "checkin" as const,
              },
            }
          : {}),
      };
    }
    case "PatientLost":
      return { ...journey, lost: true };
    case "PatientLocated": {
      // A check-in at the current stop's room or waiting area means "waiting here" (spec V4).
      const station = itinerary?.stops.find((s) => s.status !== "done" && s.status !== "skipped");
      const atStop =
        station &&
        (event.payload.node_id === station.node_id ||
          campus.stations.find((s) => s.id === station.station_id)?.waiting_node ===
            event.payload.node_id);
      return {
        ...journey,
        lost: false,
        ...(itinerary && station && atStop
          ? {
              itinerary: {
                ...itinerary,
                stops: itinerary.stops.map((s) =>
                  s === station ? { ...s, status: "waiting" as const } : s,
                ),
              },
            }
          : {}),
        last_location: {
          node_id: event.payload.node_id,
          at: event.occurred_at,
          source: event.payload.confidence >= 1 ? "checkin" : "sign_photo",
        },
      };
    }
    case "ItineraryPlanned": {
      const stops = event.payload.itinerary.stops;
      const first = stops[0];
      const last = stops[stops.length - 1];
      const planned =
        first && last
          ? Math.round((Date.parse(last.eta_end) - Date.parse(event.occurred_at)) / 60_000)
          : undefined;
      return {
        ...journey,
        itinerary: event.payload.itinerary,
        kpis: {
          ...journey.kpis,
          ...(planned !== undefined && journey.kpis.planned_minutes_on_site === undefined
            ? { planned_minutes_on_site: planned }
            : {}),
        },
      };
    }
    case "ItineraryReplanned":
      return {
        ...journey,
        itinerary: event.payload.itinerary,
        kpis: { ...journey.kpis, replans: (journey.kpis.replans ?? 0) + 1 },
      };
    case "ResultReady":
      return {
        ...journey,
        orders: journey.orders.map((o) =>
          o.id === event.payload.order_id
            ? { ...o, status: "resulted", result_ready_at: event.occurred_at }
            : o,
        ),
      };
    case "ResultAcknowledged":
      return {
        ...journey,
        orders: journey.orders.map((o) =>
          o.id === event.payload.order_id
            ? { ...o, status: "acknowledged", acknowledged_by: event.payload.by }
            : o,
        ),
      };
    default:
      return journey;
  }
}
