import { campus, type Station } from "@throughline/hospital";
import type { StationId } from "@throughline/shared";
import { streamFor } from "./rng";

export interface Slot {
  station_id: StationId;
  /** Local date and time, e.g. 2026-11-17 and 09:30. Campus offset is fixed at -06:00 in Nov. */
  date: string;
  time: string;
  capacity: number;
  booked: number;
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SLOT_MIN = 15;

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function hhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function hoursOn(station: Station, date: Date): { open: number; close: number } | undefined {
  const day = WEEKDAYS[date.getUTCDay()] as (typeof WEEKDAYS)[number];
  if ((station.hours.days as readonly string[]).includes(day)) {
    return { open: minutes(station.hours.open), close: minutes(station.hours.close) };
  }
  if (day === "sat" && station.hours.saturday) {
    return {
      open: minutes(station.hours.saturday.open),
      close: minutes(station.hours.saturday.close),
    };
  }
  return undefined;
}

/**
 * New-patient holds: slots a clinic keeps open for new oncology patients, as real clinics do.
 * Maria's first visit day (Nov 17) is built from these, so the referral flow books the same
 * morning the visit-day scenario plays (CT on CT 1 just after the 09:40 outage).
 */
export const NEW_PATIENT_HOLDS: {
  station_id: StationId;
  date: string;
  times: string[];
  /** Taken by another patient instead of held open. */
  full?: true;
}[] = [
  { station_id: "imaging_ct", date: "2026-11-17", times: ["09:30", "09:45"], full: true },
  { station_id: "imaging_ct", date: "2026-11-17", times: ["10:00", "10:15"] },
  { station_id: "vitals", date: "2026-11-17", times: ["10:30", "10:45"] },
  { station_id: "clinic_2a", date: "2026-11-17", times: ["11:00", "11:15"] },
];

/**
 * Station calendars: 15-minute slots for `days` days from `start`, capacity = servers,
 * 70–85% pre-booked so the scheduler has to search (spec 10.1).
 */
export function generateSlots(seed: number, start = "2026-11-10", days = 30): Slot[] {
  const rng = streamFor(seed, "slots");
  const slots: Slot[] = [];
  const first = new Date(`${start}T00:00:00Z`);
  for (let d = 0; d < days; d++) {
    const date = new Date(first.getTime() + d * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    for (const station of campus.stations) {
      const hours = hoursOn(station, date);
      if (!hours) continue;
      const fill = 0.7 + rng.next() * 0.15;
      for (let t = hours.open; t + SLOT_MIN <= hours.close; t += SLOT_MIN) {
        let booked = 0;
        for (let s = 0; s < station.servers; s++) if (rng.chance(fill)) booked++;
        const hold = NEW_PATIENT_HOLDS.find(
          (h) => h.station_id === station.id && h.date === iso && h.times.includes(hhmm(t)),
        );
        if (hold) booked = hold.full ? station.servers : 0;
        slots.push({
          station_id: station.id,
          date: iso,
          time: hhmm(t),
          capacity: station.servers,
          booked,
        });
      }
    }
  }
  return slots;
}
