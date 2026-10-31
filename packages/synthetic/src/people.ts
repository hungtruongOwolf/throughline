import type { Language, Mobility } from "@throughline/shared";
import { streamFor, type Rng } from "./rng";

/**
 * Curated name lists rather than a faker library, so nothing accidentally real-looking slips
 * in (spec 10.1). Combinations are random; any resemblance to a real person is coincidental.
 */
const FIRST_EN = [
  "Avery",
  "Blake",
  "Carmen",
  "Dana",
  "Elliot",
  "Frances",
  "Gordon",
  "Harriet",
  "Irene",
  "Jonah",
  "Kendall",
  "Lorraine",
  "Marcus",
  "Noreen",
  "Otis",
  "Priya",
  "Quentin",
  "Rosalind",
  "Stanley",
  "Theresa",
  "Ulysses",
  "Vivian",
  "Walter",
  "Yvonne",
  "Zachary",
  "Beatrice",
  "Clifford",
  "Delia",
  "Everett",
  "Gladys",
] as const;
const FIRST_ES = [
  "Alma",
  "Benito",
  "Consuelo",
  "Domingo",
  "Esperanza",
  "Fausto",
  "Graciela",
  "Horacio",
  "Inés",
  "Jacinto",
  "Lucía",
  "Mateo",
  "Nieves",
  "Octavio",
  "Paloma",
  "Ramiro",
  "Soledad",
  "Tomás",
  "Valentina",
  "Ximena",
] as const;
const LAST = [
  "Abernathy",
  "Bellamy",
  "Castellano",
  "Dunmore",
  "Escobedo",
  "Fairweather",
  "Galindo",
  "Hargrove",
  "Ibarra",
  "Jessup",
  "Kessler",
  "Linwood",
  "Montoya",
  "Northcott",
  "Olvera",
  "Pemberton",
  "Quintero",
  "Rutledge",
  "Salcedo",
  "Thornbury",
  "Urrutia",
  "Vance",
  "Whitlock",
  "Yarbrough",
  "Zamora",
  "Ashworth",
  "Bustamante",
  "Calloway",
  "Delacroix",
  "Espinoza",
] as const;

export interface SyntheticPatient {
  id: string;
  synthetic: true;
  display_name: string;
  dob: string;
  language: Language;
  mobility: Mobility;
  phone_sim: string;
  distance_band: "near" | "mid" | "far";
  prior_noshows: number;
}

/** Maria Diaz, synthetic patient 001 (spec 10.3). Wheelchair comes later, from her voice reply. */
export const MARIA: SyntheticPatient = {
  id: "pt-001",
  synthetic: true,
  display_name: "Maria Diaz",
  dob: "1955-03-08",
  language: "en",
  mobility: "walking",
  phone_sim: "+1 555 0101",
  distance_band: "mid",
  prior_noshows: 0,
};

function dob(rng: Rng): string {
  const y = rng.int(1940, 1995);
  const m = rng.int(1, 12);
  const d = rng.int(1, 28);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** 200 patients for the simulated day: 80% en / 20% es, 10% wheelchair, fictional phones. */
export function generatePatients(seed: number, count = 200): SyntheticPatient[] {
  const rng = streamFor(seed, "patients");
  const patients: SyntheticPatient[] = [MARIA];
  for (let i = 2; i <= count; i++) {
    const language: Language = rng.chance(0.2) ? "es" : "en";
    const first = language === "es" ? rng.pick(FIRST_ES) : rng.pick(FIRST_EN);
    patients.push({
      id: `pt-${String(i).padStart(3, "0")}`,
      synthetic: true,
      display_name: `${first} ${rng.pick(LAST)}`,
      dob: dob(rng),
      language,
      mobility: rng.chance(0.1) ? "wheelchair" : "walking",
      // Reserved fictional range +1 555 0101..0199; 0100 is the clinic line.
      phone_sim: `+1 555 01${String(((i - 1) % 99) + 1).padStart(2, "0")}`,
      distance_band: rng.pick(["near", "mid", "mid", "far"] as const),
      prior_noshows: rng.chance(0.15) ? rng.int(1, 3) : 0,
    });
  }
  return patients;
}

export interface SyntheticProvider {
  id: string;
  synthetic: true;
  display_name: string;
  station_id: "clinic_2a" | "clinic_2b";
  slot_minutes: 20;
}

/** Eight fictional oncologists, four per pod, 20-minute templates (spec 10.1). */
export function generateProviders(): SyntheticProvider[] {
  const names = [
    "Okafor",
    "Lindqvist",
    "Reyes",
    "Patel",
    "Nakamura",
    "Brennan",
    "Adeyemi",
    "Kowalski",
  ];
  return names.map((name, i) => ({
    id: `dr-${name.toLowerCase()}`,
    synthetic: true,
    display_name: `Dr. ${name}`,
    station_id: i < 4 ? "clinic_2a" : "clinic_2b",
    slot_minutes: 20,
  }));
}

/**
 * Days and hours each patient can come in, by patient id (synthetic; spec 10.3: Maria's
 * daughter drives her, so mornings and the days the daughter is free). Patients not listed
 * have no constraint.
 */
export const PATIENT_AVAILABILITY: Record<string, { date: string; from: string; to: string }[]> = {
  // Her daughter drives her after the school run, so from 9:00 on the days she is free.
  "pt-001": [
    { date: "2026-11-17", from: "09:00", to: "16:30" },
    { date: "2026-11-18", from: "09:00", to: "16:30" },
    { date: "2026-11-20", from: "09:00", to: "16:30" },
    { date: "2026-11-24", from: "09:00", to: "16:30" },
    // Follow-up weeks.
    { date: "2026-12-07", from: "09:00", to: "16:30" },
    { date: "2026-12-08", from: "09:00", to: "16:30" },
    { date: "2026-12-09", from: "09:00", to: "16:30" },
  ],
};
