import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { SHARED_VERSION, StationId, type Journey } from "@throughline/shared";
import type { EventBus } from "./bus/event-bus";
import type { ClockSpeed, SimClock } from "./bus/sim-clock";
import type { RuntimeStore } from "./bus/store";
import type { Runtime } from "./core/runtime";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { seedDemo } from "./demo/visit-day";
import { seedReferral } from "./demo/referral";
import { STORY_STEPS, StoryDriver, type StoryStep } from "./demo/story";
import { buildBoard, type SimBackground } from "./board";
import { buildOverview } from "./ops-overview";
import { locateFromPhoto } from "./locate";
import { transcribe } from "./models/voice";
import type { World } from "./sim/pre-visit";
import { agentRuns, agentStats, inbox, journeyRows, overview, runView, timeline } from "./platform";
import { faxLine, populate, receiveReferral } from "./demo/population";
import { loadEngine } from "@throughline/engine/node";
import { VisitDayScenario } from "./sim/scenario";
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
  models: { config: ModelConfig; cache: ModelCache; brain: { current: "cloud" | "open" } };
  world: World;
  /** Fax-line referrals received since the last restore. */
  received: Set<string>;
  /** Last visitor change (POST) and whether the hospital differs from the restored one. */
  activity: { dirty: boolean; at: number };
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
/** Rebuilds the hospital as of Nov 17, 9:53 am and lets the clock run in real time. */
export async function restoreHospital(ctx: AppContext): Promise<void> {
  await populate(ctx);
  ctx.activity.dirty = false;
  if (process.env.CLOCK_SPEED !== "0") ctx.clock.start(1);
}

export function createApp(ctx?: AppContext) {
  const app = new Hono();
  app.use("*", cors());
  // Development routes reset or drive the hospital; when ADMIN_TOKEN is set they need it.
  const adminOnly = async (c: Context, next: () => Promise<void>) => {
    const token = process.env.ADMIN_TOKEN;
    if (token && c.req.header("x-admin-token") !== token)
      return c.json({ error: "not found" }, 404);
    await next();
  };
  app.use("/api/demo/*", adminOnly);
  app.use("/api/story", adminOnly);
  app.use("/api/story/*", adminOnly);
  app.use("/api/admin/*", adminOnly);
  app.on("POST", "/api/clock", adminOnly);

  app.get("/health", (c) => c.json({ ok: true, shared: SHARED_VERSION, synthetic: true }));
  if (!ctx) return app;
  const { store, bus, clock, runtime, background } = ctx;
  // Visitors change the hospital; an idle runtime restores it (index.ts).
  app.use("/api/*", async (c, next) => {
    if (c.req.method === "POST" && !c.req.path.startsWith("/api/admin")) {
      ctx.activity.dirty = true;
      ctx.activity.at = Date.now();
    }
    await next();
  });
  /** Rebuilds the Nov 17 hospital (demo/population.ts). */
  app.post("/api/admin/restore", async (c) => {
    await restoreHospital(ctx);
    return c.json({ now: clock.now() });
  });

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

  // ---- the staff platform (docs/PLATFORM-DESIGN.md) ----------------------------------------
  /** The faxes waiting on the fax line (receiving one starts a journey). */
  app.get("/api/fax-line", (c) =>
    c.json(
      faxLine(ctx).map((s) => ({
        id: s.id,
        patient: s.patient.display_name,
        practice: s.practice.name,
        provider: s.practice.provider,
        arrived_at: s.receivedAt,
        pages: 1,
        fax: `/api/documents/${s.id}-referral-fax.png`,
      })),
    ),
  );
  /** Receives a fax from the fax line: a new journey opens and the agents start on it. */
  app.post("/api/referrals", async (c) => {
    const body = z.object({ fax: z.string() }).safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const spec = faxLine(ctx).find((s) => s.id === body.data.fax);
    if (!spec) return c.json({ error: "that fax was already received" }, 409);
    ctx.received.add(spec.id);
    const id = `ref-v${ctx.received.size}`;
    await receiveReferral(ctx, spec, id);
    await bus.idle();
    return c.json(runtime.journey(id));
  });

  const Role = z.enum(["coordinator", "nurse", "clinician", "ops"]).optional();
  app.get("/api/overview", (c) =>
    c.json(overview(store, buildOverview(store, runtime, clock, background).in_house)),
  );
  app.get("/api/inbox", (c) => {
    const role = Role.safeParse(c.req.query("role") || undefined);
    const status = c.req.query("status") === "done" ? "done" : "pending";
    return c.json(
      inbox(store, { ...(role.success && role.data ? { role: role.data } : {}), status }),
    );
  });
  app.get("/api/referrals", (c) => c.json(journeyRows(store)));
  app.get("/api/agents", (c) => c.json(agentStats(store)));
  app.get("/api/agents/:name/runs", (c) => c.json(agentRuns(store, c.req.param("name"))));
  app.get("/api/journeys/:id/timeline", (c) => c.json(timeline(store, c.req.param("id"))));
  app.get("/api/runs/:id", (c) => {
    const run = store.run(c.req.param("id"));
    return run ? c.json(runView(store, run)) : c.json({ error: "not found" }, 404);
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
      const unwatch = bus.onTelemetry((t) => {
        void stream.writeSSE({ event: "run", data: JSON.stringify(t.run) });
      });
      stream.onAbort(() => {
        unsubscribe();
        unwatch();
      });
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

  /** Recent events across journeys and stations for the cascade (queue updates left out). */
  app.get("/api/events", (c) => {
    const limit = Math.min(500, Number(c.req.query("limit") ?? 200));
    const all = store.events().filter((e) => e.event.type !== "QueueStateUpdated");
    return c.json(all.slice(-limit));
  });

  /** The whole visit day (spec 10.3) on the sim clock; autopilot plays the people at the gates. */
  let scenario: VisitDayScenario | undefined;
  app.post("/api/demo/scenario", async (c) => {
    const body = ScenarioCommand.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    scenario?.stop();
    scenario = new VisitDayScenario(
      { ...ctx, engine: loadEngine() },
      { autopilot: body.data.autopilot },
    );
    await scenario.start();
    if (body.data.speed) clock.start(body.data.speed);
    return c.json({ now: clock.now(), running: clock.running, autopilot: body.data.autopilot });
  });

  app.get("/api/demo/scenario", (c) =>
    c.json({ started: scenario !== undefined, done: scenario?.done ?? false, now: clock.now() }),
  );

  /** Maria's whole journey as one story, step by step (demo/story.ts). */
  const story = new StoryDriver(ctx);
  app.get("/api/story", (c) => c.json(story.state()));
  app.post("/api/story/goto", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { step?: string };
    const step = (STORY_STEPS as readonly string[]).includes(body.step ?? "")
      ? (body.step as StoryStep)
      : "fax";
    await story.goto(step);
    return c.json(story.state());
  });
  app.post("/api/story/act", async (c) => {
    await story.act();
    return c.json(story.state());
  });

  /** PRE (spec 10.3): Maria's referral fax arrives and the pre-visit agents take it from there. */
  app.post("/api/demo/referral", async (c) => {
    const journey = await seedReferral(ctx);
    await bus.idle();
    return c.json(runtime.journey(journey.id) ?? journey);
  });

  /** A coordinator answers an intake question (spec B1), e.g. the member id from the card. */
  app.post("/api/journeys/:id/clarify", async (c) => {
    const id = c.req.param("id");
    if (!runtime.journey(id)) return c.json({ error: "not found" }, 404);
    const body = Clarify.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    await runtime.ingest({ type: "ClarificationAnswered", journey_id: id, payload: body.data });
    await bus.idle();
    return c.json(runtime.journey(id));
  });

  /** A patient's text reply on the simulated phone (spec B6). */
  app.post("/api/journeys/:id/reply", async (c) => {
    const id = c.req.param("id");
    const journey = runtime.journey(id);
    if (!journey) return c.json({ error: "not found" }, 404);
    const body = Reply.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    await runtime.ingest({
      type: "PatientReplied",
      journey_id: id,
      payload: {
        channel: body.data.channel,
        text: body.data.text,
        language: journey.patient.language,
      },
    });
    await bus.idle();
    return c.json(runtime.journey(id));
  });

  /** A voice note from the patient (spec B7): Voice Transcribe, then the same path as a text. */
  app.post("/api/journeys/:id/voice", async (c) => {
    const id = c.req.param("id");
    const journey = runtime.journey(id);
    if (!journey) return c.json({ error: "not found" }, 404);
    const form = await c.req.formData().catch(() => undefined);
    const file = form?.get("audio");
    if (!file || typeof file === "string") return c.json({ error: "audio required" }, 400);
    if (file.size > 10 * 1024 * 1024) return c.json({ error: "voice note too long" }, 413);
    let transcript: string;
    try {
      ({ transcript } = await transcribe(
        {
          ...ctx.models,
          record: (r) => ctx.store.recordModelCall(r),
          now: () => ctx.clock.now(),
        },
        Buffer.from(await file.arrayBuffer()),
      ));
    } catch {
      return c.json({ error: "could not hear the voice note" }, 422);
    }
    if (!transcript) return c.json({ error: "could not hear the voice note" }, 422);
    await runtime.ingest({
      type: "PatientReplied",
      journey_id: id,
      payload: { channel: "voice_sim", transcript, language: journey.patient.language },
    });
    await bus.idle();
    return c.json({ transcript, journey: runtime.journey(id) });
  });

  /** The synthetic intake documents (images and PDF only; the ground-truth file stays private). */
  app.get("/api/documents/:name", async (c) => {
    const name = c.req.param("name");
    const m = /^[a-z0-9-]+\.(png|pdf)$/.exec(name);
    if (!m) return c.json({ error: "not found" }, 404);
    try {
      const bytes = await readFile(fileURLToPath(new URL(name, DOCUMENTS_DIR)));
      return c.body(new Uint8Array(bytes), 200, {
        "content-type": m[1] === "pdf" ? "application/pdf" : "image/png",
      });
    } catch {
      return c.json({ error: "not found" }, 404);
    }
  });

  /** The ops brain switch (spec 8.5): Muse Spark Open on Baseten, or Spark 1.3. */
  app.get("/api/ops/brain", (c) =>
    c.json({ brain: ctx.models.brain.current, open_available: !!ctx.models.config.openWeight }),
  );
  app.post("/api/ops/brain", async (c) => {
    const body = z
      .object({ brain: z.enum(["cloud", "open"]) })
      .safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    ctx.models.brain.current = body.data.brain;
    return c.json({ brain: ctx.models.brain.current });
  });

  /** Recorded patient voice notes (WAV) the story sends to Voice Transcribe. */
  app.get("/api/voice/:name", async (c) => {
    const name = c.req.param("name");
    if (!/^[a-z0-9-]+\.wav$/.test(name)) return c.json({ error: "not found" }, 404);
    try {
      const bytes = await readFile(fileURLToPath(new URL(name, VOICE_DIR)));
      return c.body(new Uint8Array(bytes), 200, { "content-type": "audio/wav" });
    } catch {
      return c.json({ error: "not found" }, 404);
    }
  });

  /** Demo beats of Maria's Nov 17 (until the agents play the whole scenario). Resets state. */
  app.post("/api/demo/visit-day", async (c) => {
    const beat = c.req.query("beat") === "ct_outage" ? "ct_outage" : "lab";
    const journey = await seedDemo(ctx, beat);
    await bus.idle();
    return c.json(journey);
  });

  return app;
}

const DOCUMENTS_DIR = new URL("../../../fixtures/documents/", import.meta.url);
const VOICE_DIR = new URL("../../../fixtures/voice/", import.meta.url);

const Clarify = z.object({
  field: z.string().min(1),
  value: z.string().min(1).max(64),
  by: z.string().min(1),
});

const Reply = z.object({
  text: z.string().min(1).max(500),
  channel: z.enum(["sms_sim", "voice_sim", "kiosk"]).default("sms_sim"),
});

const ScenarioCommand = z.object({
  autopilot: z.boolean().default(true),
  speed: z.union([z.literal(1), z.literal(10), z.literal(60), z.literal(600)]).optional(),
});

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
