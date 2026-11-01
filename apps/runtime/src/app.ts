import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { SHARED_VERSION, StationId, type Hospital, type Journey } from "@throughline/shared";
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
import { campus, siteFloor, sites } from "@throughline/hospital";
import { locateFromPhoto } from "./locate";
import { transcribe } from "./models/voice";
import type { World } from "./sim/pre-visit";
import { agentRuns, agentStats, inbox, journeyRows, overview, runView, timeline } from "./platform";
import { documentsFor, faxLine, populate, receiveReferral } from "./demo/population";
import { createJourney } from "./core/journeys";
import { HOSPITALS, REFERRAL_AVAILABILITY, referralSpec } from "@throughline/synthetic";
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
  /** Visit requests patients made since the last restore. */
  requests: number;
  /** Hospitals that asked to join since the last restore. */
  setups: Hospital[];
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
  z.object({
    action: z.literal("advance"),
    minutes: z
      .number()
      .positive()
      .max(24 * 60),
  }),
  z.object({ action: z.literal("jump") }),
]);

/**
 * HTTP API. Routes persist and publish events, then return; they never run workflows
 * (spec 4.3 step 1).
 */
/** Rebuilds the hospital as of Nov 17, 9:53 am and lets the clock run in real time. */
let restoring: Promise<void> | undefined;
export function restoreHospital(ctx: AppContext): Promise<void> {
  // One rebuild at a time: a second request waits for the one already running.
  restoring ??= (async () => {
    await populate(ctx);
    ctx.activity.dirty = false;
    if (process.env.CLOCK_SPEED !== "0") ctx.clock.start(1);
  })().finally(() => {
    restoring = undefined;
  });
  return restoring;
}

export function createApp(ctx?: AppContext) {
  const app = new Hono();
  app.use("*", cors());
  // Development routes reset or drive the hospital; when ADMIN_TOKEN is set they need it.
  const adminOnly = async (c: Context, next: () => Promise<void>) => {
    const token = process.env.ADMIN_TOKEN;
    // A production deployment with no token keeps these routes closed rather than open.
    if (!token && process.env.NODE_ENV === "production") return c.json({ error: "not found" }, 404);
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
    if (review.status !== "pending") return c.json({ error: "already decided" }, 409);
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
  /** The hospital this workspace serves, and the hospitals on this deployment. */
  const SITES = sites(campus);
  const sized = (h: Hospital): Hospital => {
    const site = SITES[h.id];
    return site
      ? {
          ...h,
          buildings: site.buildings.filter((b) => b.name).length,
          floors: Math.max(...site.buildings.map((b) => b.floors)),
          forecasts: h.id === HOSPITALS[0]?.id,
        }
      : h;
  };
  app.get("/api/hospital", (c) => c.json(sized(HOSPITALS[0] as Hospital)));
  app.get("/api/hospitals", (c) => c.json([...HOSPITALS, ...ctx.setups].map(sized)));
  /** A hospital's buildings, floors, rooms, and walks, for the 3D view and wayfinding. */
  app.get("/api/hospitals/:id/site", (c) => {
    const site = SITES[c.req.param("id")];
    return site ? c.json(site) : c.json({ error: "this campus is not mapped yet" }, 404);
  });
  /** Who is waiting where in a hospital right now. The live workspace reads its own floor. */
  app.get("/api/hospitals/:id/floor", (c) => {
    const id = c.req.param("id");
    const site = SITES[id];
    if (!site) return c.json({ error: "this campus is not mapped yet" }, 404);
    if (id === HOSPITALS[0]?.id)
      return c.json(buildOverview(store, runtime, clock, background).stations);
    return c.json(siteFloor(site, clock.now()));
  });
  /** A hospital asks to join: it gets a workspace in setup, listed beside the live ones. */
  const Setup = z.object({
    name: z.string().trim().min(3).max(100),
    city: z.string().trim().min(2).max(60),
    specialties: z.array(z.string().trim().min(1).max(60)).min(1).max(8),
    phone: z.string().trim().min(7).max(30),
    payers: z.array(z.string().trim().min(1).max(80)).min(1).max(10),
    contact: z.string().trim().min(2).max(80),
  });
  app.post("/api/hospitals", async (c) => {
    const body = Setup.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    // A hospital joins once, and the list on a long-lived runtime stays small.
    const taken = [...HOSPITALS, ...ctx.setups].some(
      (x) => x.name.toLowerCase() === body.data.name.toLowerCase(),
    );
    if (taken) return c.json({ error: "that hospital is already on Throughline" }, 409);
    if (ctx.setups.length >= 20) return c.json({ error: "too many setups; try later" }, 429);
    const h = {
      id: `setup-${ctx.setups.length + 1}`,
      name: body.data.name,
      short_name: body.data.name.split(" ")[0] ?? body.data.name,
      city: body.data.city,
      specialties: body.data.specialties,
      phone: body.data.phone,
      phone_href: body.data.phone.replace(/[^\d+]/g, ""),
      payers: body.data.payers,
      status: "setting_up" as const,
    };
    ctx.setups.push(h);
    return c.json(h);
  });

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
        card: `/api/documents/${s.id}-insurance-card.png`,
        // What the patient on this referral would type (the visit form's example data).
        dob: s.patient.dob,
        phone: s.patient.phone_sim,
        member_id: s.memberId,
      })),
    ),
  );
  /** The insurance card on file for a referral (what the coordinator reads the member ID from). */
  app.get("/api/journeys/:id/insurance-card", (c) => {
    const journey = runtime.journey(c.req.param("id"));
    const card = journey?.referral.documents.find((d) => d.kind === "insurance_card");
    const specId = card?.uri.match(/\/api\/documents\/(.+)-insurance-card\.png$/)?.[1];
    const spec =
      specId === "maria" ? referralSpec("maria-001") : specId ? referralSpec(specId) : undefined;
    if (!card || !spec) return c.json({ error: "not found" }, 404);
    return c.json({ image: card.uri, member_id: spec.memberId, payer: "Lonestar Health Plan" });
  });

  /**
   * A patient books a visit themselves (/visit): who they are, their doctor's referral (or the
   * doctor to ask for one), insurance, and when they can come. The journey opens and the same
   * agents take it from there; the visit code is the patient's MRN.
   */
  const VisitRequest = z.object({
    service: z.enum(["new_patient", "second_opinion", "follow_up"]),
    referral_fax: z.string().optional(),
    doctor: z.string().max(120).optional(),
    patient: z.object({
      name: z.string().trim().min(2).max(80),
      dob: z.iso
        .date()
        .refine((d) => d <= new Date().toISOString().slice(0, 10) && d > "1900-01-01", {
          message: "date of birth is not valid",
        }),
      phone: z.string().trim().min(7).max(30),
      mobility: z.enum(["walking", "wheelchair"]),
      companion: z.boolean(),
    }),
    member_id: z.string().max(40).optional(),
    days: z
      .array(z.object({ date: z.iso.date(), part: z.enum(["morning", "afternoon", "any"]) }))
      .min(1)
      .max(15),
  });
  app.post("/api/visit-requests", async (c) => {
    const body = VisitRequest.safeParse(await c.req.json().catch(() => ({})));
    if (!body.success) return c.json({ error: body.error.issues }, 400);
    const req = body.data;
    if (req.referral_fax && !faxLine(ctx).some((s) => s.id === req.referral_fax))
      return c.json({ error: "that fax is not on the line" }, 404);
    const n = ctx.received.size + 1 + ctx.requests;
    ctx.requests += 1;
    const patientId = `pt-${900 + n}`;
    const id = `ref-v${100 + n}`;
    REFERRAL_AVAILABILITY[patientId] = req.days.map((d) => ({
      date: d.date,
      from: d.part === "afternoon" ? "12:00" : "07:30",
      to: d.part === "morning" ? "12:00" : "17:30",
    }));
    const spec = req.referral_fax ? faxLine(ctx).find((s) => s.id === req.referral_fax) : undefined;
    if (spec) ctx.received.add(spec.id);
    const patient = {
      id: patientId,
      display_name: req.patient.name,
      dob: req.patient.dob,
      language: "en" as const,
      mobility: req.patient.mobility,
      phone_sim: req.patient.phone,
    };
    const base = createJourney({
      id,
      patient,
      referring_provider: spec?.practice.provider ?? req.doctor ?? "Self-referred",
      service_requested:
        req.service === "follow_up"
          ? "Follow-up visit, medical oncology"
          : req.service === "second_opinion"
            ? "Second opinion, medical oncology"
            : "New patient consult, medical oncology",
      now: clock.now(),
    });
    const documents = spec ? documentsFor(spec) : [];
    runtime.saveJourney({
      ...base,
      referral: { ...base.referral, documents },
      memory: {
        ...base.memory,
        preferred_language: "en",
        mobility: req.patient.mobility,
        companion_present: req.patient.companion ? "true" : "false",
      },
    });
    if (spec) {
      await runtime.ingest({ type: "ReferralReceived", journey_id: id, payload: { documents } });
    } else {
      // No referral yet: the coordinator asks the patient's doctor for one.
      runtime.openTask(
        id,
        `Ask ${req.doctor?.trim() || "the patient's doctor"} to fax a referral for ${req.patient.name}`,
        { agent: "referral_intake", capability: "referral.clarify" },
      );
    }
    await bus.idle();
    return c.json({ id, visit_code: patientId.replace(/\D/g, "").padStart(6, "0") });
  });

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
    c.json({
      ...overview(store, buildOverview(store, runtime, clock, background).in_house),
      now: clock.now(),
    }),
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

  /** The committed sign photos (examples for the patient app's "Lost?" photo). */
  app.get("/api/signs/:file", async (c) => {
    const file = c.req.param("file");
    if (!/^\d{2}\.webp$/.test(file)) return c.json({ error: "not found" }, 404);
    try {
      const bytes = await readFile(fileURLToPath(new URL(file, SIGNS_DIR)));
      return c.body(new Uint8Array(bytes), 200, { "content-type": "image/webp" });
    } catch {
      return c.json({ error: "not found" }, 404);
    }
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
const SIGNS_DIR = new URL("../../../packages/synthetic/signs/", import.meta.url);

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
