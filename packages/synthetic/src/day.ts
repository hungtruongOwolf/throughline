import type { StationId } from "@throughline/shared";
import { generatePatients, type SyntheticPatient } from "./people";
import { streamFor } from "./rng";

/** Visit patterns for the simulated day, with weights. Clinic pods alternate per patient. */
const PATTERNS: { weight: number; stops: (StationId | "clinic")[] }[] = [
  { weight: 32, stops: ["registration", "lab_draw"] },
  { weight: 25, stops: ["registration", "lab_draw", "vitals", "clinic"] },
  { weight: 13, stops: ["registration", "imaging_ct"] },
  { weight: 8, stops: ["registration", "imaging_xray"] },
  { weight: 12, stops: ["registration", "lab_draw", "vitals", "clinic", "infusion"] },
  { weight: 10, stops: ["registration", "pharmacy"] },
];

const ENTRANCES = ["mp1.entrance", "mp1.entrance", "mp1.entrance", "g2.parking"] as const;

export interface DayPatient {
  id: string;
  arrive: string;
  entrance: string;
  mobility: SyntheticPatient["mobility"];
  stops: { station_id: StationId; node_id?: string }[];
}

export interface VisitDay {
  synthetic: true;
  seed: number;
  start: string;
  end: string;
  patients: DayPatient[];
  disruptions: { station_id: StationId; from: string; to: string; servers_down: number }[];
}

function clock(date: string, minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(Math.floor(minutes % 60)).padStart(2, "0");
  return `${date}T${h}:${m}:00-06:00`;
}

/**
 * The simulated visit day (spec 10.2, `fixtures/day-2026-11-17.json`): 200 patients arriving
 * 07:00–14:30, mostly in the morning, and the scripted CT 1 outage 09:40–10:25. Stop orders
 * follow the visit pattern; Maria's own day is planned by the itinerary solver separately.
 */
export function generateVisitDay(seed: number, date = "2026-11-17"): VisitDay {
  const rng = streamFor(seed, `day:${date}`);
  const total = PATTERNS.reduce((n, p) => n + p.weight, 0);
  const patients = generatePatients(seed).map((p, i): DayPatient => {
    let roll = rng.next() * total;
    const pattern =
      PATTERNS.find((x) => (roll -= x.weight) < 0) ?? (PATTERNS[0] as (typeof PATTERNS)[number]);
    // Walk-in style stops arrive morning-heavy (mirrored max of two uniforms); CT runs on
    // booked slots, so CT patients arrive evenly 07:30-14:30.
    const u = 1 - Math.max(rng.next(), rng.next());
    const booked = pattern.stops.includes("imaging_ct");
    const arrive = booked ? 7.5 * 60 + rng.next() * 7 * 60 : 7 * 60 + u * 7.5 * 60;
    return {
      id: p.id,
      arrive: clock(date, arrive),
      entrance: rng.pick(ENTRANCES),
      mobility: p.mobility,
      stops: pattern.stops.map((s) =>
        s === "clinic"
          ? { station_id: i % 2 === 0 ? "clinic_2a" : "clinic_2b" }
          : { station_id: s },
      ),
    };
  });
  return {
    synthetic: true,
    seed,
    start: clock(date, 7 * 60),
    end: clock(date, 17 * 60),
    patients,
    disruptions: [
      {
        station_id: "imaging_ct",
        from: clock(date, 9 * 60 + 40),
        to: clock(date, 10 * 60 + 25),
        servers_down: 1,
      },
    ],
  };
}
