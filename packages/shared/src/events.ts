import { z } from "zod";
import { Id, IsoTime, Language, NodeId, StationId, Synthetic } from "./common";
import { Capability } from "./capabilities";
import {
  Appointment,
  AuthPacket,
  Coverage,
  DocumentRef,
  Itinerary,
  Order,
  Patient,
  Referral,
} from "./journey/types";
import { MemoryKey } from "./memory";
import { OpsAction, QueueState } from "./ops";

const Empty = z.object({});
const By = z.string().min(1);

export const ReferralPacket = z.object({
  patient: Patient.omit({ id: true }),
  referral: Referral.omit({ received_at: true, documents: true }),
  member_id: z.string().optional(),
  orders: z.array(Order.pick({ kind: true, code_as_written: true })),
  missing_fields: z.array(z.string()),
});
export type ReferralPacket = z.infer<typeof ReferralPacket>;

const StopDiff = z.object({
  order_id: Id,
  change: z.enum(["moved_earlier", "moved_later", "swapped_station"]),
  from: z.string(),
  to: z.string(),
});

/** Payload schema per event type (spec 5.3). Result events carry ids and timestamps only. */
export const EVENT_PAYLOADS = {
  // PRE
  ReferralReceived: z.object({ documents: z.array(DocumentRef).min(1) }),
  IntakeExtracted: z.object({ packet: ReferralPacket }),
  ClarificationNeeded: z.object({ question: z.string(), field: z.string() }),
  ClarificationAnswered: z.object({ field: z.string(), value: z.string(), by: By }),
  EligibilityChecked: z.object({ coverage: Coverage }),
  PriorAuthDrafted: z.object({ packet: AuthPacket }),
  PriorAuthSubmitted: z.object({ packet_id: Id, by: By }),
  PriorAuthDecided: z.object({
    packet_id: Id,
    decision: z.enum(["approved", "denied"]),
    reason: z.string().optional(),
  }),
  AppointmentsProposed: z.object({
    appointments: z.array(Appointment),
    visit_days: z.array(z.string()),
    alternative: z.array(Appointment).optional(),
    explanation: z.string(),
  }),
  AppointmentsBooked: z.object({ appointments: z.array(Appointment) }),
  PrepPlanSent: z.object({ message_ids: z.array(Id) }),
  ReminderSent: z.object({ message_id: Id, hours_before: z.number() }),
  PatientReplied: z.object({
    channel: z.enum(["sms_sim", "voice_sim", "kiosk"]),
    text: z.string().optional(),
    transcript: z.string().optional(),
    language: Language,
  }),
  ReplyHandled: z.object({
    intent: z.enum(["confirm", "reschedule", "question", "human"]),
    memory_keys: z.array(MemoryKey),
  }),
  VisitConfirmed: Empty,
  NoShowRiskScored: z.object({ score: z.number().min(0).max(1), drivers: z.array(z.string()) }),
  WaitlistOffered: z.object({ to_journey_id: Id }),
  // VISIT
  PatientArrived: z.object({ node_id: NodeId }),
  ItineraryPlanned: z.object({ itinerary: Itinerary }),
  QueueStateUpdated: z.object({ queue: QueueState }),
  StopStarted: z.object({ order_id: Id }),
  StopCompleted: z.object({ order_id: Id }),
  PatientLocated: z.object({ node_id: NodeId, confidence: z.number().min(0).max(1) }),
  DirectionsSent: z.object({ steps: z.array(z.string()), to_node_id: NodeId }),
  ResultReady: z.object({ order_id: Id }).strict(),
  ItineraryReplanned: z.object({
    itinerary: Itinerary,
    reason: z.array(z.string()),
    diff: z.array(StopDiff),
  }),
  PatientLost: z.object({ expected_node_id: NodeId, minutes_overdue: z.number() }),
  BottleneckDetected: z.object({
    severity: z.enum(["moderate", "high"]),
    minutes: z.number(),
  }),
  OpsActionProposed: z.object({ action: OpsAction }),
  OpsActionApproved: z.object({ action_id: Id, by: By }),
  OpsActionRejected: z.object({ action_id: Id, by: By, note: z.string().optional() }),
  OpsActionApplied: z.object({ action_id: Id, affected_journey_ids: z.array(Id) }),
  HandoffRequested: z.object({ reason: z.enum(["clinical_question", "patient_asked", "other"]) }),
  HandoffResolved: z.object({ review_id: Id, by: By }),
  VisitCheckedOut: Empty,
  // POST
  SummaryDrafted: z.object({ sections: z.number().int().positive() }),
  SummaryReviewed: z.object({ by: By }),
  SummarySent: z.object({ disclaimer_mode: z.boolean(), message_id: Id }),
  TeachbackSent: z.object({ message_id: Id }),
  TeachbackAnswered: z.object({
    answers: z.record(z.string(), z.enum(["correct", "wrong", "not_sure"])),
    passed: z.boolean(),
  }),
  FollowUpsBooked: z.object({ appointments: z.array(Appointment) }),
  ResultAcknowledged: z.object({ order_id: Id, by: By }).strict(),
  ResultAckOverdue: z.object({ order_id: Id, hours: z.number() }).strict(),
  LogisticsCheckinSent: z.object({ message_id: Id }),
  LogisticsCheckinAnswered: z.object({
    medication_picked_up: z.boolean().optional(),
    ride_confirmed: z.boolean().optional(),
    wants_nurse_call: z.boolean().optional(),
  }),
  ReferralClosed: z.object({
    report: z.object({
      completed_services: z.array(z.string()),
      dates: z.array(z.string()),
      pending_items: z.array(z.string()),
    }),
  }),
  // Cross-cutting
  HumanReviewRequested: z.object({
    review_id: Id,
    kind: z.enum(["approval", "handoff", "task"]),
    capability: Capability,
    reason: z.string(),
  }),
  HumanReviewResolved: z.object({
    review_id: Id,
    decision: z.enum(["approved", "rejected"]),
    by: By,
    note: z.string().optional(),
  }),
  ContentBlocked: z.object({
    capability: Capability,
    category: z.enum(["symptom", "medication", "result", "diagnosis", "other"]),
  }),
  MemoryUpdated: z.object({ key: MemoryKey }),
} as const;

export type EventType = keyof typeof EVENT_PAYLOADS;
export const EVENT_TYPES = Object.keys(EVENT_PAYLOADS) as EventType[];

/** Station-scoped events handled by the OpsRuntime; everything else is journey-scoped. */
export const OPS_EVENT_TYPES = [
  "QueueStateUpdated",
  "BottleneckDetected",
  "OpsActionProposed",
  "OpsActionApproved",
  "OpsActionRejected",
  "OpsActionApplied",
] as const satisfies readonly EventType[];

export const JOURNEY_EVENT_TYPES = EVENT_TYPES.filter(
  (t) => !(OPS_EVENT_TYPES as readonly string[]).includes(t),
) as Exclude<EventType, (typeof OPS_EVENT_TYPES)[number]>[];

export function isOpsEventType(type: EventType): boolean {
  return (OPS_EVENT_TYPES as readonly string[]).includes(type);
}

const EventBase = {
  id: Id,
  occurred_at: IsoTime,
  synthetic: Synthetic,
};

function eventSchema<T extends EventType>(type: T) {
  const scope = isOpsEventType(type)
    ? { station_id: StationId, journey_id: Id.optional() }
    : { journey_id: Id, station_id: StationId.optional() };
  return z.object({
    ...EventBase,
    ...scope,
    type: z.literal(type),
    payload: EVENT_PAYLOADS[type] as (typeof EVENT_PAYLOADS)[T],
  });
}

export const DomainEvent = z.discriminatedUnion(
  "type",
  EVENT_TYPES.map((t) => eventSchema(t)) as unknown as [
    ReturnType<typeof eventSchema<EventType>>,
    ...ReturnType<typeof eventSchema<EventType>>[],
  ],
);

export type DomainEvent = {
  [T in EventType]: {
    id: string;
    type: T;
    occurred_at: string;
    synthetic: true;
    journey_id?: string;
    station_id?: z.infer<typeof StationId>;
    payload: z.infer<(typeof EVENT_PAYLOADS)[T]>;
  };
}[EventType];

export type EventOf<T extends EventType> = Extract<DomainEvent, { type: T }>;
