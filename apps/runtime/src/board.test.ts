import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import type { BoardView } from "@throughline/shared";
import { createContext } from "./context";

async function setup() {
  const ctx = createContext({}, { databasePath: ":memory:" });
  const app = createApp(ctx);
  await app.request("/api/demo/visit-day", { method: "POST" });
  const board = async (id: string) =>
    (await (await app.request(`/api/stations/${id}/board`)).json()) as BoardView;
  const act = (id: string, body: unknown) =>
    app.request(`/api/stations/${id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { ctx, board, act };
}

describe("station board", () => {
  it("shows Maria waiting at the lab beside simulated patients, with initials only", async () => {
    const { board } = await setup();
    const lab = await board("lab_draw");
    const maria = lab.arriving.find((r) => !r.simulated);
    expect(maria).toMatchObject({ initials: "M. D.", status: "waiting", from: "CT" });
    expect(lab.arriving.some((r) => r.simulated)).toBe(true);
    expect(JSON.stringify(lab)).not.toContain("Maria");
    expect(lab.series.length).toBeGreaterThan(20);
    expect(lab.source).toBe("sim");
  });

  it("Start and Done move Maria along her itinerary", async () => {
    const { ctx, board, act } = await setup();
    const row = (await board("lab_draw")).arriving.find((r) => !r.simulated);
    await act("lab_draw", {
      action: "start",
      journey_id: row?.journey_id,
      order_id: row?.order_id,
    });
    expect((await board("lab_draw")).arriving.find((r) => !r.simulated)?.status).toBe("in_service");
    await act("lab_draw", { action: "done", journey_id: row?.journey_id, order_id: row?.order_id });
    expect((await board("lab_draw")).arriving.some((r) => !r.simulated)).toBe(false);
    expect((await board("vitals")).arriving.find((r) => !r.simulated)).toMatchObject({
      status: "walking",
      from: "Lab draw",
    });
    expect(ctx.runtime.journey("maria-001")?.last_location?.node_id).toBe("mp1.lab_draw");
  });

  it("'Didn't arrive' raises a lost task, and 'Send help' opens a staff task", async () => {
    const { board, act } = await setup();
    const row = (await board("lab_draw")).arriving.find((r) => !r.simulated);
    await act("lab_draw", {
      action: "didnt_arrive",
      journey_id: row?.journey_id,
      order_id: row?.order_id,
    });
    const lost = (await board("lab_draw")).tasks.find((t) => t.kind === "lost");
    expect(lost?.initials).toBe("M. D.");
    await act("lab_draw", { action: "send_help", journey_id: row?.journey_id });
    const task = (await board("lab_draw")).tasks.find((t) => t.kind === "task");
    expect(task?.reason).toContain("volunteer");
    const res = await act("lab_draw", {
      action: "resolve_task",
      review_id: task?.review_id,
      by: "staff.lab",
    });
    expect(res.status).toBe(200);
    expect((await board("lab_draw")).tasks.some((t) => t.kind === "task")).toBe(false);
  });
});
