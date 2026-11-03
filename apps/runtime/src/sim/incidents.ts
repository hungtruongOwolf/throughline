import { campus } from "@throughline/hospital";
import {
  withIncidents as withIncidentsOn,
  type Incident,
  type SimRequest,
} from "@throughline/shared";

export { activeAt, addMinutes, scriptedIncidents } from "@throughline/shared";

const serversOf = (id: string) => campus.stations.find((s) => s.id === id)?.servers ?? 1;

/** The day the engine replays once staff have reported incidents, on this campus. */
export function withIncidents(day: SimRequest, reported: Incident[]): SimRequest {
  return withIncidentsOn(day, reported, serversOf);
}
