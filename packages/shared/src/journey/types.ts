import { z } from "zod";
import { Id, IsoDate, IsoTime, Language, Mobility, NodeId, StationId, Synthetic } from "../common";
import { Memory } from "../memory";
import { JourneyState, Phase } from "./states";

export const DocumentRef = z.object({
  id: Id,
  kind: z.enum(["referral_fax", "insurance_card", "other"]),
  uri: z.string(),
  mime: z.string(),
});
export type DocumentRef = z.infer<typeof DocumentRef>;

export const Patient = z.object({
  id: Id,
  display_name: z.string().min(1),
  dob: IsoDate,
  language: Language,
  mobility: Mobility,
  /** Reserved fictional range +1 555 01xx (spec 10). */
  phone_sim: z.string().regex(/^\+1 555 01\d\d$/),
});
export type Patient = z.infer<typeof Patient>;

export const Referral = z.object({
  received_at: IsoTime,
  referring_provider: z.string(),
  service_requested: z.string(),
  documents: z.array(DocumentRef),
  /** Stored as written, never interpreted. */
  as_written: z.object({ diagnosis_code: z.string().optional(), urgency: z.string().optional() }),
});

export const Coverage = z.object({
  plan_id: Id,
  active: z.boolean(),
  copay_cents: z.number().int().nonnegative(),
  auth_required_order_ids: z.array(Id),
});

export const OrderDependency = z.object({
  order_id: Id,
  kind: z.enum(["resulted_before", "same_day_after", "after_auth"]),
  min_gap_minutes: z.number().int().nonnegative().optional(),
});
export type OrderDependency = z.infer<typeof OrderDependency>;

export const OrderStatus = z.enum([
  "ordered",
  "scheduled",
  "in_progress",
  "resulted",
  "acknowledged",
]);

/** Results are status only: there is deliberately no value field (spec 11.1). */
export const Order = z
  .object({
    id: Id,
    kind: z.enum(["lab", "imaging", "visit", "infusion", "pharmacy"]),
    code_as_written: z.string(),
    station_id: StationId,
    duration_min: z.number().int().positive(),
    depends_on: z.array(OrderDependency),
    auth_required: z.boolean(),
    status: OrderStatus,
    result_ready_at: IsoTime.optional(),
    acknowledged_by: z.string().optional(),
  })
  .strict();
export type Order = z.infer<typeof Order>;

export const AuthPacket = z.object({
  id: Id,
  order_ids: z.array(Id).min(1),
  status: z.enum(["draft", "submitted", "approved", "denied"]),
  sections: z.array(z.object({ heading: z.string(), body: z.string() })),
  submitted_by: z.string().optional(),
  decided_at: IsoTime.optional(),
  denial_reason: z.string().optional(),
});
export type AuthPacket = z.infer<typeof AuthPacket>;

export const Appointment = z.object({
  id: Id,
  order_id: Id,
  station_id: StationId,
  provider_id: Id.optional(),
  start: IsoTime,
  end: IsoTime,
  status: z.enum(["proposed", "booked", "arrived", "fulfilled", "cancelled", "noshow"]),
});
export type Appointment = z.infer<typeof Appointment>;

export const StopStatus = z.enum([
  "pending",
  "in_transit",
  "waiting",
  "in_service",
  "done",
  "skipped",
]);
export type StopStatus = z.infer<typeof StopStatus>;

export const Stop = z.object({
  order_id: Id,
  station_id: StationId,
  node_id: NodeId,
  status: StopStatus,
  eta_start: IsoTime,
  eta_end: IsoTime,
  people_ahead: z.number().int().nonnegative().optional(),
  est_wait_min: z.number().nonnegative().optional(),
});
export type Stop = z.infer<typeof Stop>;

export const Itinerary = z.object({
  stops: z.array(Stop),
  planned_at: IsoTime,
  reason: z.array(z.string()),
});
export type Itinerary = z.infer<typeof Itinerary>;

export const ImageRef = z.object({ id: Id, uri: z.string(), alt: z.string() });

export const PrepItem = z.object({
  kind: z.enum(["bring", "fasting", "parking", "entrance", "transport", "other"]),
  text: z.string(),
});

export const PrepPlan = z.object({
  items: z.array(PrepItem),
  /** Copied verbatim from the order text, never invented. */
  fasting_window_as_written: z.string().optional(),
  entrance: NodeId,
  parking: z.string(),
  estimated_minutes_on_site: z.number().int().positive(),
  cards: z.array(ImageRef),
});
export type PrepPlan = z.infer<typeof PrepPlan>;

export const Message = z.object({
  id: Id,
  direction: z.enum(["out", "in"]),
  channel: z.enum(["sms_sim", "voice_sim", "kiosk"]),
  language: Language,
  text: z.string(),
  disclaimer: z.boolean(),
  at: IsoTime,
});
export type Message = z.infer<typeof Message>;

export const Journey = z.object({
  id: Id,
  synthetic: Synthetic,
  patient: Patient,
  referral: Referral,
  coverage: Coverage.optional(),
  orders: z.array(Order),
  auth_packets: z.array(AuthPacket),
  appointments: z.array(Appointment),
  visit_days: z.array(IsoDate),
  prep_plan: PrepPlan.optional(),
  outreach_log: z.array(Message),
  confirmation: z.object({ confirmed_at: IsoTime, channel: Message.shape.channel }).optional(),
  phase: Phase,
  state: JourneyState,
  itinerary: Itinerary.optional(),
  last_location: z
    .object({ node_id: NodeId, at: IsoTime, source: z.enum(["checkin", "sign_photo"]) })
    .optional(),
  lost: z.boolean(),
  handoff_open: z.boolean(),
  paused_for_review: z.boolean(),
  summary: z
    .object({
      draft: z.array(z.object({ heading: z.string(), verbatim: z.string(), plain: z.string() })),
      sent_at: IsoTime.optional(),
      reviewed_by: z.string().optional(),
      disclaimer_mode: z.boolean(),
    })
    .optional(),
  teachback: z
    .object({
      sent_at: IsoTime,
      answers: z.record(z.string(), z.enum(["correct", "wrong", "not_sure"])),
      passed: z.boolean().optional(),
    })
    .optional(),
  logistics_checkin: z
    .object({
      sent_at: IsoTime,
      medication_picked_up: z.boolean().optional(),
      ride_confirmed: z.boolean().optional(),
      wants_nurse_call: z.boolean().optional(),
    })
    .optional(),
  kpis: z.object({
    planned_minutes_on_site: z.number().optional(),
    actual_minutes_on_site: z.number().optional(),
    walking_seconds: z.number().optional(),
    direction_requests: z.number().int().optional(),
    replans: z.number().int().optional(),
  }),
  memory: Memory,
  created_at: IsoTime,
  updated_at: IsoTime,
  version: z.number().int().nonnegative(),
});
export type Journey = z.infer<typeof Journey>;
