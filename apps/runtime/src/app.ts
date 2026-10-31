import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { SHARED_VERSION, type Journey } from "@throughline/shared";
import type { EventBus } from "./bus/event-bus";
import type { ClockSpeed, SimClock } from "./bus/sim-clock";
import type { RuntimeStore } from "./bus/store";
import type { Runtime } from "./core/runtime";

export interface AppContext {
  store: RuntimeStore;
  bus: EventBus;
  clock: SimClock;
  runtime: Runtime;
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
  const { store, bus, clock, runtime } = ctx;

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
  app.get("/api/proof", (c) => c.json({ calls: store.modelCalls() }));

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

  return app;
}
