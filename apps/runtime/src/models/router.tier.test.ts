import { describe, expect, it } from "vitest";
import type { Capability } from "@throughline/shared";
import { routeModelCall, withTierFallback, type Tier } from "./router";

/** 40 payloads (spec 12.1 test 12): 20 carry identifiers or free text, 20 are operational. */
const PRIVATE: [string, Capability][] = [
  ["Patient DOB 1955-03-08, referral for consult", "patient.message"],
  ["Call back at +1 555 0101", "patient.message"],
  ["MRN: HMC-004211 needs CT", "schedule.plan"],
  ["Member ID: LHP-883201 copay check", "eligibility.check"],
  ["Lives at 1420 Cedar Street, ride needed", "logistics.checkin"],
  ["email maria.diaz@example.com about prep", "message.send"],
  ["DOB 03/08/1955", "directions.send"],
  ["subscriber # 99812 plan gold", "followup.book"],
  ["data:image/png;base64,iVBOR...", "patient.locate"],
  ["(555) 010-0199 left a voicemail", "patient.message"],
  ["anything at all", "referral.extract"],
  ["anything at all", "reply.handle"],
  ["anything at all", "summary.draft"],
  ["anything at all", "referral.clarify"],
  ["anything at all", "prior_auth.draft"],
  ["Sí, confirmo. Pero mi esposo no puede venir", "reply.handle"],
  ["Referral text from Northgate with DOB 1960-01-02", "referral.extract"],
  ["Reach her at 555.010.0142", "noshow.score"],
  ["Address 88 Elm Ave, apartment 2", "followup.book"],
  ["MRN 7781 lab draw", "itinerary.plan"],
];
const CLOUD: [string, Capability][] = [
  ['{"station_id":"imaging_ct","count":6}', "queue.estimate"],
  ["CT 1 down until 10:25; imaging wait 22 min", "ops_action.propose"],
  ["Sign text: Elevator A, Level 2", "patient.locate"],
  ["Directions from Lab Draw to Gold Zone", "directions.send"],
  ["Next stop CT 2, 3 people ahead, 12 minutes", "patient.message"],
  ["bottleneck at lab_draw, 3 samples above 20 min", "bottleneck.detect"],
  ["Explain: labs Nov 14 so results are back 48 h before Nov 17", "schedule.plan"],
  ["Prep card for the infusion lounge", "prep.compose"],
  ["what-if: open second phlebotomy chair", "ops_action.propose"],
  ["Wait estimate 9 minutes at vitals", "queue.estimate"],
  ["itinerary: CT, labs, vitals, clinic, infusion", "itinerary.plan"],
  ["Divert 3 patients to CT 2", "ops_action.apply"],
  ["Follow-up visit in 3 weeks with repeat labs", "followup.book"],
  ["Waitlist slot Nov 18 09:30 at CT", "waitlist.offer"],
  ["Closure report: 4 services completed, 0 pending", "referral.close"],
  ["Lost patient: no check-in at CT 2 for 14 min", "patient.message"],
  ["Teach-back question 2 of 3", "teachback.run"],
  ["Result ready for order o-cbc", "result.watch"],
  ["Ack overdue for order o-ct after 48 h", "result_ack.track"],
  ["Volunteer to the main lobby", "ops_action.propose"],
];

describe("PHI tier router (test 12)", () => {
  it.each(PRIVATE)("private: %s (%s)", (probe, capability) => {
    expect(routeModelCall(probe, capability, "auto")).toBe("private");
  });

  it.each(CLOUD)("cloud: %s (%s)", (probe, capability) => {
    expect(routeModelCall(probe, capability, "auto")).toBe("cloud");
  });

  it("TIER_MODE overrides the classifier", () => {
    expect(routeModelCall("DOB 1955-03-08", "reply.handle", "cloud_only")).toBe("cloud");
    expect(routeModelCall("queue count 6", "queue.estimate", "private_only")).toBe("private");
  });

  it("falls back to cloud when the private tier times out, and says so", async () => {
    const tiers: Tier[] = [];
    const result = await withTierFallback(
      "private",
      (tier) => {
        tiers.push(tier);
        return tier === "private" ? new Promise<string>(() => undefined) : Promise.resolve("ok");
      },
      20,
    );
    expect(result).toEqual({ value: "ok", tier: "cloud", used_fallback: true });
    expect(tiers).toEqual(["private", "cloud"]);
  });
});
