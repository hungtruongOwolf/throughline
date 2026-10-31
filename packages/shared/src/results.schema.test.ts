import { describe, expect, it } from "vitest";
import { EVENT_PAYLOADS } from "./events";
import { Order } from "./journey/types";
import { nextState } from "./journey/transitions";

describe("results are status only (schema half of test 10)", () => {
  it("result events reject any value field", () => {
    expect(EVENT_PAYLOADS.ResultReady.safeParse({ order_id: "o1" }).success).toBe(true);
    expect(EVENT_PAYLOADS.ResultReady.safeParse({ order_id: "o1", value: 4.2 }).success).toBe(
      false,
    );
    expect(
      EVENT_PAYLOADS.ResultAcknowledged.safeParse({ order_id: "o1", by: "dr", flag: "H" }).success,
    ).toBe(false);
  });

  it("orders have no result value field", () => {
    expect(Object.keys(Order.shape)).not.toContain("value");
    expect(Object.keys(Order.shape)).not.toContain("result_value");
  });
});

describe("transition table", () => {
  it("walks the happy path", () => {
    expect(nextState("ELIGIBILITY_CHECKED", "AppointmentsBooked")).toBe("SCHEDULED");
    expect(nextState("ACTIVE", "VisitCheckedOut")).toBe("CHECKED_OUT");
    expect(nextState("RESULTS_ACKNOWLEDGED", "ReferralClosed")).toBe("REFERRAL_CLOSED");
  });

  it("detail events and soft events do not move the state", () => {
    expect(nextState("ACTIVE", "QueueStateUpdated")).toBeUndefined();
    expect(nextState("ACTIVE", "ResultAcknowledged")).toBeUndefined();
  });

  it("rejects illegal and post-terminal transitions", () => {
    expect(() => nextState("REFERRAL_RECEIVED", "VisitCheckedOut")).toThrow();
    expect(() => nextState("REFERRAL_CLOSED", "SummarySent")).toThrow();
  });
});
