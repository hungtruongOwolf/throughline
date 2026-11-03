import type { SimPatient, SimRequest } from "./engine";
import type { Incident } from "./ops";

/** Rooms or chairs at a station, from the hospital's campus data. */
export type ServersOf = (stationId: string) => number;

/** A surge brings about three people per open room or chair over its first half hour. */
const SURGE_PER_SERVER = 3;
const SURGE_MIN = 6;
const SURGE_MAX = 20;
const SURGE_SPREAD_MIN = 30;

/** The day's scripted disruptions as incidents: a named room is down, or the station is short. */
export function scriptedIncidents(day: SimRequest): Incident[] {
  return (day.disruptions ?? []).map((d) => ({
    kind: d.node_id ? "room_down" : "short_staffed",
    station_id: d.station_id,
    ...(d.node_id ? { node_id: d.node_id } : {}),
    from: d.from,
    to: d.to,
  }));
}

/** Incidents at `station` that are under way at `at`. */
export function activeAt(incidents: Incident[], station: string, at: string): Incident[] {
  const t = Date.parse(at);
  return incidents.filter(
    (i) => i.station_id === station && Date.parse(i.from) <= t && t < Date.parse(i.to),
  );
}

/** `iso` plus `minutes`, written in the same UTC offset. */
export function addMinutes(iso: string, minutes: number): string {
  // Keep the sim clock's offset: move the wall time, not the instant's UTC rendering.
  const offset = iso.slice(19);
  const local = new Date(Date.parse(iso.slice(0, 19) + "Z") + minutes * 60_000);
  return local.toISOString().slice(0, 19) + offset;
}

/** The walk-ins a surge adds, arriving evenly over its first half hour. */
export function surgePatients(
  incident: Incident,
  index: number,
  serversOf: ServersOf,
): SimPatient[] {
  const servers = serversOf(incident.station_id);
  const count = Math.min(SURGE_MAX, Math.max(SURGE_MIN, servers * SURGE_PER_SERVER));
  const window = Math.min(
    SURGE_SPREAD_MIN,
    (Date.parse(incident.to) - Date.parse(incident.from)) / 60_000,
  );
  return Array.from({ length: count }, (_, i) => ({
    id: `walkin-${index}-${i + 1}`,
    arrive: addMinutes(incident.from, (window * i) / count),
    mobility: "walking" as const,
    stops: [{ station_id: incident.station_id }],
  }));
}

/**
 * The day the engine replays once staff have reported incidents: a room down or a missing
 * staff member takes one server away for the window; a surge adds walk-ins. With nothing
 * reported this is the scripted day itself, so recorded runs replay unchanged.
 */
export function withIncidents(
  day: SimRequest,
  reported: Incident[],
  serversOf: ServersOf,
): SimRequest {
  if (reported.length === 0) return day;
  return {
    ...day,
    patients: [
      ...day.patients,
      ...reported.flatMap((i, n) => (i.kind === "surge" ? surgePatients(i, n, serversOf) : [])),
    ],
    disruptions: [
      ...(day.disruptions ?? []),
      ...reported
        .filter((i) => i.kind !== "surge")
        .map((i) => ({
          station_id: i.station_id,
          from: i.from,
          to: i.to,
          servers_down: 1,
          ...(i.node_id ? { node_id: i.node_id } : {}),
        })),
    ],
  };
}
