import { describe, expect, it } from "vitest";
import { campus } from "@throughline/hospital";
import type { DomainEvent, IncidentKind, OpsAction, StationId } from "@throughline/shared";
import { createApp } from "../../app";
import { createContext } from "../../context";

const KINDS: IncidentKind[] = ["room_down", "short_staffed", "surge"];

async function report(station: StationId, kind: IncidentKind, node?: string) {
  const ctx = createContext({ OPS_AUTOPILOT: "off" }, { databasePath: ":memory:" });
  const app = createApp(ctx);
  ctx.clock.reset("2026-11-17T10:30:00-06:00");
  const res = await app.request(`/api/stations/${station}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      kind,
      ...(node ? { node_id: node } : {}),
      minutes: 90,
      by: "charge.nurse",
    }),
  });
  const reviews = ctx.store.reviews("pending").filter((r) => r.station_id === station);
  const proposals = reviews.flatMap((r) => {
    const parked = r.pending_event as
      Extract<DomainEvent, { type: "OpsActionProposed" }> | undefined;
    return r.kind === "approval" && parked ? [{ review: r, action: parked.payload.action }] : [];
  });
  const escalations = reviews.filter((r) => r.kind === "task");
  const body = (await res.json()) as { result?: string };
  return { ctx, app, res, body, proposals, escalations };
}

function names(station: StationId): string[] {
  const st = campus.stations.find((s) => s.id === station);
  return [
    st?.name ?? station,
    ...(st?.nodes ?? []).map((n) => campus.nodes.find((x) => x.id === n)?.label ?? n),
  ];
}

describe("ops planner on every station, not one scripted outage", () => {
  for (const st of campus.stations) {
    for (const kind of KINDS) {
      it(`${st.id}, ${kind}: a proposal that shortens the wait, a manager asked, or nothing needed`, async () => {
        const { res, body, proposals, escalations } = await report(
          st.id,
          kind,
          kind === "room_down" ? st.nodes[0] : undefined,
        );
        expect(res.status).toBe(200);
        // The reporter is told what happened, matching what the manager sees.
        expect(body.result).toBe(
          proposals.length > 0 ? "proposed" : escalations.length > 0 ? "escalated" : "no_change",
        );
        // At most one thing in front of a person per incident.
        expect(proposals.length + escalations.length).toBeLessThanOrEqual(1);
        for (const { action } of proposals) {
          const e = action.predicted_effect;
          expect(e.station_id).toBe(st.id);
          expect(e.wait_before_min - e.wait_after_min).toBeGreaterThanOrEqual(2);
          // The words come from this station's own data, never from another station's script.
          expect(names(st.id).some((n) => `${action.title} ${action.cause}`.includes(n))).toBe(
            true,
          );
          if (st.id !== "imaging_ct")
            expect(`${action.title} ${action.cause}`).not.toMatch(/\bCT\b/);
        }
        for (const task of escalations) {
          expect(task.reason).toContain("a manager needs to decide");
          expect(names(st.id).some((n) => task.reason.includes(n))).toBe(true);
        }
      }, 30_000);
    }
  }

  it("moves patients to the free room of the same station when one room is down", async () => {
    const { proposals } = await report("imaging_ct", "room_down", "mp2.ct2");
    const action = proposals[0]?.action as OpsAction;
    expect(action.params).toEqual({ from_node: "mp2.ct2", to_node: "mp2.ct1" });
    expect(action.title).toBe("Open an extra CT 1 slot and move CT 2 patients to CT 1");
    expect(action.cause).toBe("CT 2 is down since 10:30");
  });

  it("covers a station with a single room: X-ray down gets a proposal, then applies", async () => {
    const { ctx, proposals } = await report("imaging_xray", "room_down", "mp2.xray");
    const [first] = proposals;
    expect(first?.action.cause).toBe("X-ray is down since 10:30");
    await ctx.runtime.resolve(first?.review.id ?? "", "approved", "manager.ito");
    const applied = ctx.store
      .events({ stationId: "imaging_xray" })
      .map((s) => s.event)
      .find((e) => e.type === "OpsActionApplied");
    expect(applied).toBeDefined();
    // Sensing keeps working with the only room down (no division by zero open rooms).
    await expect(ctx.sensing.tick(ctx.clock.now())).resolves.toBeDefined();
  });

  it("asks a manager when nothing the planner can do helps (an infusion surge)", async () => {
    const { proposals, escalations } = await report("infusion", "surge");
    expect(proposals).toHaveLength(0);
    expect(escalations[0]?.reason).toMatch(
      /^More patients than usual have arrived at Infusion Center since 10:30\./,
    );
  });

  it("does nothing when the floor absorbs the incident (one of six registration desks short)", async () => {
    const { proposals, escalations } = await report("registration", "short_staffed");
    expect(proposals).toHaveLength(0);
    expect(escalations).toHaveLength(0);
  });

  it("rejects a room that belongs to another station, and reports outside opening hours", async () => {
    const { res } = await report("lab_draw", "room_down", "mp2.ct1");
    expect(res.status).toBe(400);
    const ctx = createContext({ OPS_AUTOPILOT: "off" }, { databasePath: ":memory:" });
    const app = createApp(ctx);
    ctx.clock.reset("2026-11-17T18:30:00-06:00");
    const late = await app.request("/api/stations/lab_draw/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "short_staffed", by: "charge.nurse" }),
    });
    expect(late.status).toBe(409);
  });
});
