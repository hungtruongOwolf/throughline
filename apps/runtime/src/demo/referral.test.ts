import { describe, expect, it } from "vitest";
// Printed on the card (packages/synthetic/src/documents.ts); the fax hides the suffix.
const MARIA_MEMBER_ID = "LHP-883201-02";
import type { DomainEvent, HumanReview, Journey } from "@throughline/shared";
import { createApp } from "../app";
import { createContext } from "../context";

const json = (body: unknown) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("pre-visit agents (D3-2)", () => {
  it("takes Maria's referral to a confirmed visit: one clarification, one held auth, one reply", async () => {
    // No model key: every model agent runs its deterministic fallback, no provider call.
    const ctx = createContext({}, { databasePath: ":memory:" });
    const app = createApp(ctx);
    const types = async () =>
      (
        (await (await app.request("/api/journeys/maria-001/events")).json()) as {
          event: DomainEvent;
        }[]
      ).map((e) => e.event.type);

    let journey = (await (await app.request("/api/demo/referral", json({}))).json()) as Journey;
    expect(journey.state).toBe("CLARIFICATION_NEEDED");

    // The fax hides the member id suffix; the coordinator reads it off the card.
    journey = (await (
      await app.request(
        "/api/journeys/maria-001/clarify",
        json({ field: "member_id", value: MARIA_MEMBER_ID, by: "coordinator" }),
      )
    ).json()) as Journey;
    expect(journey.state).toBe("AUTH_DRAFTED");
    expect(journey.paused_for_review).toBe(true);
    expect(journey.referral.as_written).toEqual({
      diagnosis_code: "C34.90",
      urgency: "Routine, within 2 weeks",
    });
    expect(journey.coverage?.auth_required_order_ids).toEqual(["o-ct", "o-infusion"]);
    expect(journey.auth_packets[0]?.status).toBe("draft");

    const reviews = (await (await app.request("/api/reviews")).json()) as HumanReview[];
    const held = reviews.filter((r) => r.status === "pending");
    expect(held).toHaveLength(1);
    expect(held[0]?.capability).toBe("prior_auth.submit");
    await app.request(
      `/api/reviews/${held[0]?.id}/resolve`,
      json({ decision: "approved", by: "coordinator" }),
    );
    await ctx.bus.idle();
    expect(ctx.runtime.journey("maria-001")?.state).toBe("AUTH_SUBMITTED");

    // The payer decides two sim days later; scheduling, booking, and prep follow.
    await ctx.clock.advanceBy(2 * 24 * 60 + 5);
    await ctx.bus.idle();
    journey = ctx.runtime.journey("maria-001") as Journey;
    expect(journey.auth_packets[0]?.status).toBe("approved");
    expect(journey.state).toBe("PREP_SENT");
    expect(journey.visit_days.length).toBeGreaterThan(0);
    expect(journey.appointments.every((a) => a.status === "booked")).toBe(true);
    expect(journey.prep_plan?.fasting_window_as_written).toBe(
      "Nothing to eat or drink except water for 8 hours before the blood draw.",
    );
    const out = journey.outreach_log.filter((m) => m.direction === "out");
    expect(out[0]?.disclaimer).toBe(true);
    expect(out.every((m) => m.language === "es")).toBe(true);

    journey = (await (
      await app.request(
        "/api/journeys/maria-001/reply",
        json({
          text: "Sí, confirmo. Pero mi esposo no puede venir, voy a necesitar una silla de ruedas.",
        }),
      )
    ).json()) as Journey;
    expect(journey.state).toBe("CONFIRMED");
    expect(journey.memory).toMatchObject({ mobility: "wheelchair", companion_present: "false" });
    expect(journey.patient.mobility).toBe("wheelchair");

    const log = await types();
    for (const t of [
      "ReferralReceived",
      "ClarificationNeeded",
      "ClarificationAnswered",
      "IntakeExtracted",
      "EligibilityChecked",
      "PriorAuthDrafted",
      "PriorAuthSubmitted",
      "PriorAuthDecided",
      "AppointmentsProposed",
      "AppointmentsBooked",
      "PrepPlanSent",
      "PatientReplied",
      "ReplyHandled",
      "VisitConfirmed",
      "NoShowRiskScored",
    ]) {
      expect(log).toContain(t);
    }
    expect(log.filter((t) => t === "ClarificationNeeded")).toHaveLength(1);
    expect(ctx.clock.pending().some((p) => p.label.startsWith("reminder:maria-001"))).toBe(true);
  });

  it("serves the documents but not the ground truth", async () => {
    const app = createApp(createContext({}, { databasePath: ":memory:" }));
    const fax = await app.request("/api/documents/maria-referral-fax.png");
    expect(fax.status).toBe(200);
    expect(fax.headers.get("content-type")).toBe("image/png");
    expect((await app.request("/api/documents/maria-truth.json")).status).toBe(404);
  });
});
