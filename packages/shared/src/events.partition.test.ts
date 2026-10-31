import { describe, expect, it } from "vitest";
import { DomainEvent, EVENT_TYPES, JOURNEY_EVENT_TYPES, OPS_EVENT_TYPES } from "./events";

describe("event partition (test 1)", () => {
  it("journey and ops event sets are disjoint", () => {
    const journey = new Set<string>(JOURNEY_EVENT_TYPES);
    expect(OPS_EVENT_TYPES.filter((t) => journey.has(t))).toEqual([]);
  });

  it("together they equal the catalog", () => {
    expect([...JOURNEY_EVENT_TYPES, ...OPS_EVENT_TYPES].sort()).toEqual([...EVENT_TYPES].sort());
  });

  it("journey events require journey_id and ops events require station_id", () => {
    const base = { id: "e1", occurred_at: "2026-11-17T09:46:00-06:00", synthetic: true };
    expect(DomainEvent.safeParse({ ...base, type: "VisitCheckedOut", payload: {} }).success).toBe(
      false,
    );
    expect(
      DomainEvent.safeParse({ ...base, type: "VisitCheckedOut", journey_id: "j1", payload: {} })
        .success,
    ).toBe(true);
    const bottleneck = {
      ...base,
      type: "BottleneckDetected",
      payload: { severity: "high", minutes: 22 },
    };
    expect(DomainEvent.safeParse(bottleneck).success).toBe(false);
    expect(DomainEvent.safeParse({ ...bottleneck, station_id: "imaging_ct" }).success).toBe(true);
  });
});
