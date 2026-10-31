import { describe, expect, it } from "vitest";
import { en, es, PATIENT_SURFACE_PREFIXES, t } from "./index";

const isPatient = (key: string) => PATIENT_SURFACE_PREFIXES.some((p) => key.startsWith(p));

describe("copy parity (test 14)", () => {
  it("en and es have the same keys", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it("no empty strings", () => {
    for (const table of [en, es]) {
      for (const [key, value] of Object.entries(table)) expect(value.trim(), key).not.toBe("");
    }
  });

  it("patient-surface strings have no arrow, middle dot, or exclamation mark", () => {
    for (const table of [en, es] as Record<string, string>[]) {
      for (const [key, value] of Object.entries(table)) {
        if (!isPatient(key)) continue;
        expect(value, key).not.toMatch(/[→·!¡]/);
      }
    }
  });

  it("placeholders match between languages", () => {
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(vars(es[key]), key).toEqual(vars(en[key]));
    }
  });

  it("t fills placeholders", () => {
    expect(t("en", "patient.people_ahead", { count: 3 })).toBe("3 people ahead");
    expect(t("es", "patient.about_minutes", { minutes: 12 })).toBe("unos 12 minutos");
  });
});
