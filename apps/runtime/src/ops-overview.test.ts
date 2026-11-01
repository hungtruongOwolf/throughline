import { describe, expect, it } from "vitest";
import { OpsOverview } from "@throughline/shared";
import { createApp } from "./app";
import { createContext } from "./context";

describe("ops overview", () => {
  it("reports the CT outage, Maria, and the pending proposal", async () => {
    const ctx = createContext({ OPS_AUTOPILOT: "off" }, { databasePath: ":memory:" });
    const app = createApp(ctx);
    await app.request("/api/demo/visit-day?beat=ct_outage", { method: "POST" });
    const o = OpsOverview.parse(await (await app.request("/api/ops/overview")).json());
    expect(o.now).toBe("2026-11-17T09:46:00-06:00");
    const ct = o.stations.find((s) => s.id === "imaging_ct");
    expect(ct?.open_servers).toBe(1);
    expect(o.journeys[0]).toMatchObject({
      initials: "M. D.",
      current: "CT",
      mobility: "wheelchair",
    });
    expect(o.proposals).toHaveLength(1);
    expect(o.proposals[0]?.status).toBe("pending");
    expect(o.in_house).toBeGreaterThan(10);
  });
});
