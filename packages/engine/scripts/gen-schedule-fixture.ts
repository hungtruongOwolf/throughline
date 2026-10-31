// Builds Maria's scheduling request from the seeded slot calendars (spec 10.3: the scheduler
// runs on Nov 12 after the authorization decision) and snapshots the engine's plan as a
// reviewed golden. Run: pnpm --filter @throughline/engine gen:fixtures
import { writeFileSync } from "node:fs";
import type { ScheduleRequest, StationId } from "@throughline/shared";
import { DEFAULT_SEED, generateSlots } from "@throughline/synthetic";
import { loadEngine } from "../src-ts/node";

const STATIONS: StationId[] = ["lab_draw", "imaging_ct", "vitals", "clinic_2a", "infusion"];
const window = (date: string, from: string, to: string) => ({
  start: `${date}T${from}:00-06:00`,
  end: `${date}T${to}:00-06:00`,
});

const slots = generateSlots(DEFAULT_SEED, "2026-11-10", 30).filter(
  (s) => STATIONS.includes(s.station_id) && s.date >= "2026-11-12" && s.date <= "2026-11-30",
);
const calendars = STATIONS.map((station_id) => ({
  station_id,
  slots: slots
    .filter((s) => s.station_id === station_id && s.capacity > s.booked)
    .map((s) => ({ start: `${s.date}T${s.time}:00-06:00`, capacity: s.capacity - s.booked })),
}));

export const MARIA_SCHEDULE: ScheduleRequest = {
  orders: [
    { order_id: "o-labs", station_id: "lab_draw", duration_min: 10, label: "Labs" },
    {
      order_id: "o-ct",
      station_id: "imaging_ct",
      duration_min: 25,
      label: "CT",
      not_before: "2026-11-12T09:00:00-06:00",
    },
    { order_id: "o-vitals", station_id: "vitals", duration_min: 5, label: "Vitals" },
    {
      order_id: "o-visit",
      station_id: "clinic_2a",
      duration_min: 20,
      label: "clinic visit with Dr. Okafor",
    },
    { order_id: "o-infusion", station_id: "infusion", duration_min: 120, label: "Infusion" },
  ],
  dependencies: [
    { order: "o-visit", after: "o-labs", kind: "resulted_before", min_gap_min: 48 * 60 },
    { order: "o-visit", after: "o-ct", kind: "same_day_after", min_gap_min: 30 },
    { order: "o-visit", after: "o-vitals", kind: "same_day_after", min_gap_min: 0 },
    { order: "o-infusion", after: "o-visit", kind: "same_day_after", min_gap_min: 35 },
  ],
  calendars,
  // From memory: mornings, and the days her daughter can drive (synthetic).
  availability: [
    window("2026-11-14", "07:00", "12:00"),
    window("2026-11-17", "07:00", "16:30"),
    window("2026-11-18", "07:00", "16:30"),
    window("2026-11-20", "07:00", "16:30"),
    window("2026-11-24", "07:00", "16:30"),
  ],
  preferences: { time_of_day: "morning" },
  earliest: "2026-11-12T09:00:00-06:00",
  latest: "2026-11-30T18:00:00-06:00",
};

const engine = loadEngine();
const result = engine.schedule(MARIA_SCHEDULE);
writeFileSync(
  new URL("../fixtures/schedule.json", import.meta.url),
  JSON.stringify(
    {
      source:
        "reviewed engine snapshot (scripts/gen-schedule-fixture.ts); slots from the seeded calendars",
      cases: [
        {
          name: "Maria, scheduled on Nov 12",
          fn: "schedule",
          request: MARIA_SCHEDULE,
          expected: result,
        },
      ],
    },
    null,
    1,
  ) + "\n",
);
for (const plan of [result.primary, result.alternative]) {
  if (!plan) continue;
  console.log(plan.visit_days.join(" / "), "span", plan.span_days);
  for (const a of plan.appointments)
    console.log(`  ${a.start.slice(5, 16)}-${a.end.slice(11, 16)} ${a.order_id}`);
  for (const f of plan.facts) console.log(`  - ${f}`);
}
