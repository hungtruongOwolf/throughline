import { describe, expect, it } from "vitest";
import type { HumanReview, Journey } from "@throughline/shared";
import { createApp } from "./app";
import { createContext } from "./context";
import { createJourney } from "./core/journeys";
import { mockAgents } from "./test/harness";

function setup() {
  const ctx = createContext(
    { SIM_START: "2026-11-10T08:12:00-06:00" },
    {
      agents: mockAgents(),
      databasePath: ":memory:",
    },
  );
  const journey = createJourney({
    id: "maria-001",
    patient: {
      id: "pt-001",
      display_name: "Maria Diaz",
      dob: "1955-03-08",
      language: "es",
      mobility: "walking",
      phone_sim: "+1 555 0101",
    },
    referring_provider: "Northgate Family Medicine",
    service_requested: "Medical oncology",
    now: ctx.clock.now(),
  });
  ctx.store.saveAggregate("journey", journey.id, 0, journey);
  return { ctx, app: createApp(ctx) };
}

describe("runtime HTTP API", () => {
  it("resolves a parked prior-auth review over HTTP and exposes the audit log", async () => {
    const { ctx, app } = setup();
    await ctx.runtime.ingest({
      type: "ReferralReceived",
      journey_id: "maria-001",
      payload: {
        documents: [{ id: "d1", kind: "referral_fax", uri: "x", mime: "application/pdf" }],
      },
    });
    const pending = (await (
      await app.request("/api/reviews?status=pending")
    ).json()) as HumanReview[];
    expect(pending).toHaveLength(1);

    const res = await app.request(`/api/reviews/${pending[0]?.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved", by: "coordinator.lee" }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as HumanReview).status).toBe("resolved");

    const journey = (await (await app.request("/api/journeys/maria-001")).json()) as Journey;
    expect(journey.state).toBe("AUTH_SUBMITTED");
    const log = (await (await app.request("/api/journeys/maria-001/events")).json()) as {
      event: { type: string };
    }[];
    expect(log.map((s) => s.event.type)).toContain("HumanReviewResolved");
  });

  it("rejects a resolve without a reviewer name", async () => {
    const { ctx, app } = setup();
    await ctx.runtime.ingest({
      type: "ReferralReceived",
      journey_id: "maria-001",
      payload: {
        documents: [{ id: "d1", kind: "referral_fax", uri: "x", mime: "application/pdf" }],
      },
    });
    const [review] = ctx.store.reviews("pending");
    const res = await app.request(`/api/reviews/${review?.id}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision: "approved" }),
    });
    expect(res.status).toBe(400);
  });

  it("drives the sim clock", async () => {
    const { app } = setup();
    const res = await app.request("/api/clock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "advance", minutes: 90 }),
    });
    expect(((await res.json()) as { now: string }).now).toBe("2026-11-10T09:42:00-06:00");
  });

  it("streams domain events over SSE", async () => {
    const { ctx, app } = setup();
    const res = await app.request("/events/stream");
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let text = decoder.decode((await reader.read()).value);
    expect(text).toContain("event: hello");
    void ctx.runtime.ingest({
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: { channel: "sms_sim", text: "Sí, confirmo", language: "es" },
    });
    const seen = () =>
      text
        .split("event: domain")
        .slice(1)
        .some((chunk) => chunk.includes("ReplyHandled")) && text.includes("event: run");
    while (!seen()) text += decoder.decode((await reader.read()).value);
    expect(text).toContain("event: domain");
    // Agent runs stream alongside the events, for the live activity views.
    expect(text).toContain("event: run");
    await reader.cancel();
  });
});
