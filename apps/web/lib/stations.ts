import { campus, type Zone } from "@throughline/hospital";

export interface StationDisplay {
  name: string;
  zone: Zone;
  floor: number;
}

/** Name, zone, and floor for a stop, from the campus file the engine also reads. */
export function stationDisplay(stationId: string, nodeId?: string): StationDisplay {
  const station = campus.stations.find((s) => s.id === stationId);
  const node = campus.nodes.find((n) => n.id === (nodeId ?? station?.nodes[0]));
  return {
    name: node?.kind === "station" ? node.label : (station?.name ?? stationId),
    zone: node?.zone ?? "blue",
    floor: node?.floor ?? 1,
  };
}
