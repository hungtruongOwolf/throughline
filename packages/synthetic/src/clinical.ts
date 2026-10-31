import type { OrderDependency, StationId } from "@throughline/shared";
import { streamFor } from "./rng";

/** Fictional organizations only (spec 10). */
export const ORGS = {
  hospital: "Halden Medical Center",
  referring_clinic: "Northgate Family Medicine",
  payer: "Lonestar Health Plan",
} as const;

export interface OrderTemplate {
  key: string;
  kind: "lab" | "imaging" | "visit" | "infusion" | "pharmacy";
  /** Stored as written, never interpreted. */
  code_as_written: string;
  station_id: StationId;
  duration_min: number;
  depends_on: (Omit<OrderDependency, "order_id"> & { key: string })[];
  fasting_as_written?: string;
}

/** Order templates per referral type; dependency keys refer to other templates in the set. */
export const ORDER_TEMPLATES: Record<"new_patient_med_onc" | "follow_up", OrderTemplate[]> = {
  new_patient_med_onc: [
    {
      key: "cbc",
      kind: "lab",
      code_as_written: "CBC w/ diff",
      station_id: "lab_draw",
      duration_min: 10,
      depends_on: [],
    },
    {
      key: "cmp",
      kind: "lab",
      code_as_written: "CMP",
      station_id: "lab_draw",
      duration_min: 10,
      depends_on: [],
      fasting_as_written: "Nothing to eat or drink except water for 8 hours before the blood draw.",
    },
    {
      key: "ct",
      kind: "imaging",
      code_as_written: "CT chest/abdomen/pelvis with contrast",
      station_id: "imaging_ct",
      duration_min: 25,
      depends_on: [{ key: "ct", kind: "after_auth" }],
    },
    {
      key: "vitals",
      kind: "visit",
      code_as_written: "Vitals before the clinic visit",
      station_id: "vitals",
      duration_min: 5,
      depends_on: [],
    },
    {
      key: "visit",
      kind: "visit",
      code_as_written: "New patient consult, medical oncology",
      station_id: "clinic_2a",
      duration_min: 20,
      depends_on: [
        { key: "cbc", kind: "resulted_before", min_gap_minutes: 48 * 60 },
        { key: "cmp", kind: "resulted_before", min_gap_minutes: 48 * 60 },
        { key: "ct", kind: "same_day_after", min_gap_minutes: 30 },
        { key: "vitals", kind: "same_day_after", min_gap_minutes: 0 },
      ],
    },
    {
      key: "infusion",
      kind: "infusion",
      code_as_written: "Infusion per provider plan, if signed off",
      station_id: "infusion",
      duration_min: 120,
      depends_on: [{ key: "visit", kind: "same_day_after", min_gap_minutes: 35 }],
    },
  ],
  follow_up: [
    {
      key: "labs",
      kind: "lab",
      code_as_written: "CBC w/ diff, CMP (repeat in 3 weeks)",
      station_id: "lab_draw",
      duration_min: 10,
      depends_on: [],
    },
    {
      key: "visit",
      kind: "visit",
      code_as_written: "Follow-up visit, medical oncology",
      station_id: "clinic_2a",
      duration_min: 20,
      depends_on: [{ key: "labs", kind: "resulted_before", min_gap_minutes: 48 * 60 }],
    },
  ],
};

/** Synthetic payer rules (spec 10.1): which codes need authorization, delay, approval rate. */
export const PAYER_RULES = {
  payer: ORGS.payer,
  plan_id: "LHP-GOLD-PPO",
  specialist_copay_cents: 4000,
  auth_required_codes: [
    "CT chest/abdomen/pelvis with contrast",
    "Infusion per provider plan, if signed off",
  ],
  decision_delay_days: 2,
  approval_rate: 0.9,
  denial_reason: "Additional clinical documentation requested by the plan.",
} as const;

/** Deterministic payer decision for a packet id. */
export function payerDecision(seed: number, packetId: string): "approved" | "denied" {
  return streamFor(seed, `payer:${packetId}`).chance(PAYER_RULES.approval_rate)
    ? "approved"
    : "denied";
}

/** Result turnaround in the simulated LIS (spec 10.1). Events carry order id and status only. */
export const LIS_TURNAROUND_MIN: Record<string, number> = {
  "CBC w/ diff": 45,
  CMP: 60,
  "CT chest/abdomen/pelvis with contrast": 90,
};
