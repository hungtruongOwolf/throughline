// Regenerates the walking goldens from the independent TypeScript graph in packages/hospital,
// so the Rust engine is checked against a second implementation. Wait goldens are hand-computed.
import { writeFileSync } from "node:fs";
import { buildGraph, campus, shortestRoute, walkingMatrix } from "@throughline/hospital";

type Mobility = "walking" | "wheelchair";
const routeCases: [string, string, Mobility][] = [
  ["mp1.entrance", "mp2.ct2", "walking"],
  ["mp1.entrance", "mp2.ct2", "wheelchair"],
  ["g2.parking", "cc3.infusion", "wheelchair"],
  ["g2.parking", "cc3.infusion", "walking"],
  ["mp1.lab_draw", "cc2.pod_2a", "walking"],
  ["mp1.lab_draw", "cc2.pod_2a", "wheelchair"],
  ["mp1.cafe", "mp1.elevA", "walking"],
  ["cc2.vitals", "cc2.vitals", "walking"],
];

const cases: unknown[] = routeCases.map(([from, to, mobility]) => {
  const route = shortestRoute(buildGraph(campus, mobility), from, to);
  if (!route) throw new Error(`no route ${from} ${to}`);
  return {
    name: `${from} to ${to} (${mobility})`,
    fn: "walkingRoute",
    request: { from, to, mobility },
    expected: route,
  };
});
cases.push({
  name: "unknown node",
  fn: "walkingRoute",
  request: { from: "mp1.entrance", to: "zz9.nowhere", mobility: "walking" },
  expected: { error: { code: "unknown_node", message: "unknown node zz9.nowhere" } },
});

const waiting = campus.waiting_areas.map((w) => w.node_id);
const matrix = walkingMatrix(buildGraph(campus, "wheelchair"), waiting);
cases.push({
  name: "waiting-area matrix (wheelchair)",
  fn: "walkingMatrix",
  request: { node_ids: waiting, mobility: "wheelchair" },
  expected: {
    node_ids: waiting,
    seconds: waiting.map((a) => waiting.map((b) => matrix.get(a)?.get(b))),
  },
});

const out = new URL("../fixtures/routes.json", import.meta.url);
writeFileSync(
  out,
  JSON.stringify({ source: "packages/hospital graph.ts (independent oracle)", cases }, null, 2) +
    "\n",
);
console.log(`wrote ${cases.length} route cases`);
