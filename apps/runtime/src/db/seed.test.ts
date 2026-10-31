import { describe, expect, it } from "vitest";
import { count, eq } from "drizzle-orm";
import { openDatabase, schema } from "./index";
import { seedDatabase } from "./seed";

describe("pnpm seed", () => {
  it("writes the synthetic world and is repeatable", () => {
    const { sqlite, db } = openDatabase(":memory:");
    const first = seedDatabase(sqlite, 1104);
    const second = seedDatabase(sqlite, 1104);
    expect(second).toEqual(first);
    expect(first.patients).toBe(200);
    expect(db.select({ n: count() }).from(schema.slots).get()?.n).toBe(first.slots);
    const maria = db.select().from(schema.patients).where(eq(schema.patients.id, "pt-001")).get();
    expect(maria).toMatchObject({ display_name: "Maria Diaz", language: "es", synthetic: true });
  });

  it("refuses non-synthetic rows at the database level", () => {
    const { sqlite } = openDatabase(":memory:");
    expect(() =>
      sqlite.prepare("INSERT INTO providers VALUES ('x', 'X', 'clinic_2a', 20, 0)").run(),
    ).toThrow();
  });
});
