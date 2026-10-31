import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createContext } from "../context";
import { SensingLoop } from "./sensing-loop";

async function outageAt(minute: string) {
  const ctx = createContext({}, { databasePath: ":memory:" });
  await createApp(ctx).request("/api/demo/visit-day?beat=lab", { method: "POST" });
  ctx.clock.reset(`2026-11-17T${minute}:00-06:00`);
  return ctx;
}

describe("sensing loop (spec V3)", () => {
  it("publishes a queue state per station from tickets when no model is available", async () => {
    const ctx = await outageAt("09:45");
    const states = await ctx.sensing.tick();
    const ct = states.find((s) => s.station_id === "imaging_ct");
    expect(ct?.source).toBe("tickets");
    expect(ct?.count_sensed).toBeUndefined();
    expect(states.map((s) => s.station_id)).toContain("lab_draw");
    expect(ctx.store.events({ stationId: "imaging_ct" }).map((e) => e.event.type)).toContain(
      "QueueStateUpdated",
    );
  });

  it("fuses a camera count with tickets and serves the nearest frame", async () => {
    const ctx = await outageAt("09:45");
    const seen: string[] = [];
    const loop = new SensingLoop({
      runtime: ctx.runtime,
      store: ctx.store,
      clock: ctx.clock,
      background: ctx.background,
      cameras: new (await import("./cameras")).CameraBank(),
      engine: (await import("@throughline/engine/node")).loadEngine(),
      count: (frame) => {
        seen.push(frame.camera_id);
        return Promise.resolve(frame.labeled_count);
      },
    });
    const states = await loop.tick();
    expect(seen).toContain("cam-imaging");
    const lab = states.find((s) => s.station_id === "lab_draw");
    expect(lab?.source).toBe("fused");
    expect(lab?.count_sensed).toBeTypeOf("number");
  });

  it("three samples over the threshold raise one bottleneck and one proposal", async () => {
    const ctx = createContext({}, { databasePath: ":memory:" });
    await createApp(ctx).request("/api/demo/visit-day?beat=ct_outage", { method: "POST" });
    const types = ctx.store.events({ stationId: "imaging_ct" }).map((e) => e.event.type);
    expect(types.filter((t) => t === "BottleneckDetected")).toHaveLength(1);
    expect(types.filter((t) => t === "OpsActionProposed")).toHaveLength(1);
    // A fourth sample over the threshold does not raise another one.
    await ctx.clock.advanceTo("2026-11-17T09:47:00-06:00");
    await ctx.sensing.tick();
    const after = ctx.store.events({ stationId: "imaging_ct" }).map((e) => e.event.type);
    expect(after.filter((t) => t === "BottleneckDetected")).toHaveLength(1);
  });
});
