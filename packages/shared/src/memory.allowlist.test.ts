import { describe, expect, it } from "vitest";
import { Memory, MemoryUpdate } from "./memory";

describe("memory allowlist (test 8)", () => {
  it("accepts allowlisted keys with administrative values", () => {
    const r = Memory.safeParse({
      mobility: "wheelchair",
      companion_present: "false",
      preferred_language: "es",
    });
    expect(r.success).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(Memory.safeParse({ diagnosis: "C34.90" }).success).toBe(false);
    expect(Memory.safeParse({ medications: "ibuprofen" }).success).toBe(false);
  });

  it("rejects free text, symptom, medication, and document text in allowed keys", () => {
    expect(Memory.safeParse({ mobility: "uses a wheelchair since her fall" }).success).toBe(false);
    expect(Memory.safeParse({ transport_need: "chest pain, needs ambulance" }).success).toBe(false);
    expect(Memory.safeParse({ preferred_entrance: "take 200 mg ibuprofen" }).success).toBe(false);
    expect(MemoryUpdate.safeParse({ key: "mobility", value: "me duele el pecho" }).success).toBe(
      false,
    );
  });

  it("validates single updates", () => {
    expect(MemoryUpdate.safeParse({ key: "mobility", value: "wheelchair" }).success).toBe(true);
    expect(MemoryUpdate.safeParse({ key: "symptoms", value: "none" }).success).toBe(false);
  });
});
