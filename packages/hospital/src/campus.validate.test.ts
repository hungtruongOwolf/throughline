import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGraph, reachable, shortestRoute } from "./graph";
import { campus } from "./index";
import { SIGN_MATCH_THRESHOLD, signSimilarity, signText } from "./localizer";
import { ZONE_COLORS } from "./zones";

const nodeIds = new Set(campus.nodes.map((n) => n.id));

describe("campus.json (test 21)", () => {
  it("has the 37 nodes from SPEC 3.2 with unique ids", () => {
    expect(campus.nodes).toHaveLength(37);
    expect(nodeIds.size).toBe(37);
  });

  it("every edge references existing nodes", () => {
    for (const e of campus.edges) {
      expect(nodeIds.has(e.a), e.a).toBe(true);
      expect(nodeIds.has(e.b), e.b).toBe(true);
    }
  });

  it("elevator edges are 90 s and stairs are 45 s per floor", () => {
    for (const e of campus.edges.filter((x) => x.kind === "elevator")) expect(e.seconds).toBe(90);
    for (const e of campus.edges.filter((x) => x.kind === "stairs")) expect(e.seconds).toBe(45);
  });

  it.each(["walking", "wheelchair"] as const)("the graph is connected for %s", (mobility) => {
    const graph = buildGraph(campus, mobility);
    expect(reachable(graph, "mp1.entrance").size).toBe(campus.nodes.length);
  });

  it("every station has existing nodes, hours, and service parameters", () => {
    expect(campus.stations).toHaveLength(10);
    for (const s of campus.stations) {
      for (const n of s.nodes) expect(nodeIds.has(n), `${s.id} ${n}`).toBe(true);
      if (s.waiting_node) expect(nodeIds.has(s.waiting_node)).toBe(true);
      expect(s.hours.open < s.hours.close, s.id).toBe(true);
      expect(s.service_min.mean).toBeGreaterThan(0);
      expect(campus.queue_baselines[s.id], s.id).toHaveLength(24);
    }
  });

  it("waiting areas are the six camera nodes", () => {
    expect(campus.waiting_areas.map((w) => w.node_id).sort()).toEqual([
      "cc2.wait_2a",
      "cc2.wait_2b",
      "cc3.infusion_wait",
      "mp1.lab_wait",
      "mp1.lobby",
      "mp2.imaging_wait",
    ]);
  });

  it("every node has at least one sign and every arrow targets a node", () => {
    const signed = new Set(campus.signs.map((s) => s.node_id));
    for (const id of nodeIds) expect(signed.has(id), id).toBe(true);
    for (const s of campus.signs)
      for (const a of s.arrows) expect(nodeIds.has(a.target_node_id)).toBe(true);
  });

  it("no two signs on different nodes are within the localizer threshold", () => {
    const clashes: string[] = [];
    for (const a of campus.signs) {
      for (const b of campus.signs) {
        if (a.sign_id >= b.sign_id || a.node_id === b.node_id) continue;
        const sim = signSimilarity(signText(a), signText(b));
        if (sim >= SIGN_MATCH_THRESHOLD)
          clashes.push(`${signText(a)} ~ ${signText(b)} (${sim.toFixed(2)})`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("zone colors mirror apps/web/app/theme.css", () => {
    const css = readFileSync(new URL("../../../apps/web/app/theme.css", import.meta.url), "utf8");
    for (const [zone, hex] of Object.entries(ZONE_COLORS)) {
      expect(css.toLowerCase()).toContain(`--color-zone-${zone}: ${hex}`);
    }
  });
});

describe("walking routes", () => {
  const walking = buildGraph(campus, "walking");
  const wheelchair = buildGraph(campus, "wheelchair");

  it("Main Entrance to CT 2 takes the stairs when walking", () => {
    const r = shortestRoute(walking, "mp1.entrance", "mp2.ct2");
    // entrance-lobby 25 + lobby-corr_a 30 + stairs 45 + corr_b-imaging_wait 38 + imaging_wait-ct2 17
    expect(r?.seconds).toBe(155);
    expect(r?.steps.some((s) => s.kind === "stairs")).toBe(true);
  });

  it("wheelchair routes never use stairs", () => {
    const r = shortestRoute(wheelchair, "mp1.entrance", "mp2.ct2");
    // ... corr_a-elevA 12 + elevator 90 + elevA-corr_b 17 instead of stairs 45
    expect(r?.seconds).toBe(229);
    expect(r?.steps.some((s) => s.kind === "stairs")).toBe(false);
    for (const a of campus.nodes) {
      for (const b of ["mp2.ct2", "cc3.infusion", "cc2.pod_2a"]) {
        const route = shortestRoute(wheelchair, a.id, b);
        expect(route?.steps.every((s) => s.kind !== "stairs")).toBe(true);
      }
    }
  });

  it("returns undefined for unknown nodes", () => {
    expect(shortestRoute(walking, "mp1.entrance", "nowhere.x")).toBeUndefined();
  });
});
