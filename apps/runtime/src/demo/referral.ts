import type { DocumentRef, Journey } from "@throughline/shared";
import { MARIA, ORGS } from "@throughline/synthetic";
import type { SimBackground } from "../board";
import type { SimClock } from "../bus/sim-clock";
import type { RuntimeStore } from "../bus/store";
import { createJourney } from "../core/journeys";
import type { Runtime } from "../core/runtime";
import { MARIA_JOURNEY_ID } from "./visit-day";

/** The fax lands Nov 10 at 08:04; intake starts a minute later (spec 10.3). */
export const REFERRAL_AT = "2026-11-10T08:05:00-06:00";

export const MARIA_DOCUMENTS: DocumentRef[] = [
  {
    id: "doc-referral",
    kind: "referral_fax",
    uri: "/api/documents/maria-referral-fax.png",
    mime: "image/png",
  },
  {
    id: "doc-card",
    kind: "insurance_card",
    uri: "/api/documents/maria-insurance-card.png",
    mime: "image/png",
  },
];

/**
 * Maria's referral arrives (spec 10.3, PRE): resets the runtime and the sim clock, opens the
 * journey from the fax's sender line, and publishes ReferralReceived. The agents do the rest.
 */
export async function seedReferral(ctx: {
  runtime: Runtime;
  store: RuntimeStore;
  clock: SimClock;
  background: SimBackground;
}): Promise<Journey> {
  const { runtime, store, clock, background } = ctx;
  store.reset();
  background.reset();
  clock.reset(REFERRAL_AT);
  const base = createJourney({
    id: MARIA_JOURNEY_ID,
    patient: MARIA,
    referring_provider: ORGS.referring_clinic,
    service_requested: "Referral received by fax",
    now: clock.now(),
  });
  runtime.saveJourney({ ...base, referral: { ...base.referral, documents: MARIA_DOCUMENTS } });
  await runtime.ingest({
    type: "ReferralReceived",
    journey_id: MARIA_JOURNEY_ID,
    payload: { documents: MARIA_DOCUMENTS },
  });
  return runtime.journey(MARIA_JOURNEY_ID) as Journey;
}
