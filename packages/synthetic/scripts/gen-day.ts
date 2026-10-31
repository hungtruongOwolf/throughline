// Writes fixtures/day-2026-11-17.json (spec 10.2) from the seeded generator.
import { writeFileSync } from "node:fs";
import { DEFAULT_SEED, generateVisitDay } from "../src/index";

const day = generateVisitDay(Number(process.env.SEED ?? DEFAULT_SEED));
const out = new URL("../../../fixtures/day-2026-11-17.json", import.meta.url);
writeFileSync(out, JSON.stringify(day, null, 2) + "\n");
console.log(`wrote ${day.patients.length} patients and ${day.disruptions.length} disruption(s)`);
