import type { Engine } from "@throughline/engine/node";
import { ORDER_TEMPLATES } from "@throughline/synthetic";
import { t, type DomainEvent, type Journey, type Order } from "@throughline/shared";
import type {
  AgentDescriptor,
  DeterministicAgent,
  HandlerContext,
  HandlerResult,
} from "../../core/agent";
import { scheduleRequest } from "../scheduler/handler";
import { outbound, whenText } from "../shared/messages";

export const followupDescriptor: AgentDescriptor = {
  name: "followup",
  capabilities: ["followup.book", "logistics.checkin", "referral.close"],
  // Logistics only; check-in answers are never read clinically (spec A5).
  risk: "LOW",
};

/** Repeat labs "in 3 weeks": the follow-up search starts 19 days after checkout. */
const FOLLOW_UP_AFTER_DAYS = 19;

function followUpOrders(): Order[] {
  return ORDER_TEMPLATES.follow_up.map((tpl) => ({
    id: `o-fu-${tpl.key}`,
    kind: tpl.kind,
    code_as_written: tpl.code_as_written,
    station_id: tpl.station_id,
    duration_min: tpl.duration_min,
    depends_on: tpl.depends_on.map((d) => ({
      order_id: `o-fu-${d.key}`,
      kind: d.kind,
      ...(d.min_gap_minutes === undefined ? {} : { min_gap_minutes: d.min_gap_minutes }),
    })),
    auth_required: false,
    status: "ordered",
  }));
}

function plusDays(iso: string, days: number): string {
  const d = new Date(Date.parse(iso) + days * 86_400_000 - 6 * 3_600_000);
  return `${d.toISOString().slice(0, 10)}T08:00:00-06:00`;
}

/** A3: the engine books the repeat labs and the follow-up visit with the same rules. */
function book(ctx: HandlerContext, engine: Engine): HandlerResult {
  const journey = ctx.journey as Journey;
  const orders = followUpOrders();
  const { request, groups } = scheduleRequest(
    { ...journey, orders, auth_packets: [] },
    plusDays(ctx.now, FOLLOW_UP_AFTER_DAYS),
  );
  const plan = engine.schedule(request).primary;
  const appointments = plan.appointments.flatMap((a) =>
    (groups.get(a.order_id) ?? [a.order_id]).map((order_id) => ({
      id: `appt-${order_id}`,
      order_id,
      station_id: a.station_id,
      start: a.start,
      end: a.end,
      status: "booked" as const,
    })),
  );
  if (appointments.length === 0) {
    return {
      summary: "no follow-up slot found",
      tasks: [`Book follow-ups for ${journey.patient.display_name} by hand`],
      next_events: [],
    };
  }
  const booked = new Set(appointments.map((a) => a.order_id));
  return {
    summary: `follow-ups booked ${plan.visit_days.join(" / ")}`,
    journey_patch: (j) => ({
      ...j,
      orders: [
        ...j.orders,
        ...orders.map((o) => (booked.has(o.id) ? { ...o, status: "scheduled" as const } : o)),
      ],
      appointments: [...j.appointments, ...appointments],
    }),
    next_events: [{ type: "FollowUpsBooked", payload: { appointments } }],
  };
}

const YES_PICKED =
  /\b(picked (it |them )?up|got (it|them|my|the)|have (it|my)|ya la recog|la recogí)\b/;
const NOT_PICKED = /\b(not yet|haven't|have not|didn't|did not|todavía no|no la he)\b/;
const RIDE = /\b(drive|driving|ride|take me|taking me|bring me|me lleva)\b/;
const NO_RIDE = /\b(no ride|need a ride|nobody|no one|no tengo quién)\b/;
const NURSE_NO =
  /\b(no need|don't need|do not need|no thanks|no, thank|no hace falta|no gracias)\b/;
const NURSE_YES =
  /\b(yes,? (please )?(call|have)|please call|call me|que me llame|sí,? llámenme)\b/;

/** A5: yes/no logistics from the reply's words; nothing is read clinically. */
export function readCheckin(text: string) {
  const s = text.toLowerCase();
  return {
    ...(YES_PICKED.test(s) && !NOT_PICKED.test(s)
      ? { medication_picked_up: true }
      : NOT_PICKED.test(s)
        ? { medication_picked_up: false }
        : {}),
    ...(RIDE.test(s)
      ? { ride_confirmed: !NO_RIDE.test(s) }
      : NO_RIDE.test(s)
        ? { ride_confirmed: false }
        : {}),
    wants_nurse_call: NURSE_YES.test(s) && !NURSE_NO.test(s),
  };
}

function checkin(ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const lang = journey.patient.language;
  const reply = ctx.event as Extract<DomainEvent, { type: "PatientReplied" }>;
  const text = reply.payload.text ?? reply.payload.transcript ?? "";
  const answers = readCheckin(text);
  const tasks = [
    ...(answers.wants_nurse_call
      ? [`Nurse call to ${journey.patient.display_name}: asked at the day-3 check-in`]
      : []),
    ...(answers.ride_confirmed === false
      ? [`Arrange a ride for ${journey.patient.display_name}'s follow-up visit`]
      : []),
    ...(answers.medication_picked_up === false
      ? [`${journey.patient.display_name} has not picked up the prescription yet`]
      : []),
  ];
  const out = outbound(
    journey,
    t(lang, answers.wants_nurse_call ? "checkin.nurse" : "checkin.thanks"),
    ctx.now,
  );
  return {
    summary: `check-in answered${tasks.length ? `, ${tasks.length} task(s)` : ""}`,
    journey_patch: (j) => ({
      ...j,
      outreach_log: [
        ...j.outreach_log,
        {
          id: reply.id,
          direction: "in",
          channel: reply.payload.channel,
          language: reply.payload.language,
          text,
          disclaimer: false,
          at: reply.occurred_at,
        },
        ...out.messages,
      ],
      logistics_checkin: { sent_at: j.logistics_checkin?.sent_at ?? ctx.now, ...answers },
    }),
    outbound: out.outbound,
    ...(tasks.length ? { tasks } : {}),
    next_events: [{ type: "LogisticsCheckinAnswered", payload: answers }],
  };
}

/**
 * A6: the loop closes once follow-ups are booked, the teach-back is answered, every result is
 * acknowledged, and the day-3 check-in is answered. The report goes to the referring provider.
 */
function close(ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const followUps = journey.appointments.filter((a) => a.order_id.startsWith("o-fu-"));
  const checkin = journey.logistics_checkin;
  const waiting = [
    ...(followUps.length === 0 ? ["follow-ups"] : []),
    ...(journey.teachback?.passed === undefined ? ["teach-back"] : []),
    ...(journey.orders.some((o) => o.status === "resulted") ? ["result acknowledgment"] : []),
    ...(!checkin || checkin.wants_nurse_call === undefined ? ["check-in"] : []),
  ];
  if (waiting.length > 0) return { summary: `open: ${waiting.join(", ")}`, next_events: [] };
  const lang = journey.patient.language;
  const visitOrders = journey.orders.filter((o) => !o.id.startsWith("o-fu-"));
  // Blood drawn together is one stop: an order shares its stop's outcome.
  const slotOf = (id: string) => {
    const a = journey.appointments.find((x) => x.order_id === id);
    return a ? `${a.station_id}@${a.start}` : id;
  };
  const doneSlots = new Set(
    visitOrders
      .filter((o) => o.status !== "ordered" && o.status !== "scheduled")
      .map((o) => slotOf(o.id)),
  );
  const completed = visitOrders
    .filter((o) => doneSlots.has(slotOf(o.id)))
    .map((o) => o.code_as_written);
  const pending = [
    ...followUps.map((a) => {
      const order = journey.orders.find((o) => o.id === a.order_id);
      return `${order?.code_as_written ?? a.order_id}, ${whenText(a.start, lang)}`;
    }),
    ...(journey.teachback?.passed === false ? ["Nurse call after the teach-back"] : []),
    ...(checkin?.wants_nurse_call ? ["Nurse call requested at the check-in"] : []),
  ];
  const dates = [...journey.visit_days, ...followUps.map((a) => a.start.slice(0, 10))];
  return {
    summary: "referral closed, report sent to the referring provider",
    next_events: [
      {
        type: "ReferralClosed",
        payload: {
          report: {
            completed_services: completed,
            dates: [...new Set(dates)],
            pending_items: pending,
          },
        },
      },
    ],
  };
}

/** Follow-up (spec A3, A5, A6): engine booking, logistics check-in, loop closure. */
export function createFollowupAgent(deps: { engine: Engine }): DeterministicAgent {
  return {
    ...followupDescriptor,
    kind: "deterministic",
    handle: (ctx) => {
      if (!ctx.journey) return { summary: "no journey", next_events: [] };
      if (ctx.capability === "followup.book") return book(ctx, deps.engine);
      if (ctx.capability === "logistics.checkin") return checkin(ctx);
      if (ctx.capability === "referral.close") return close(ctx);
      return { summary: `not handled: ${ctx.capability}`, next_events: [] };
    },
  };
}
