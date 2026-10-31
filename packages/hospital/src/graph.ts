import type { Mobility } from "@throughline/shared";
import type { Campus, CampusEdge, CampusNode } from "./schema";

export interface RouteStep {
  kind: "walk" | "elevator" | "stairs";
  to_node_id: string;
  to_label: string;
  seconds: number;
  /** Destination floor for elevator and stairs steps. */
  floor?: number;
}

export interface Route {
  nodes: string[];
  seconds: number;
  steps: RouteStep[];
}

export interface Graph {
  nodes: Map<string, CampusNode>;
  adjacency: Map<string, { to: string; edge: CampusEdge }[]>;
}

/** Builds the undirected walking graph; wheelchair routes drop stairs edges (spec 3.2). */
export function buildGraph(campus: Campus, mobility: Mobility = "walking"): Graph {
  const nodes = new Map(campus.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, { to: string; edge: CampusEdge }[]>();
  for (const n of campus.nodes) adjacency.set(n.id, []);
  for (const edge of campus.edges) {
    if (mobility === "wheelchair" && edge.kind === "stairs") continue;
    adjacency.get(edge.a)?.push({ to: edge.b, edge });
    adjacency.get(edge.b)?.push({ to: edge.a, edge });
  }
  return { nodes, adjacency };
}

/** Dijkstra over walking seconds. Returns undefined when `to` is unreachable. */
export function shortestRoute(graph: Graph, from: string, to: string): Route | undefined {
  if (!graph.nodes.has(from) || !graph.nodes.has(to)) return undefined;
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; edge: CampusEdge }>();
  const done = new Set<string>();
  // 37 nodes: a linear scan for the minimum is simpler than a heap and fast enough.
  while (done.size < graph.nodes.size) {
    let current: string | undefined;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < best) {
        best = d;
        current = id;
      }
    }
    if (current === undefined || current === to) break;
    done.add(current);
    for (const { to: next, edge } of graph.adjacency.get(current) ?? []) {
      const nd = best + edge.seconds;
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        prev.set(next, { node: current, edge });
      }
    }
  }
  const total = dist.get(to);
  if (total === undefined) return undefined;

  const path: string[] = [to];
  const edges: CampusEdge[] = [];
  for (let at = to; at !== from;) {
    const p = prev.get(at);
    if (!p) return undefined;
    path.unshift(p.node);
    edges.unshift(p.edge);
    at = p.node;
  }
  const steps = edges.map((edge, i): RouteStep => {
    const target = graph.nodes.get(path[i + 1] as string) as CampusNode;
    return {
      kind: edge.kind,
      to_node_id: target.id,
      to_label: target.label,
      seconds: edge.seconds,
      ...(edge.kind === "walk" ? {} : { floor: target.floor }),
    };
  });
  return { nodes: path, seconds: total, steps };
}

/** All-pairs walking seconds between the given nodes (spec 7.3: precomputed on load). */
export function walkingMatrix(
  graph: Graph,
  ids: readonly string[],
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();
  for (const a of ids) {
    const row = new Map<string, number>();
    for (const b of ids)
      row.set(b, a === b ? 0 : (shortestRoute(graph, a, b)?.seconds ?? Infinity));
    matrix.set(a, row);
  }
  return matrix;
}

/** Nodes reachable from `start`; used to check connectivity per mobility mode. */
export function reachable(graph: Graph, start: string): Set<string> {
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const at = queue.shift() as string;
    for (const { to } of graph.adjacency.get(at) ?? []) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}
