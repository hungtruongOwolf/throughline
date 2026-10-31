import { Journey, type Patient } from "@throughline/shared";
import type { StationState } from "./agent";
import type { StationId } from "@throughline/shared";

/** A new journey in REFERRAL_RECEIVED, before intake has run. */
export function createJourney(input: {
  id: string;
  patient: Patient;
  referring_provider: string;
  service_requested: string;
  now: string;
}): Journey {
  return Journey.parse({
    id: input.id,
    synthetic: true,
    patient: input.patient,
    referral: {
      received_at: input.now,
      referring_provider: input.referring_provider,
      service_requested: input.service_requested,
      documents: [],
      as_written: {},
    },
    orders: [],
    auth_packets: [],
    appointments: [],
    visit_days: [],
    outreach_log: [],
    phase: "PRE",
    state: "REFERRAL_RECEIVED",
    lost: false,
    handoff_open: false,
    paused_for_review: false,
    kpis: {},
    memory: { preferred_language: input.patient.language, mobility: input.patient.mobility },
    created_at: input.now,
    updated_at: input.now,
    version: 0,
  });
}

export function createStation(id: StationId): StationState {
  return { id, synthetic: true, ops_actions: [], paused_for_review: false, version: 0 };
}
