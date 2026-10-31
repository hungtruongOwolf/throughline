import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { WalkingRoute } from "@throughline/shared";
import { EngineCallError } from "./core";
import { loadEngine } from "./node";

const engine = loadEngine();

describe("rust-wasm engine in Node", () => {
  it("version() matches Cargo.toml", () => {
    const cargo = readFileSync(new URL("../Cargo.toml", import.meta.url), "utf8");
    expect(cargo).toContain(`version = "${engine.version()}"`);
  });

  it("reads the same campus as packages/hospital", () => {
    const campus = JSON.parse(
      readFileSync(new URL("../../hospital/campus.json", import.meta.url), "utf8"),
    ) as { version: string };
    expect(engine.campusVersion()).toBe(campus.version);
  });

  it("routes Main Entrance to CT 2 (golden)", () => {
    const r = engine.walkingRoute({ from: "mp1.entrance", to: "mp2.ct2", mobility: "walking" });
    expect(WalkingRoute.parse(r)).toEqual(r);
    expect(r.seconds).toBe(155);
    expect(r.nodes).toEqual([
      "mp1.entrance",
      "mp1.lobby",
      "mp1.corr_a",
      "mp2.corr_b",
      "mp2.imaging_wait",
      "mp2.ct2",
    ]);
  });

  it("wheelchair route takes Elevator A (golden)", () => {
    const r = engine.walkingRoute({ from: "mp1.entrance", to: "mp2.ct2", mobility: "wheelchair" });
    expect(r.seconds).toBe(229);
    expect(r.steps.map((s) => s.kind)).toContain("elevator");
    expect(r.steps.map((s) => s.kind)).not.toContain("stairs");
  });

  it("is deterministic", () => {
    const req = { from: "g2.parking", to: "cc3.infusion", mobility: "wheelchair" } as const;
    expect(JSON.stringify(engine.walkingRoute(req))).toBe(JSON.stringify(engine.walkingRoute(req)));
  });

  it("turns engine errors into EngineCallError", () => {
    expect(() =>
      engine.walkingRoute({ from: "mp1.entrance", to: "zz9.nowhere", mobility: "walking" }),
    ).toThrow(EngineCallError);
  });
});
