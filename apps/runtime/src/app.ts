import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { SHARED_VERSION, StationId, type Journey } from "@throughline/shared";
import type { EventBus } from "./bus/event-bus";
import type { ClockSpeed, SimClock } from "./bus/sim-clock";
import type { RuntimeStore } from "./bus/store";
import type { Runtime } from "./core/runtime";
import { seedDemo } from "./demo/visit-day";
import { buildBoard, type SimBackground } from "./board";
import { buildOverview } from "./ops-overview";
import { locateFromPhoto } from "./locate";
import type { ModelCache } from "./models/cache";
import type { ModelConfig } from "./models/config";
import type { SensingLoop } from "./sim/sensing-loop";

export interface AppContext {
  store: RuntimeStore;
  bus: EventBus;
  clock: SimClock;
  runtime: Runtime;
  background: SimBackground;
  sensing: SensingLoop;
  models: { config: ModelConfig; cache: ModelCache };
}

const Resolve = z.object({
  decision: z.enum(["approved", "rejected"]),
  by: z.string().min(1),
  note: z.string().optional(),
});

const ClockCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    speed: z.union([z.literal(1), z.literal(10), z.literal(60), z.literal(600)]),
  }),
  z.object({ action: z.literal("stop") }),
  z.object({ action: z.literal("advance"), minutes: z.number().positive() }),
  z.object({ action: z.literal("jump") }),
]);

/**
 * HTTP API. Routes persist and publish events, then return; they never run workflows
 * (spec 4.3 step 1).
 */
export function createApp(ctx?: AppContext) {
  const app = new Hono();
  app.use("*", cors());
  app.get("/health", (c) => c.json({ ok: true, shared: SHARED_VERSION, synthetic: true }));
  if (!ctx) return app;
  const { store, bus, clock, runtime, background } = ctx;

  app.get("/api/journeys", (c) => c.json(store.listAggregates<Journey>("journey")));

  app.get("/api/journeys/:id", (c) => {
    const journey = runtime.journey(c.req.param("id"));
    return journey ? c.json(journey) : c.json({ error: "not found" }, 404);
  });

  /** Audit replay (spec 4.6): the full event log for one journey. */
  app.get("/api/journeys/:id/events", (c) =>
    c.json(store.events({ journeyId: c.req.param("id") })),
  );

  app.get("/api/reviews", (c) => {
    const status = c.req.query("status");
    const parsed = z.enum(["pending", "resolved", "rejected"]).safeParse(status);
    return c.json(store.reviews(parsed.success ? parsed.data : undefined));
  });

  /** A person approves or rejects; the runtime replays or discards the parked event. */
  app.post("/api/reviews/:id/resolve", async (c) => {
    const review = store.review(c.req.param("id"));
    if (!review) return c.json({ error: "not found" }, 404);
    const body = Resolve.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const { decision, by } = body.data;
    if (review.kind === "handoff" && review.journey_id) {
      await runtime.ingest({
        type: "HandoffResolved",
        journey_id: review.journey_id,
        payload: { review_id: review.id, by },
      });
    } else if (review.station_id && !review.journey_id) {
      const parked = review.pending_event as { payload?: { action?: { id?: string } } };
      const actionId = parked.payload?.action?.id ?? "";
      await runtime.ingest(
        decision === "approved"
          ? {
              type: "OpsActionApproved",
              station_id: review.station_id,
              payload: { action_id: actionId, by },
            }
          : {
              type: "OpsActionRejected",
              station_id: review.station_id,
              payload: {
                action_id: actionId,
                by,
                ...(body.data.note ? { note: body.data.note } : {}),
              },
            },
      );
    } else if (review.journey_id) {
      await runtime.ingest({
        type: "HumanReviewResolved",
        journey_id: review.journey_id,
        payload: {
          review_id: review.id,
          decision,
          by,
          ...(body.data.note ? { note: body.data.note } : {}),
        },
      });
    }
    return c.json(store.review(review.id));
  });

  /** Proof panel data (spec 8.6): every model call, never message content. */
  app.get("/api/proof", (c) => {
    const { config, cache } = ctx.models;
    return c.json({
      calls: store.modelCalls(),
      config: {
        meta_api: Boolean(config.metaApiKey),
        tier_mode: config.tierMode,
        // Until a private endpoint is configured, private payloads are served by the cloud tier.
        private_tier: config.glimmer ? "configured" : "not configured (cloud_only in effect)",
        cache_mode: cache.mode,
        cached_responses: cache.size(),
      },
    });
  });

  app.get("/api/clock", (c) =>
    c.json({
      now: clock.now(),
      speed: clock.speed,
      running: clock.running,
      timers: clock.pending(),
    }),
  );

  app.post("/api/clock", async (c) => {
    const body = ClockCommand.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const cmd = body.data;
    if (cmd.action === "start") clock.start(cmd.speed as ClockSpeed);
    if (cmd.action === "stop") clock.stop();
    if (cmd.action === "advance") await clock.advanceBy(cmd.minutes);
    if (cmd.action === "jump") await clock.jumpToNext();
    await bus.idle();
    return c.json({ now: clock.now(), speed: clock.speed, running: clock.running });
  });

  /** One-way live updates to the web app (spec 4.1: SSE, reconnects for free). */
  app.get("/events/stream", (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = bus.subscribe("*", async ({ event }) => {
        await stream.writeSSE({ event: "domain", id: event.id, data: JSON.stringify(event) });
      });
      stream.onAbort(unsubscribe);
      await stream.writeSSE({ event: "hello", data: JSON.stringify({ now: clock.now() }) });
      while (!stream.aborted) {
        await stream.sleep(15_000);
        await stream.writeSSE({ event: "ping", data: JSON.stringify({ now: clock.now() }) });
      }
    }),
  );

  /** What the patient phone can do (spec 9.3). Each action becomes an event or a review. */
  app.post("/api/journeys/:id/actions", async (c) => {
    const id = c.req.param("id");
    if (!runtime.journey(id)) return c.json({ error: "not found" }, 404);
    const body = PatientAction.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    if (body.data.action === "talk_to_person") {
      const review = await runtime.openHandoff(id, "patient_asked");
      return c.json({ review });
    }
    const event = await runtime.ingest({
      type: "StopStarted",
      journey_id: id,
      payload: { order_id: body.data.order_id },
    });
    return event ? c.json({ event }) : c.json({ error: "not allowed now" }, 409);
  });

  /** Sign photo from the phone (spec V5). The photo is read and dropped, never stored. */
  app.post("/api/journeys/:id/locate", async (c) => {
    const id = c.req.param("id");
    if (!runtime.journey(id)) return c.json({ error: "not found" }, 404);
    const form = await c.req.formData().catch(() => undefined);
    const file = form?.get("photo");
    if (!file || typeof file === "string") return c.json({ error: "photo required" }, 400);
    const located = await locateFromPhoto(ctx, id, {
      bytes: Buffer.from(await file.arrayBuffer()),
      mime: file.type || "image/webp",
    });
    return located ? c.json(located) : c.json({ error: "sign not readable" }, 422);
  });

  /** Station board (spec 9.3): who is coming, who is waiting, tasks. */
  app.get("/api/stations/:id/board", (c) => {
    const id = StationId.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "unknown station" }, 404);
    return c.json(buildBoard(id.data, clock.now(), store, background));
  });

  /** Staff actions from the board. Each one becomes an event or resolves a task. */
  app.post("/api/stations/:id/actions", async (c) => {
    const id = StationId.safeParse(c.req.param("id"));
    if (!id.success) return c.json({ error: "unknown station" }, 404);
    const body = StaffAction.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const a = body.data;
    if (a.action === "start" || a.action === "done") {
      const event = await runtime.ingest({
        type: a.action === "start" ? "StopStarted" : "StopCompleted",
        journey_id: a.journey_id,
        station_id: id.data,
        payload: { order_id: a.order_id },
      });
      return event ? c.json({ event }) : c.json({ error: "not allowed now" }, 409);
    }
    if (a.action === "didnt_arrive") {
      const journey = runtime.journey(a.journey_id);
      const stop = journey?.itinerary?.stops.find((s) => s.order_id === a.order_id);
      if (!stop) return c.json({ error: "not found" }, 404);
      const overdue = Math.max(
        0,
        Math.round((Date.parse(clock.now()) - Date.parse(stop.eta_start)) / 60_000),
      );
      const event = await runtime.ingest({
        type: "PatientLost",
        journey_id: a.journey_id,
        payload: { expected_node_id: stop.node_id, minutes_overdue: overdue },
      });
      return c.json({ event });
    }
    if (a.action === "send_help") {
      return c.json({
        review: runtime.openTask(a.journey_id, "A volunteer is on the way to help"),
      });
    }
    const review = store.review(a.review_id);
    if (!review) return c.json({ error: "not found" }, 404);
    if (review.kind === "handoff" && review.journey_id) {
      await runtime.ingest({
        type: "HandoffResolved",
        journey_id: review.journey_id,
        payload: { review_id: review.id, by: a.by },
      });
    } else {
      store.saveReview({
        ...review,
        status: "resolved",
        resolved_by: a.by,
        resolved_at: clock.now(),
      });
    }
    return c.json(store.review(review.id));
  });

  /** Command center data (spec 9.3): station waits, journeys in house, proposals. */
  app.get("/api/ops/overview", (c) => c.json(buildOverview(store, runtime, clock, background)));

  /** Demo beats of Maria's Nov 17 (until the agents play the whole scenario). Resets state. */
  app.post("/api/demo/visit-day", async (c) => {
    const beat = c.req.query("beat") === "ct_outage" ? "ct_outage" : "lab";
    const journey = await seedDemo(ctx, beat);
    await bus.idle();
    return c.json(journey);
  });

  return app;
}

const StaffAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), journey_id: z.string(), order_id: z.string() }),
  z.object({ action: z.literal("done"), journey_id: z.string(), order_id: z.string() }),
  z.object({ action: z.literal("didnt_arrive"), journey_id: z.string(), order_id: z.string() }),
  z.object({ action: z.literal("send_help"), journey_id: z.string() }),
  z.object({ action: z.literal("resolve_task"), review_id: z.string(), by: z.string().min(1) }),
]);

const PatientAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("im_here"), order_id: z.string().min(1) }),
  z.object({ action: z.literal("talk_to_person") }),
]);
