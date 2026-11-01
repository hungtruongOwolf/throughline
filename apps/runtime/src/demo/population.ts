import { loadEngine } from "@throughline/engine/node";
import {
  FAX_LINE,
  REFERRALS,
  referralSpec,
  visited,
  type ReferralSpec,
} from "@throughline/synthetic";
import type { DocumentRef, DomainEvent, Journey } from "@throughline/shared";
import { campus } from "@throughline/hospital";
import type { AppContext } from "../app";
import { createJourney } from "../core/journeys";
import { VisitDayScenario } from "../sim/scenario";
import { mariaVoiceReply } from "./story";

/**
 * The hospital on the morning of Tue Nov 17 (docs/PLATFORM-DESIGN.md section 6). Every
 * referral in the book is played through real events from its fax onward: agents run, the
 * simulated staff, patients, and payer answer on the sim clock, and each journey stops where
 * its plan says. With MODEL_CACHE=replay the whole build serves recorded model outputs.
 */

export const POPULATION_START = "2026-10-27T08:00:00-06:00";
/** Maria's visit day begins (her scenario continues from here). */
const MARIA_DAY = "2026-11-17T09:10:00-06:00";
/** The moment the platform opens on: CT 1 is down and the ops change waits for Sam. */
export const POPULATION_END = "2026-11-17T09:53:00-06:00";

const STAFF = { coordinator: "Jordan Park", nurse: "Renee Alvarez, RN" };

const REPLIES: Partial<Record<ReferralSpec["plan"], string>> = {
  confirmed: "Yes, that works for me. See you then.",
  confirmed_wheelchair: "Yes, I'll be there. I use a wheelchair, so please have one ready.",
  clinical_reply: "Yes, I can come. I've had a fever since last night, is that okay?",
};
const VISIT_CONFIRM = "Yes, I'll be there.";
const CHECKIN_REPLY =
  "Yes, I picked up the prescription. My son will drive me. No need for a call.";

export function documentsFor(spec: ReferralSpec): DocumentRef[] {
  const prefix = spec.id === "maria-001" ? "maria" : spec.id;
  return [
    {
      id: `doc-${spec.id}-referral`,
      kind: "referral_fax",
      uri: `/api/documents/${prefix}-referral-fax.png`,
      mime: "image/png",
    },
    {
      id: `doc-${spec.id}-card`,
      kind: "insurance_card",
      uri: `/api/documents/${prefix}-insurance-card.png`,
      mime: "image/png",
    },
  ];
}

/** A referral fax is received: the journey opens and intake starts (spec B1). */
export async function receiveReferral(
  ctx: Pick<AppContext, "runtime" | "clock">,
  spec: ReferralSpec,
  journeyId = spec.id,
): Promise<Journey> {
  const documents = documentsFor(spec);
  const base = createJourney({
    id: journeyId,
    patient: spec.patient,
    referring_provider: spec.practice.provider,
    service_requested: "Referral received by fax",
    now: ctx.clock.now(),
  });
  ctx.runtime.saveJourney({ ...base, referral: { ...base.referral, documents } });
  await ctx.runtime.ingest({
    type: "ReferralReceived",
    journey_id: journeyId,
    payload: { documents },
  });
  return ctx.runtime.journey(journeyId) as Journey;
}

/** "Monday, December 7" for a booked start. */
function dayName(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A patient on their visit day, minute by minute: arrive, check in at each stop, start when
 * it is their turn, finish when service ends; the lab returns results 45 minutes later.
 */
function walkVisit(ctx: AppContext, journeyId: string, arriveAt: number): void {
  const { runtime, clock } = ctx;
  const tick = () =>
    clock.after(2, `visit:${journeyId}`, async () => {
      const journey = runtime.journey(journeyId);
      if (!journey || journey.phase !== "VISIT") return;
      const stop = journey.itinerary?.stops.find(
        (s) => s.status !== "done" && s.status !== "skipped",
      );
      const now = clock.nowMsValue();
      if (!stop) {
        await runtime.ingest({ type: "VisitCheckedOut", journey_id: journeyId, payload: {} });
        return;
      }
      if (stop.status === "in_service") {
        if (now >= Date.parse(stop.eta_end)) {
          await runtime.ingest({
            type: "StopCompleted",
            journey_id: journeyId,
            station_id: stop.station_id,
            payload: { order_id: stop.order_id },
          });
          if (stop.station_id === "lab_draw") {
            const labs = journey.orders.filter(
              (o) => o.kind === "lab" && !o.id.startsWith("o-fu-"),
            );
            clock.after(45, `lab results:${journeyId}`, async () => {
              for (const o of labs) {
                await runtime.ingest({
                  type: "ResultReady",
                  journey_id: journeyId,
                  payload: { order_id: o.id },
                });
              }
            });
          }
        }
      } else if (stop.status === "waiting") {
        if (now >= Date.parse(stop.eta_start)) {
          await runtime.ingest({
            type: "StopStarted",
            journey_id: journeyId,
            station_id: stop.station_id,
            payload: { order_id: stop.order_id },
          });
        }
      } else if (now >= Date.parse(stop.eta_start) - 5 * 60_000) {
        const waiting =
          campus.stations.find((s) => s.id === stop.station_id)?.waiting_node ?? stop.node_id;
        await runtime.ingest({
          type: "PatientLocated",
          journey_id: journeyId,
          payload: { node_id: waiting, confidence: 1 },
        });
      }
      tick();
    });
  clock.at(arriveAt, `arrives:${journeyId}`, async () => {
    await runtime.ingest({
      type: "PatientArrived",
      journey_id: journeyId,
      payload: { node_id: "mp1.lobby" },
    });
    tick();
  });
}

/**
 * Plays the referral book up to the morning of Nov 17. The simulated people answer on the
 * clock: the coordinator answers questions and approves submissions, patients reply, the
 * oncologists sign summaries, and each journey stops at its plan.
 */
export async function populate(ctx: AppContext): Promise<void> {
  const { runtime, store, clock, background, bus, world } = ctx;
  store.reset();
  background.reset();
  clock.stop();
  clock.reset(POPULATION_START);
  const planOf = (id?: string) => (id ? referralSpec(id)?.plan : undefined);
  world.decide = () => "approved";
  world.payerDelayMin = (id) =>
    id.startsWith("ref-v") ? 2 : planOf(id) === "auth_submitted" ? 8 * 24 * 60 : undefined;
  world.skipAck = (id) => planOf(id) === "results_overdue";

  const later = (minutes: number, label: string, fn: () => Promise<unknown>) =>
    clock.after(minutes, label, async () => {
      await fn();
    });
  const reply = (journeyId: string, text: string) =>
    runtime.ingest({
      type: "PatientReplied",
      journey_id: journeyId,
      payload: { channel: "sms_sim", text, language: "en" },
    });

  const react = async ({ event }: { event: DomainEvent }) => {
    const id = event.journey_id;
    const spec = id ? referralSpec(id) : undefined;
    if (!id || !spec || id.startsWith("ref-v")) return;
    const plan = spec.plan;
    switch (event.type) {
      case "ClarificationNeeded":
        if (plan !== "question") {
          later(plan === "maria" ? 1 : 25, `answer:${id}`, () =>
            runtime.ingest({
              type: "ClarificationAnswered",
              journey_id: id,
              payload: { field: event.payload.field, value: spec.memberId, by: STAFF.coordinator },
            }),
          );
        }
        return;
      case "HumanReviewRequested": {
        const { review_id, capability } = event.payload;
        if (capability === "prior_auth.submit" && plan !== "auth_waiting") {
          later(plan === "maria" ? 1 : 70, `approve:${id}`, () =>
            runtime.resolve(review_id, "approved", STAFF.coordinator),
          );
        }
        if (capability === "summary.send" && plan !== "summary_waiting" && plan !== "maria") {
          later(150, `sign:${id}`, () =>
            runtime.resolve(review_id, "approved", `Dr. ${spec.oncologist}`),
          );
        }
        return;
      }
      case "PrepPlanSent": {
        const text =
          plan === "maria"
            ? undefined
            : (REPLIES[plan] ?? (visited(spec) ? VISIT_CONFIRM : undefined));
        if (text) later(180, `reply:${id}`, () => reply(id, text));
        return;
      }
      case "AppointmentsBooked": {
        if (!visited(spec)) return;
        const first = event.payload.appointments
          .filter((a) => !a.order_id.startsWith("o-fu-"))
          .map((a) => Date.parse(a.start))
          .sort((a, b) => a - b)[0];
        if (first !== undefined) walkVisit(ctx, id, first - 15 * 60_000);
        return;
      }
      case "TeachbackSent": {
        if (plan === "teachback_waiting" || plan === "summary_waiting") return;
        const journey = runtime.journey(id);
        const lab = journey?.appointments
          .filter((a) => a.order_id.startsWith("o-fu-") && a.station_id === "lab_draw")
          .map((a) => a.start)
          .sort()[0];
        const text =
          plan === "teachback_unclear"
            ? "My next blood test is sometime in December, I'm not sure of the day. I bring my insurance card and my ID. I'd call the clinic."
            : `My next blood test is ${lab ? dayName(lab) : "soon"}. I bring my insurance card and my ID. I call the clinic at 555-0100.`;
        later(120, `teachback:${id}`, () => reply(id, text));
        return;
      }
      case "LogisticsCheckinSent":
        if (plan !== "checkin_waiting") later(60, `checkin:${id}`, () => reply(id, CHECKIN_REPLY));
        return;
      default:
        return;
    }
  };
  const unsubscribe = bus.subscribe(
    [
      "ClarificationNeeded",
      "HumanReviewRequested",
      "PrepPlanSent",
      "AppointmentsBooked",
      "TeachbackSent",
      "LogisticsCheckinSent",
    ],
    react,
  );

  // Maria answers by voice once her plan arrives (the recorded voice note).
  const mariaReply = bus.subscribe(["PrepPlanSent"], async ({ event }) => {
    if (event.journey_id !== "maria-001") return;
    later(1, "maria replies", async () =>
      runtime.ingest({
        type: "PatientReplied",
        journey_id: "maria-001",
        payload: await mariaVoiceReply(ctx),
      }),
    );
  });

  for (const spec of REFERRALS) {
    clock.at(spec.receivedAt, `fax:${spec.id}`, async () => {
      await receiveReferral(ctx, spec);
    });
  }
  await clock.advanceTo(MARIA_DAY);
  await bus.idle();
  unsubscribe();
  mariaReply();

  // Maria's morning: arrival 9:12, CT 1 down at 9:40, the ops change proposed and held.
  const scenario = new VisitDayScenario(
    { ...ctx, engine: loadEngine() },
    { autopilot: false, continueJourney: true },
  );
  await scenario.start();
  await clock.advanceTo(POPULATION_END);
  await bus.idle();
  ctx.received.clear();
}

/** The faxes on the fax line that have not been received since the last restore. */
export function faxLine(ctx: Pick<AppContext, "received">) {
  return FAX_LINE.filter((s) => !ctx.received.has(s.id));
}
