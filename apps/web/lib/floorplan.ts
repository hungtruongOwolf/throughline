import type { Zone } from "@throughline/hospital";
import { campus, node } from "./campus";

/**
 * Floor-plan drawing for the wayfinding map, in campus coordinates (the same x/y as
 * campus.json; one unit is about 1.5 m). The graph says where people can walk; this file
 * adds what a visitor sees: buildings, departments, and the small places people look for
 * (restrooms, information, café). Display only: routing stays in the engine.
 */

export type Floor = 1 | 2 | 3;
export const FLOORS: Floor[] = [3, 2, 1];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Building extends Rect {
  id: string;
  label: string;
  /** Covered walkways and bridges are drawn lighter. */
  kind: "building" | "link" | "garage";
}

export interface Room extends Rect {
  label: string;
  zone?: Zone;
  kind: "department" | "service" | "lobby" | "amenity";
}

export interface Poi {
  x: number;
  y: number;
  kind: "restroom" | "info" | "elevator" | "entrance" | "parking" | "cafe" | "stairs";
  label: string;
}

export interface FloorPlan {
  floor: Floor;
  buildings: Building[];
  rooms: Room[];
  pois: Poi[];
}

const MP: Building = {
  id: "MP",
  label: "Main Pavilion",
  kind: "building",
  x: 0,
  y: 0,
  w: 125,
  h: 70,
};
const CC: Building = {
  id: "CC",
  label: "Cancer Center",
  kind: "building",
  x: 160,
  y: 0,
  w: 85,
  h: 62,
};

export const FLOOR_PLANS: Record<Floor, FloorPlan> = {
  1: {
    floor: 1,
    buildings: [
      MP,
      { id: "GL", label: "Garden Link (covered)", kind: "link", x: 125, y: 25, w: 35, h: 10 },
      CC,
    ],
    rooms: [
      { label: "Main Lobby", kind: "lobby", zone: "blue", x: 18, y: 20, w: 28, h: 20 },
      { label: "Registration", kind: "service", zone: "blue", x: 20, y: 44, w: 22, h: 14 },
      { label: "Café", kind: "amenity", x: 42, y: 3, w: 16, h: 12 },
      { label: "Gift shop", kind: "amenity", x: 20, y: 3, w: 16, h: 12 },
      { label: "Outpatient Lab", kind: "department", zone: "blue", x: 76, y: 42, w: 28, h: 20 },
      { label: "Pharmacy", kind: "department", zone: "blue", x: 92, y: 4, w: 20, h: 16 },
      { label: "Cancer Center Lobby", kind: "lobby", zone: "green", x: 172, y: 20, w: 24, h: 20 },
      { label: "Resource Center", kind: "amenity", x: 210, y: 24, w: 26, h: 16 },
    ],
    pois: [
      { x: 10, y: 30, kind: "entrance", label: "Main Entrance" },
      { x: 24, y: 35, kind: "info", label: "Information" },
      { x: 50, y: 44, kind: "restroom", label: "Restrooms" },
      { x: 60, y: 15, kind: "elevator", label: "Elevator A" },
      { x: 66, y: 36, kind: "stairs", label: "Stairs" },
      { x: 186, y: 50, kind: "restroom", label: "Restrooms" },
      { x: 200, y: 15, kind: "elevator", label: "Elevator B" },
    ],
  },
  2: {
    floor: 2,
    buildings: [
      MP,
      { id: "G", label: "Parking Garage", kind: "garage", x: 26, y: 72, w: 30, h: 40 },
      { id: "SB", label: "Skybridge", kind: "link", x: 36, y: 58, w: 8, h: 14 },
      { id: "LB", label: "Link Bridge", kind: "link", x: 125, y: 25, w: 35, h: 10 },
      CC,
    ],
    rooms: [
      { label: "Imaging", kind: "department", zone: "gold", x: 84, y: 38, w: 34, h: 28 },
      { label: "Financial Counseling", kind: "service", zone: "gold", x: 82, y: 4, w: 22, h: 16 },
      { label: "Vitals", kind: "service", zone: "rose", x: 208, y: 8, w: 18, h: 18 },
      { label: "Clinic 2A", kind: "department", zone: "rose", x: 208, y: 38, w: 34, h: 18 },
      { label: "Clinic 2B", kind: "department", zone: "rose", x: 163, y: 38, w: 30, h: 18 },
      { label: "Nurses", kind: "service", zone: "rose", x: 195, y: 40, w: 10, h: 10 },
    ],
    pois: [
      { x: 60, y: 15, kind: "elevator", label: "Elevator A" },
      { x: 66, y: 36, kind: "stairs", label: "Stairs" },
      { x: 50, y: 30, kind: "restroom", label: "Restrooms" },
      { x: 41, y: 100, kind: "parking", label: "Patient Parking" },
      { x: 200, y: 15, kind: "elevator", label: "Elevator B" },
      { x: 186, y: 18, kind: "restroom", label: "Restrooms" },
    ],
  },
  3: {
    floor: 3,
    buildings: [CC],
    rooms: [
      { label: "Infusion Center", kind: "department", zone: "violet", x: 208, y: 22, w: 34, h: 30 },
      { label: "Patient & Family Lounge", kind: "amenity", x: 168, y: 32, w: 26, h: 18 },
    ],
    pois: [
      { x: 200, y: 15, kind: "elevator", label: "Elevator B" },
      { x: 186, y: 10, kind: "restroom", label: "Restrooms" },
    ],
  },
};

const VERTICAL = new Set(["elevator", "stairs"]);

/** Hallways on a floor: the graph's walking edges whose two ends are on that floor. */
export function corridors(floor: Floor): [string, string][] {
  return campus.edges
    .filter((e) => !VERTICAL.has(e.kind))
    .filter((e) => node(e.a)?.floor === floor && node(e.b)?.floor === floor)
    .map((e) => [e.a, e.b]);
}

/** Hallways run straight: a leg goes across, then along, like a corridor turn. */
export function legPoints(a: string, b: string): [number, number][] {
  const na = node(a);
  const nb = node(b);
  if (!na || !nb) return [];
  if (na.x === nb.x || na.y === nb.y)
    return [
      [na.x, na.y],
      [nb.x, nb.y],
    ];
  return [
    [na.x, na.y],
    [nb.x, na.y],
    [nb.x, nb.y],
  ];
}

export function floorOf(id: string): Floor | undefined {
  const f = node(id)?.floor;
  return f === 1 || f === 2 || f === 3 ? f : undefined;
}

/** Where a person can be sent: departments, services, and the places visitors ask for. */
export const DESTINATIONS = campus.nodes
  .filter((n) => ["station", "waiting", "amenity", "lobby", "parking", "entrance"].includes(n.kind))
  .filter((n) => !["cc2.nurse"].includes(n.id))
  .map((n) => ({ id: n.id, label: n.label, floor: n.floor as Floor }))
  .sort((a, b) => a.label.localeCompare(b.label));
