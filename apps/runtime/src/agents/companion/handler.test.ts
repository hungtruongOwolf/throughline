import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Journey } from "@throughline/shared";
import { createApp } from "../../app";
import { createContext } from "../../context";

async function beat(name: "lab" | "ct_outage") {
  const ctx = createContext({}, { databasePath: ":memory:" });
  const app = createApp(ctx);
  await app.request(`/api/demo/visit-day?beat=${name}`, { method: "POST" });
  return { ctx, app };
}

function photo(path: string): FormData {
  const form = new FormData();
  const bytes = readFileSync(new URL(`../../../../../${path}`, import.meta.url));
  form.append("photo", new Blob([bytes], { type: "image/webp" }), "photo.webp");
  return form;
}

describe("companion and visit-day agents (D2-4)", () => {
  it("locates Maria from a sign photo and sends wheelchair directions in Spanish", async () => {
    const { ctx, app } = await beat("lab");
    // packages/synthetic/signs/14.webp is the "Elevator A" sign on Level 1.
    const res = await app.request("/api/journeys/maria-001/locate", {
      method: "POST",
      body: photo("packages/synthetic/signs/14.webp"),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { node_id: string }).node_id).toBe("mp1.elevA");
    const types = ctx.store.events({ journeyId: "maria-001" }).map((e) => e.event.type);
    expect(types).toEqual(expect.arrayContaining(["PatientLocated", "DirectionsSent"]));
    const journey = ctx.runtime.journey("maria-001") as Journey;
    expect(journey.last_location).toMatchObject({ node_id: "mp1.elevA", source: "sign_photo" });
    expect(journey.kpis.direction_requests).toBe(1);
    expect(journey.outreach_log.at(-1)?.text).toMatch(/^Cómo llegar a Lab Draw/);
    // The reading came from the recorded Spark output and says so.
    expect(ctx.store.modelCalls().find((c) => c.capability === "patient.locate")?.replayed).toBe(
      true,
    );
  });

  it("answers an unreadable photo with 422 and changes nothing", async () => {
    const { ctx, app } = await beat("lab");
    const res = await app.request("/api/journeys/maria-001/locate", {
      method: "POST",
      body: photo("packages/synthetic/frames/cam-lab/05.webp"),
    });
    expect(res.status).toBe(422);
    expect(ctx.store.events({ journeyId: "maria-001" }).map((e) => e.event.type)).not.toContain(
      "PatientLocated",
    );
  });

  it("tells Maria about the replan; without a model the template is used and recorded", async () => {
    const { ctx, app } = await beat("ct_outage");
    const [review] = ctx.store.reviews("pending");
    await app.request(`/api/reviews/${review?.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved", by: "manager.ito" }),
    });
    const journey = ctx.runtime.journey("maria-001") as Journey;
    expect(journey.outreach_log.at(-1)?.text).toMatch(/^Su plan cambió: CT 2 ahora hacia las/);
    const fallback = ctx.store
      .modelCalls()
      .find((c) => c.capability === "patient.message" && c.used_fallback);
    expect(fallback).toBeDefined();
  });

  it("routes a clinical question to a nurse, answers nothing clinical, and blocks", async () => {
    const { ctx } = await beat("lab");
    await ctx.runtime.ingest({
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: { channel: "sms_sim", text: "¿Es normal sentirme mareada?", language: "es" },
    });
    const journey = ctx.runtime.journey("maria-001") as Journey;
    expect(journey.handoff_open).toBe(true);
    expect(journey.outreach_log.at(-1)?.text).toMatch(/^No puedo ayudar con preguntas médicas/);
    expect(ctx.store.reviews("pending")[0]).toMatchObject({ kind: "handoff" });
  });

  it("result-ready tells the patient the sample is done, with no model call and no value", async () => {
    const { ctx } = await beat("lab");
    await ctx.runtime.ingest({
      type: "ResultReady",
      journey_id: "maria-001",
      payload: { order_id: "o-cbc" },
    });
    const journey = ctx.runtime.journey("maria-001") as Journey;
    expect(journey.orders.find((o) => o.id === "o-cbc")?.status).toBe("resulted");
    // ResultReady also triggers a replan, so look for the message anywhere in the log.
    expect(journey.outreach_log.map((m) => m.text)).toContain(
      "El laboratorio terminó con su muestra. Su siguiente parada puede continuar.",
    );
    expect(ctx.store.modelCalls().filter((c) => c.capability === "result.watch")).toEqual([]);
  });

  it("puts the AI disclosure on first contact", async () => {
    const { ctx } = await beat("lab");
    const journey = ctx.runtime.journey("maria-001") as Journey;
    ctx.runtime.saveJourney({ ...journey, outreach_log: [] });
    await ctx.runtime.ingest({
      type: "ResultReady",
      journey_id: "maria-001",
      payload: { order_id: "o-cbc" },
    });
    const log = (ctx.runtime.journey("maria-001") as Journey).outreach_log;
    expect(log[0]).toMatchObject({ disclaimer: true });
    expect(log[0]?.text).toMatch(/asistente de IA/);
  });
});
