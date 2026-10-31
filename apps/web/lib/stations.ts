import type { Zone } from "@throughline/hospital";
import { campus, node } from "./campus";

export interface StationDisplay {
  name: string;
  zone: Zone;
  floor: number;
}

/** Name, zone, and floor for a stop, from the campus file the engine also reads. */
export function stationDisplay(stationId: string, nodeId?: string): StationDisplay {
  const station = campus.stations.find((s) => s.id === stationId);
  const n = node(nodeId ?? station?.nodes[0] ?? "");
  return {
    name: n?.kind === "station" ? n.label : (station?.name ?? stationId),
    zone: n?.zone ?? "blue",
    floor: n?.floor ?? 1,
  };
}
