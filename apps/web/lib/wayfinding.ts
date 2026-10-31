import type { WalkingRoute } from "@throughline/shared";
import { campus, node } from "./campus";
import { floorOf, type Floor } from "./floorplan";

export interface WayStep {
  kind: "walk" | "elevator" | "stairs" | "arrive";
  /** The floor the step starts on; the map shows this floor while the step is current. */
  floor: Floor;
  from: string;
  to: string;
  nodes: string[];
  seconds: number;
  text: string;
}

const EDGE_SECONDS = new Map<string, { seconds: number; kind: string }>();
for (const e of campus.edges) {
  EDGE_SECONDS.set(`${e.a}|${e.b}`, e);
  EDGE_SECONDS.set(`${e.b}|${e.a}`, e);
}

function label(id: string): string {
  return node(id)?.label ?? id;
}

/** How a place reads in a sentence, landmark first ("the Main Lobby", "the Link Bridge"). */
function via(id: string): string | undefined {
  const n = node(id);
  if (!n) return undefined;
  switch (n.kind) {
    case "lobby":
    case "amenity":
    case "station":
      return `the ${n.label}`;
    case "junction":
      return `the ${n.label} hallway`;
    case "bridge":
    case "walkway":
      return `the ${n.label}`;
    case "door":
      return `the ${n.label} doors`;
    default:
      return undefined;
  }
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function walkText(nodes: string[], last: boolean): string {
  const to = label(nodes[nodes.length - 1] as string);
  const passing = [
    ...new Set(
      nodes
        .slice(1, -1)
        .map(via)
        .filter((v): v is string => !!v),
    ),
  ];
  const path = passing.length > 0 ? `, through ${list(passing)}` : "";
  return last ? `Go to ${to}${path}.` : `Walk to ${to}${path}.`;
}

/**
 * Steps a person can follow, from the engine's node path: walking legs split where the
 * route changes floor, each told by the places it passes (landmarks first), then arrival.
 */
export function wayfindingSteps(route: WalkingRoute): WayStep[] {
  const steps: WayStep[] = [];
  const nodes = route.nodes;
  let leg: string[] = [nodes[0] as string];
  let legSeconds = 0;
  const flushWalk = (last: boolean) => {
    if (leg.length < 2) return;
    steps.push({
      kind: "walk",
      floor: floorOf(leg[0] as string) ?? 1,
      from: leg[0] as string,
      to: leg[leg.length - 1] as string,
      nodes: leg,
      seconds: legSeconds,
      text: walkText(leg, last),
    });
  };
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1] as string;
    const b = nodes[i] as string;
    const edge = EDGE_SECONDS.get(`${a}|${b}`);
    const vertical = edge?.kind === "elevator" || edge?.kind === "stairs";
    if (!vertical) {
      leg.push(b);
      legSeconds += edge?.seconds ?? 0;
      continue;
    }
    flushWalk(false);
    const prev = steps[steps.length - 1];
    const fromFloor = floorOf(a) ?? 1;
    const toFloor = floorOf(b) ?? 1;
    // Consecutive elevator rides (1 → 2 → 3) are one ride.
    if (prev && prev.kind === edge.kind && prev.to === a) {
      prev.to = b;
      prev.nodes.push(b);
      prev.seconds += edge.seconds;
    } else {
      steps.push({
        kind: edge.kind as "elevator" | "stairs",
        floor: fromFloor,
        from: a,
        to: b,
        nodes: [a, b],
        seconds: edge.seconds,
        text: "",
      });
    }
    const ride = steps[steps.length - 1] as WayStep;
    const up = (floorOf(ride.to) ?? toFloor) > fromFloor ? "up" : "down";
    ride.text =
      ride.kind === "elevator"
        ? `Take ${label(ride.from)} ${up} to Level ${floorOf(ride.to)}.`
        : `Take the stairs ${up} to Level ${floorOf(ride.to)}.`;
    leg = [b];
    legSeconds = 0;
  }
  flushWalk(true);
  const end = nodes[nodes.length - 1] as string;
  const endNode = node(end);
  steps.push({
    kind: "arrive",
    floor: floorOf(end) ?? 1,
    from: end,
    to: end,
    nodes: [end],
    seconds: 0,
    text:
      endNode?.kind === "waiting" || endNode?.kind === "station"
        ? `You have arrived at ${label(end)}. Check in at the desk.`
        : `You have arrived at ${label(end)}.`,
  });
  return steps;
}

export function minutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}
