import type Database from "better-sqlite3";
import { generateWorld } from "@throughline/synthetic";

/** Replaces all seeded reference data with the world generated from `seed`. */
export function seedDatabase(sqlite: Database.Database, seed: number) {
  const world = generateWorld(seed);
  const insert = sqlite.transaction(() => {
    sqlite.exec("DELETE FROM patients; DELETE FROM providers; DELETE FROM slots;");
    const p = sqlite.prepare(
      "INSERT INTO patients VALUES (@id, @display_name, @dob, @language, @mobility, @phone_sim, @distance_band, @prior_noshows, 1)",
    );
    for (const row of world.patients) p.run(row);
    const d = sqlite.prepare(
      "INSERT INTO providers VALUES (@id, @display_name, @station_id, @slot_minutes, 1)",
    );
    for (const row of world.providers) d.run(row);
    const s = sqlite.prepare(
      "INSERT INTO slots VALUES (@station_id, @date, @time, @capacity, @booked)",
    );
    for (const row of world.slots) s.run(row);
    sqlite.prepare("INSERT OR REPLACE INTO meta VALUES ('seed', ?)").run(String(seed));
  });
  insert();
  return {
    patients: world.patients.length,
    providers: world.providers.length,
    slots: world.slots.length,
  };
}
