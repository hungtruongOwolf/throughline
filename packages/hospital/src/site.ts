import type { Campus } from "./schema";

/**
 * A hospital site as the 3D view and the floor board read it: buildings, every point on every
 * floor, the walks between them, and the stations patients wait at. Any hospital has one. A
 * hand-drawn campus (siteFromCampus) and a layout of buildings, floors, and departments
 * (buildSite) both produce it, so no screen knows which hospital it is drawing.
 */

export type SiteKind =
  | "entrance"
  | "lobby"
  | "station"
  | "amenity"
  | "room"
  | "elevator"
  | "junction"
  | "parking"
  | "other";

export interface SiteNode {
  id: string;
  building: string;
  floor: number;
  /** Metres on the site plan. */
  x: number;
  y: number;
  kind: SiteKind;
  zone: string;
  label: string;
}

export interface SiteBuilding {
  id: string;
  name: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  lowest: number;
  floors: number;
  parking: boolean;
}

export interface SiteEdge {
  a: string;
  b: string;
  seconds: number;
}

export interface SiteStation {
  id: string;
  name: string;
  node_id: string;
  waiting_node: string | null;
  servers: number;
  service_min: number;
  /** People waiting at the busiest hour. */
  peak: number;
}

export interface Site {
  name: string;
  buildings: SiteBuilding[];
  nodes: SiteNode[];
  edges: SiteEdge[];
  stations: SiteStation[];
  /** A typical visit day: the node ids a patient walks through, in order. */
  day: string[];
}

/** One station on the floor right now. */
export interface FloorStation {
  id: string;
  name: string;
  node_id: string;
  waiting_node: string | null;
  servers: number;
  count: number;
  est_wait_min: number;
}

// ---- layouts ------------------------------------------------------------------------------

export interface LayoutDepartment {
  floor: number;
  label: string;
  zone: string;
  amenity?: boolean;
  station?: { id: string; servers: number; service_min: number; peak: number };
}

export interface LayoutBuilding {
  id: string;
  name: string;
  /** South-west corner and size, in metres. */
  x: number;
  y: number;
  w: number;
  d: number;
  floors: number;
  parking?: boolean;
  /** The public entrance on the ground floor, if the building has one. */
  entrance?: string;
  /** What fills floors with no listed department, such as "Patient rooms". */
  units?: string;
  departments: LayoutDepartment[];
}

export interface SiteLayout {
  name: string;
  buildings: LayoutBuilding[];
  /** Walkways and skybridges between buildings, on the floors listed. */
  bridges: { a: string; b: string; floors: number[] }[];
  /** A typical visit day as station ids, after the first entrance. */
  day: string[];
}

const WALK_MPS = 1.2;
const ELEVATOR_S = 25;
const walk = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.max(4, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / WALK_MPS));

/** Lays out every floor of every building: a corridor, an elevator core, rooms on both sides. */
export function buildSite(layout: SiteLayout): Site {
  const nodes: SiteNode[] = [];
  const edges: SiteEdge[] = [];
  const stations: SiteStation[] = [];
  const spine = new Map<string, SiteNode[]>(); // building-floor -> corridor points, west to east
  const add = (n: SiteNode) => (nodes.push(n), n);
  const link = (a: SiteNode, b: SiteNode, seconds = walk(a, b)) =>
    edges.push({ a: a.id, b: b.id, seconds });

  for (const b of layout.buildings) {
    const key = b.id.toLowerCase();
    const sy = b.y + b.d / 2;
    const cx = b.x + b.w / 2;
    let below: SiteNode | undefined;
    for (let f = 1; f <= b.floors; f++) {
      const p = `${key}${f}`;
      const point = (id: string, x: number, kind: SiteKind = "junction", label = "Corridor") =>
        add({ id: `${p}.${id}`, building: b.id, floor: f, x, y: sy, kind, zone: "blue", label });
      const west = point("west", b.x + 3);
      const east = point("east", b.x + b.w - 3);
      const core = point("core", cx);
      const lift = add({
        id: `${p}.elevator`,
        building: b.id,
        floor: f,
        x: cx,
        y: sy - b.d * 0.18,
        kind: "elevator",
        zone: "blue",
        label: `${b.name} elevators`,
      });
      link(core, lift, 6);
      if (below) link(below, lift, ELEVATOR_S);
      below = lift;

      const deps: LayoutDepartment[] = b.departments.filter((d) => d.floor === f);
      if (!deps.length)
        deps.push(
          b.parking
            ? { floor: f, label: `Level ${f}`, zone: "blue" }
            : { floor: f, label: `${b.units ?? "Offices"}, ${f} North`, zone: "blue" },
          ...(b.parking
            ? []
            : [{ floor: f, label: `${b.units ?? "Offices"}, ${f} South`, zone: "blue" }]),
        );
      const span = b.w - 12;
      const corridor: SiteNode[] = [west, core, east];
      deps.forEach((d, i) => {
        const x = b.x + 6 + ((i + 0.5) * span) / deps.length;
        const north = i % 2 === 0;
        const id = d.station?.id ?? d.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
        const room = add({
          id: `${p}.${id}`,
          building: b.id,
          floor: f,
          x,
          y: sy + (north ? -1 : 1) * b.d * 0.3,
          kind: b.parking ? "parking" : d.station ? "station" : d.amenity ? "amenity" : "room",
          zone: d.zone,
          label: d.label,
        });
        const door = point(`door${i}`, x);
        corridor.push(door);
        link(door, room);
        if (d.station)
          stations.push({
            id: d.station.id,
            name: d.label,
            node_id: room.id,
            waiting_node: null,
            servers: d.station.servers,
            service_min: d.station.service_min,
            peak: d.station.peak,
          });
      });
      corridor.sort((m, n) => m.x - n.x);
      for (let i = 1; i < corridor.length; i++)
        link(corridor[i - 1] as SiteNode, corridor[i] as SiteNode);
      spine.set(`${b.id}-${f}`, corridor);

      if (f === 1 && b.entrance) {
        const door = add({
          id: `${p}.entrance`,
          building: b.id,
          floor: 1,
          x: b.x - 2,
          y: sy,
          kind: "entrance",
          zone: "blue",
          label: b.entrance,
        });
        link(door, west);
      }
    }
  }

  // Skybridges join the two corridor points closest to each other.
  for (const br of layout.bridges)
    for (const f of br.floors) {
      const a = spine.get(`${br.a}-${f}`);
      const b = spine.get(`${br.b}-${f}`);
      if (!a || !b) continue;
      let best: [SiteNode, SiteNode] | undefined;
      for (const m of a)
        for (const n of b) if (!best || walk(m, n) < walk(best[0], best[1])) best = [m, n];
      if (best) link(best[0], best[1]);
    }

  const buildings = layout.buildings.map((b) => ({
    id: b.id,
    name: b.name,
    x0: b.x,
    y0: b.y,
    x1: b.x + b.w,
    y1: b.y + b.d,
    lowest: 1,
    floors: b.floors,
    parking: !!b.parking,
  }));
  const entrance = nodes.find((n) => n.kind === "entrance");
  const day = [
    ...(entrance ? [entrance.id] : []),
    ...layout.day.flatMap((s) => stations.find((x) => x.id === s)?.node_id ?? []),
  ];
  return { name: layout.name, buildings, nodes, edges, stations, day };
}

// ---- a hand-drawn campus --------------------------------------------------------------------

const KINDS: Record<string, SiteKind> = {
  entrance: "entrance",
  lobby: "lobby",
  station: "station",
  amenity: "amenity",
  elevator: "elevator",
  parking: "parking",
};

/** Reads a hand-drawn campus file as a site. Buildings take their outline from their rooms. */
export function siteFromCampus(campus: Campus, names: Record<string, string>, day: string[]): Site {
  const pad = 9;
  const byBuilding = new Map<string, Campus["nodes"]>();
  for (const n of campus.nodes)
    byBuilding.set(n.building, [...(byBuilding.get(n.building) ?? []), n]);
  const buildings = [...byBuilding.entries()].map(([id, ns]) => {
    const floors = ns.map((n) => n.floor);
    return {
      id,
      name: names[id] ?? "",
      x0: Math.min(...ns.map((n) => n.x)) - pad,
      y0: Math.min(...ns.map((n) => n.y)) - pad,
      x1: Math.max(...ns.map((n) => n.x)) + pad,
      y1: Math.max(...ns.map((n) => n.y)) + pad,
      lowest: Math.min(...floors),
      floors: Math.max(...floors),
      parking: ns.every(
        (n) => n.kind === "parking" || n.kind === "elevator" || n.kind === "walkway",
      ),
    };
  });
  const stations = campus.stations.map((s) => ({
    id: s.id,
    name: s.name,
    node_id: s.nodes[0] as string,
    waiting_node: s.waiting_node,
    servers: s.servers,
    service_min: s.service_min.mean,
    peak: Math.max(...(campus.queue_baselines[s.id] ?? [1])),
  }));
  return {
    name: campus.name,
    buildings,
    nodes: campus.nodes.map((n) => ({ ...n, kind: KINDS[n.kind] ?? "other" })),
    edges: campus.edges.map(({ a, b, seconds }) => ({ a, b, seconds })),
    stations,
    day: day.map((d) => (d.includes(".") ? d : (stations.find((s) => s.id === d)?.node_id ?? d))),
  };
}

// ---- the floor right now ------------------------------------------------------------------

/** How busy an outpatient floor is at each hour, as a share of its busiest hour. */
const DAY_SHAPE = [
  0, 0, 0, 0, 0, 0, 0.1, 0.45, 0.85, 1, 0.95, 0.85, 0.65, 0.75, 0.75, 0.6, 0.35, 0.1, 0, 0, 0, 0, 0,
  0,
];

function wobble(seed: string, bucket: number): number {
  let h = 2166136261;
  for (const c of `${seed}:${bucket}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/** Who is waiting where at `now` (local clock time of the hospital), from each station's day. */
export function siteFloor(site: Site, now: string): FloorStation[] {
  const t = new Date(now);
  // The wall-clock time as written in the timestamp, which carries the hospital's offset.
  const [hh, mm] = (now.split("T")[1] ?? "00:00").split(":").map(Number);
  const hour = (hh ?? 0) + (mm ?? 0) / 60;
  const h0 = Math.floor(hour);
  const share =
    (DAY_SHAPE[h0] ?? 0) + ((DAY_SHAPE[(h0 + 1) % 24] ?? 0) - (DAY_SHAPE[h0] ?? 0)) * (hour - h0);
  const bucket = Math.floor(t.getTime() / (10 * 60_000));
  return site.stations.map((s) => {
    const count = Math.round(s.peak * share * (0.8 + 0.4 * wobble(s.id, bucket)));
    return {
      id: s.id,
      name: s.name,
      node_id: s.node_id,
      waiting_node: s.waiting_node,
      servers: s.servers,
      count,
      est_wait_min: Math.round((count * s.service_min) / s.servers),
    };
  });
}
