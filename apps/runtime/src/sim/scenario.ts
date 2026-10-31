import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Engine } from "@throughline/engine/node";
import { campus } from "@throughline/hospital";
import { LIS_TURNAROUND_MIN, MARIA, ORGS } from "@throughline/synthetic";
import {
  ItineraryRequest,
  type Appointment,
  type Journey,
  type Order,
  type Stop,
} from "@throughline/shared";
import mariaRequest from "../../../../packages/engine/fixtures/maria-request.json";
import type { SimBackground } from "../board";
import type { SimClock } from "../bus/sim-clock";
import type { RuntimeStore } from "../bus/store";
import { createJourney } from "../core/journeys";
import type { Runtime } from "../core/runtime";
import { locateFromPhoto } from "../locate";
import type { ModelCache } from "../models/cache";
import type { ModelConfig } from "../models/config";
import type { SensingLoop } from "./sensing-loop";

export const SCENARIO_JOURNEY = "maria-001";
const DAY = "2026-11-17";
const at = (hhmm: string) => `${DAY}T${hhmm}:00-06:00`;

/** Spec V7: no check-in at the next stop within ETA + 12 minutes. */
export const LOST_AFTER_MIN = 12;
/** The scripted beat (spec 10.3, 09:58): Maria lingers at the café after her CT. */
const LINGER_MIN = 15;
/** Lab codes as written → LIS turnaround (synthetic). */
const TURNAROUND: Record<string, number> = { "o-cbc": LIS_TURNAROUND_MIN["CBC w/ diff"] ?? 45 };
/** The Elevator A sign on Level 1, one of the committed demo photos (packages/synthetic/signs). */
const ELEVATOR_A_PHOTO = fileURLToPath(
  new URL("../../../../packages/synthetic/signs/14.webp", import.meta.url),
);
const CLINICAL_QUESTION = "Is it normal to feel dizzy?";

export interface ScenarioDeps {
  background: SimBackground;
  runtime: Runtime;
  store: RuntimeStore;
  clock: SimClock;
  sensing: SensingLoop;
  engine: Engine;
  models: { config: ModelConfig; cache: ModelCache };
}

export interface ScenarioOptions {
  /** Scripted people for the gates: a manager approves proposals, a nurse calls back. */
  autopilot: boolean;
}

/** Maria on the morning of Nov 17: confirmed, wheelchair, no itinerary until she arrives. */
function confirmedMaria(): Journey {
  const request = ItineraryRequest.parse(mariaRequest);
  const deps: Record<string, Order["depends_on"]> = {
    "o-visit": [
      { order_id: "o-cbc", kind: "resulted_before", min_gap_minutes: 45 },
      { order_id: "o-vitals", kind: "same_day_after", min_gap_minutes: 0 },
    ],
    "o-infusion": [{ order_id: "o-visit", kind: "same_day_after", min_gap_minutes: 35 }],
  };
  const kind = (station: string): Order["kind"] =>
    station === "lab_draw"
      ? "lab"
      : station === "imaging_ct"
        ? "imaging"
        : station === "infusion"
          ? "infusion"
          : "visit";
  const orders: Order[] = request.stops.map((s) => ({
    id: s.order_id,
    kind: kind(s.station_id),
    code_as_written: s.order_id,
    station_id: s.station_id,
    duration_min: s.duration_min,
    depends_on: deps[s.order_id] ?? [],
    auth_required: s.station_id === "imaging_ct",
    status: "scheduled",
  }));
  const appointments: Appointment[] = request.stops
    .filter((s) => s.not_before)
    .map((s) => ({
      id: `appt-${s.order_id}`,
      order_id: s.order_id,
      station_id: s.station_id,
      // CT is booked on CT 1, so the 09:40 outage hits it (DECISIONS #22).
      start: s.not_before as string,
      end: new Date(Date.parse(s.not_before as string) + s.duration_min * 60_000)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z"),
      status: "booked",
    }));
  const base = createJourney({
    id: SCENARIO_JOURNEY,
    patient: { ...MARIA, mobility: "wheelchair" },
    referring_provider: ORGS.referring_clinic,
    service_requested: "Medical oncology, new patient",
    now: "2026-11-10T08:12:00-06:00",
  });
  return {
    ...base,
    phase: "PRE",
    state: "CONFIRMED",
    orders,
    appointments,
    visit_days: ["2026-11-14", DAY],
    outreach_log: [
      {
        id: "m-reply",
        direction: "in",
        channel: "voice_sim",
        language: "en",
        text: "Yes, I confirm. But my husband can't come, so I'll need a wheelchair.",
        disclaimer: false,
        at: "2026-11-13T17:05:00-06:00",
      },
    ],
    memory: { preferred_language: "en", mobility: "wheelchair", companion_present: "false" },
  };
}

/**
 * The visit-day scenario (spec 10.3, 09:12 to 14:30), driven by the sim clock: the sensing
 * loop every minute, a simulated Maria who walks, checks in, starts and finishes stops, the
 * LIS returning results, the lost-patient timer, and the scripted beats. Every beat is a
 * function of the sim clock, so the day replays the same way at any speed.
 */
export class VisitDayScenario {
  private arrivalAt: number | undefined;
  private lingered = false;
  private lostAt: number | undefined;
  private photoSent = false;
  private asked = false;
  private checkedOut = false;
  private readonly approvals = new Map<string, number>();
  private timer: number | undefined;

  constructor(
    private readonly deps: ScenarioDeps,
    private readonly options: ScenarioOptions,
  ) {}

  /** Resets the runtime to 09:10 on Nov 17 and schedules the day. */
  start(): void {
    const { runtime, store, clock, background } = this.deps;
    store.reset();
    background.reset();
    clock.reset(at("09:10"));
    runtime.saveJourney(confirmedMaria());
    clock.at(at("09:12"), "Maria checks in at the kiosk", async () => {
      await runtime.ingest({
        type: "PatientArrived",
        journey_id: SCENARIO_JOURNEY,
        payload: { node_id: "mp1.lobby" },
      });
      this.arrivalAt = this.walkFrom("mp1.lobby");
    });
    this.everyMinute();
  }

  stop(): void {
    if (this.timer !== undefined) this.deps.clock.cancel(this.timer);
    this.timer = undefined;
  }

  get done(): boolean {
    return this.checkedOut;
  }

  private everyMinute(): void {
    const next = Math.floor(this.deps.clock.nowMsValue() / 60_000) * 60_000 + 60_000;
    this.timer = this.deps.clock.at(next, "scenario minute", async () => {
      await this.deps.sensing.tick();
      await this.maria();
      if (this.options.autopilot) await this.autopilot();
      if (!this.checkedOut) this.everyMinute();
    });
  }

  private journey(): Journey | undefined {
    return this.deps.runtime.journey(SCENARIO_JOURNEY);
  }

  private walkFrom(from: string): number | undefined {
    const stop = this.current();
    if (!stop) return undefined;
    const journey = this.journey();
    const route = this.deps.engine.walkingRoute({
      from,
      to: stop.node_id,
      mobility: journey?.memory.mobility === "wheelchair" ? "wheelchair" : "walking",
    });
    return this.deps.clock.nowMsValue() + route.seconds * 1000;
  }

  private current(): Stop | undefined {
    return this.journey()?.itinerary?.stops.find(
      (s) => s.status !== "done" && s.status !== "skipped",
    );
  }

  /** Simulated Maria: walk, check in, start when it is her turn, finish when service ends. */
  private async maria(): Promise<void> {
    const { runtime, clock } = this.deps;
    const journey = this.journey();
    if (!journey?.itinerary || this.checkedOut) return;
    const now = clock.nowMsValue();
    const stop = this.current();

    if (!stop) {
      await runtime.ingest({ type: "VisitCheckedOut", journey_id: SCENARIO_JOURNEY, payload: {} });
      const after = this.journey();
      if (after) {
        const arrived = Date.parse(at("09:12"));
        runtime.saveJourney({
          ...after,
          kpis: { ...after.kpis, actual_minutes_on_site: Math.round((now - arrived) / 60_000) },
        });
      }
      this.checkedOut = true;
      return;
    }

    if (stop.status === "in_service") {
      if (
        stop.station_id === "infusion" &&
        !this.asked &&
        now >= Date.parse(stop.eta_start) + 20 * 60_000
      ) {
        // Spec V9: a clinical question in chat goes to the nurse line, never answered.
        this.asked = true;
        await runtime.ingest({
          type: "PatientReplied",
          journey_id: SCENARIO_JOURNEY,
          payload: { channel: "sms_sim", text: CLINICAL_QUESTION, language: "en" },
        });
      }
      if (now >= Date.parse(stop.eta_end)) {
        await runtime.ingest({
          type: "StopCompleted",
          journey_id: SCENARIO_JOURNEY,
          station_id: stop.station_id,
          payload: { order_id: stop.order_id },
        });
        const turnaround = TURNAROUND[stop.order_id];
        if (turnaround !== undefined) {
          clock.after(turnaround, `LIS result for ${stop.order_id}`, async () => {
            await runtime.ingest({
              type: "ResultReady",
              journey_id: SCENARIO_JOURNEY,
              payload: { order_id: stop.order_id },
            });
          });
        }
        this.arrivalAt = this.walkFrom(stop.node_id);
        // After CT she lingers at the café instead of heading to the next stop.
        if (stop.station_id === "imaging_ct" && !this.lingered) {
          this.lingered = true;
          this.arrivalAt = undefined;
        }
      }
      return;
    }

    if (stop.status === "waiting") {
      // Her turn: the stop starts at its planned start (queue and booked time are in the ETA).
      if (now >= Date.parse(stop.eta_start)) {
        await runtime.ingest({
          type: "StopStarted",
          journey_id: SCENARIO_JOURNEY,
          station_id: stop.station_id,
          payload: { order_id: stop.order_id },
        });
      }
      return;
    }

    // Walking (pending or in transit). Lost check first (spec V7).
    if (
      !journey.lost &&
      this.arrivalAt === undefined &&
      now > Date.parse(stop.eta_start) + LOST_AFTER_MIN * 60_000
    ) {
      await runtime.ingest({
        type: "PatientLost",
        journey_id: SCENARIO_JOURNEY,
        payload: {
          expected_node_id: stop.node_id,
          minutes_overdue: Math.round((now - Date.parse(stop.eta_start)) / 60_000),
        },
      });
      this.lostAt = now;
      return;
    }
    if (
      this.arrivalAt === undefined &&
      this.lingered &&
      !this.photoSent &&
      this.lostAt !== undefined &&
      now >= this.lostAt + 2 * 60_000
    ) {
      // She photographs the nearest sign (Elevator A, Level 1) and gets directions (spec V5).
      this.photoSent = true;
      await locateFromPhoto(this.deps, SCENARIO_JOURNEY, {
        bytes: readFileSync(ELEVATOR_A_PHOTO),
        mime: "image/webp",
      });
      this.arrivalAt = this.walkFrom("mp1.elevA");
      return;
    }
    if (this.arrivalAt === undefined && this.lingered && !this.photoSent) {
      // Lingering: nothing happens until the lost timer and the photo.
      if (now >= Date.parse(stop.eta_start) + (LINGER_MIN + LOST_AFTER_MIN) * 60_000)
        this.arrivalAt = this.walkFrom("mp1.cafe");
      return;
    }
    if (this.arrivalAt !== undefined && now >= this.arrivalAt) {
      // Check-in scan at the station (confidence 1 marks a scan, not a sign photo).
      const waiting =
        campus.stations.find((s) => s.id === stop.station_id)?.waiting_node ?? stop.node_id;
      await runtime.ingest({
        type: "PatientLocated",
        journey_id: SCENARIO_JOURNEY,
        payload: { node_id: waiting, confidence: 1 },
      });
      this.arrivalAt = undefined;
    }
  }

  /** Scripted people: a manager approves a proposal after 1 minute; a nurse calls back in 5. */
  private async autopilot(): Promise<void> {
    const { store, runtime, clock } = this.deps;
    const now = clock.nowMsValue();
    for (const review of store.reviews("pending")) {
      const seen = this.approvals.get(review.id) ?? now;
      this.approvals.set(review.id, seen);
      const waitMin = review.kind === "handoff" ? 5 : 1;
      if (now - seen < waitMin * 60_000) continue;
      if (
        review.kind === "approval" &&
        review.capability === "ops_action.apply" &&
        review.station_id
      ) {
        const parked = review.pending_event as { payload?: { action?: { id?: string } } };
        await runtime.ingest({
          type: "OpsActionApproved",
          station_id: review.station_id,
          payload: { action_id: parked.payload?.action?.id ?? "", by: "manager.demo" },
        });
      } else if (review.kind === "handoff" && review.journey_id) {
        await runtime.ingest({
          type: "HandoffResolved",
          journey_id: review.journey_id,
          payload: { review_id: review.id, by: "nurse.demo" },
        });
      }
    }
  }
}
