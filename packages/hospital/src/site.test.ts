import { describe, expect, it } from "vitest";
import { campus, siteFloor, sites } from "./index";

describe("hospital sites", () => {
  const all = sites(campus);

  it.each(Object.entries(all))(
    "%s: every edge joins real points and every point is reachable",
    (_, site) => {
      const ids = new Set(site.nodes.map((n) => n.id));
      expect(ids.size).toBe(site.nodes.length);
      for (const e of site.edges) {
        expect(ids.has(e.a), e.a).toBe(true);
        expect(ids.has(e.b), e.b).toBe(true);
      }
      const adj = new Map<string, string[]>();
      for (const e of site.edges) {
        adj.set(e.a, [...(adj.get(e.a) ?? []), e.b]);
        adj.set(e.b, [...(adj.get(e.b) ?? []), e.a]);
      }
      const start = site.day[0] as string;
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length)
        for (const v of adj.get(queue.shift() as string) ?? [])
          if (!seen.has(v)) (seen.add(v), queue.push(v));
      for (const stop of site.day) expect(seen.has(stop), stop).toBe(true);
      for (const s of site.stations) expect(seen.has(s.node_id), s.node_id).toBe(true);
    },
  );

  it("the tall campuses have the towers they describe", () => {
    expect(Math.max(...(all.northgate?.buildings ?? []).map((b) => b.floors))).toBe(14);
    expect(all.northgate?.buildings).toHaveLength(5);
    expect(all["st-brennan"]?.buildings).toHaveLength(4);
  });

  it("the floor is quiet at night and busy mid-morning", () => {
    const site = all.northgate;
    if (!site) throw new Error("no site");
    const night = siteFloor(site, "2026-11-17T02:00:00-06:00");
    const morning = siteFloor(site, "2026-11-17T09:30:00-06:00");
    expect(night.every((s) => s.count === 0)).toBe(true);
    expect(morning.reduce((n, s) => n + s.count, 0)).toBeGreaterThan(50);
  });
});
