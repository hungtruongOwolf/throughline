import { describe, expect, it } from "vitest";
import { Patient } from "@throughline/shared";
import {
  DEFAULT_SEED,
  generatePatients,
  generateProviders,
  generateSlots,
  generateWorld,
  MARIA,
  ORDER_TEMPLATES,
  payerDecision,
} from "./index";

describe("synthetic world (D1-7)", () => {
  const world = generateWorld(DEFAULT_SEED);

  it("is deterministic under SEED=1104 and changes with the seed", () => {
    expect(JSON.stringify(generateWorld(DEFAULT_SEED))).toBe(JSON.stringify(world));
    expect(JSON.stringify(generatePatients(7))).not.toBe(JSON.stringify(world.patients));
  });

  it("has 200 synthetic patients with Maria first", () => {
    expect(world.patients).toHaveLength(200);
    expect(world.patients[0]).toEqual(MARIA);
    for (const p of world.patients) {
      expect(p.synthetic).toBe(true);
      expect(Patient.safeParse(p).success, p.id).toBe(true);
    }
  });

  it("matches the language, mobility, and DOB mix", () => {
    const es = world.patients.filter((p) => p.language === "es").length / 200;
    const wheelchair = world.patients.filter((p) => p.mobility === "wheelchair").length / 200;
    expect(es).toBeGreaterThan(0.12);
    expect(es).toBeLessThan(0.3);
    expect(wheelchair).toBeGreaterThan(0.04);
    expect(wheelchair).toBeLessThan(0.17);
    for (const p of world.patients) {
      const year = Number(p.dob.slice(0, 4));
      expect(year).toBeGreaterThanOrEqual(1940);
      expect(year).toBeLessThanOrEqual(1995);
    }
  });

  it("never uses the clinic line 555-0100 for a patient", () => {
    expect(world.patients.some((p) => p.phone_sim === "+1 555 0100")).toBe(false);
  });

  it("has eight providers, four per pod", () => {
    const providers = generateProviders();
    expect(providers).toHaveLength(8);
    expect(providers.filter((p) => p.station_id === "clinic_2a")).toHaveLength(4);
  });

  it("builds 30 days of 15-minute slots, 70-85% pre-booked, closed on Sundays", () => {
    const slots = generateSlots(DEFAULT_SEED);
    const days = new Set(slots.map((s) => s.date));
    expect(days.has("2026-11-15")).toBe(false); // Sunday
    expect(slots.some((s) => s.date === "2026-11-14" && s.station_id === "lab_draw")).toBe(true);
    expect(slots.some((s) => s.date === "2026-11-14" && s.station_id === "imaging_ct")).toBe(false);
    const capacity = slots.reduce((n, s) => n + s.capacity, 0);
    const booked = slots.reduce((n, s) => n + s.booked, 0);
    expect(booked / capacity).toBeGreaterThan(0.68);
    expect(booked / capacity).toBeLessThan(0.87);
    for (const s of slots) expect(s.booked).toBeLessThanOrEqual(s.capacity);
  });

  it("order templates reference their own keys", () => {
    for (const set of Object.values(ORDER_TEMPLATES)) {
      const keys = new Set(set.map((o) => o.key));
      for (const o of set) for (const d of o.depends_on) expect(keys.has(d.key), d.key).toBe(true);
    }
  });

  it("payer decisions are deterministic per packet", () => {
    expect(payerDecision(DEFAULT_SEED, "auth-maria-ct")).toBe(
      payerDecision(DEFAULT_SEED, "auth-maria-ct"),
    );
  });
});
