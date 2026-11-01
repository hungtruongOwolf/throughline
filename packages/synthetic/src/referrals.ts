import type { SyntheticPatient } from "./people";
import { MARIA } from "./people";

/**
 * The referral book behind the staff platform (docs/PLATFORM-DESIGN.md section 6): every
 * referral Halden's oncology intake has in flight on the morning of Tue Nov 17, each with a
 * fax and an insurance card generated from it, and a plan for how far its journey has gone.
 * All people, practices, and numbers are fictional.
 */

export interface Practice {
  name: string;
  provider: string;
  address: string;
  phone: string;
  /** The fax machine's header line. */
  faxHeader: string;
}

export const PRACTICES = {
  northgate: {
    name: "Northgate Family Medicine",
    provider: "Hannah Whitcombe, MD",
    address: "88 Larch Road, Suite 2, Halden",
    phone: "(555) 010-0170",
    faxHeader: "NORTHGATE FAMILY MED (555) 010-0172",
  },
  riverside: {
    name: "Riverside Internal Medicine",
    provider: "Tomas Brandt, MD",
    address: "410 Mill Street, Halden",
    phone: "(555) 010-0180",
    faxHeader: "RIVERSIDE INT MED (555) 010-0182",
  },
  lakeview: {
    name: "Lakeview Primary Care",
    provider: "Grace Lin, MD",
    address: "12 Shore Drive, Halden",
    phone: "(555) 010-0185",
    faxHeader: "LAKEVIEW PRIMARY (555) 010-0187",
  },
} as const satisfies Record<string, Practice>;

/**
 * How far a referral's journey has gone by the morning of Nov 17. The population script plays
 * each journey through real events and stops where its plan says.
 */
export type ReferralPlan =
  | "question" // intake asked the coordinator for an unreadable field; unanswered
  | "auth_waiting" // prior auth drafted, waiting for the coordinator
  | "auth_submitted" // submitted, the payer has not answered yet
  | "unconfirmed" // booked, the patient has not replied
  | "confirmed"
  | "confirmed_wheelchair"
  | "clinical_reply" // the patient's reply was clinical: a nurse handoff is open
  | "summary_waiting" // visited; summary waits for the clinician's signature
  | "teachback_waiting" // summary sent; the patient has not answered the teach-back
  | "teachback_unclear" // answered; one answer unclear, a nurse call is open
  | "results_overdue" // the clinician has not acknowledged a result in 48 hours
  | "checkin_waiting" // day-3 check-in sent, no answer yet
  | "closed"
  | "maria";

export interface ReferralSpec {
  /** The journey id. */
  id: string;
  patient: SyntheticPatient;
  practice: Practice;
  /** When the fax arrived (Central time). */
  receivedAt: string;
  address: string;
  memberId: string;
  /** The member id's suffix is smudged on the fax. */
  smudged: boolean;
  diagnosis: string;
  urgency: string;
  plan: ReferralPlan;
  /** Which note template the treating oncologist writes after the visit. */
  oncologist: "Okafor" | "Brooks" | "Patel";
}

function patient(
  n: number,
  name: string,
  dob: string,
  mobility: "walking" | "wheelchair" = "walking",
): SyntheticPatient {
  return {
    id: `pt-${String(n).padStart(3, "0")}`,
    synthetic: true,
    display_name: name,
    dob,
    language: "en",
    mobility,
    phone_sim: `+1 555 01${String(n).padStart(2, "0")}`,
    distance_band: n % 3 === 0 ? "far" : n % 3 === 1 ? "near" : "mid",
    prior_noshows: n % 7 === 0 ? 1 : 0,
  };
}

const at = (md: string, hhmm: string) => `2026-${md}T${hhmm}:00-06:00`;

type Row = [
  id: number,
  name: string,
  dob: string,
  practice: keyof typeof PRACTICES,
  received: string,
  diagnosis: string,
  plan: ReferralPlan,
  oncologist: ReferralSpec["oncologist"],
  extra?: { smudged?: boolean; wheelchair?: boolean; urgent?: boolean },
];

const STREETS = [
  "Birch Lane",
  "Harbor Road",
  "Quarry Street",
  "Willow Court",
  "Station Avenue",
  "Orchard Way",
  "Elm Terrace",
  "Kestrel Drive",
];

// Received oldest first. Closed and after-visit referrals came in late October and early
// November, so their visits fall in the week of Nov 10; newer ones are still being booked.
const ROWS: Row[] = [
  [
    11,
    "Ruth Abernathy",
    "1949-02-14",
    "northgate",
    at("10-27", "09:12"),
    "C50.912",
    "closed",
    "Brooks",
  ],
  [12, "Leonard Pike", "1952-07-30", "riverside", at("10-27", "14:40"), "C61", "closed", "Patel"],
  [13, "Harriet Osei", "1958-11-03", "lakeview", at("10-28", "10:05"), "C18.7", "closed", "Okafor"],
  [
    14,
    "Martin Esposito",
    "1946-05-21",
    "northgate",
    at("10-28", "15:22"),
    "C34.90",
    "closed",
    "Okafor",
  ],
  [
    15,
    "Janet Lindqvist",
    "1961-09-09",
    "riverside",
    at("10-29", "08:47"),
    "C50.411",
    "closed",
    "Brooks",
  ],
  [
    16,
    "Carl Whitaker",
    "1944-12-12",
    "lakeview",
    at("10-29", "13:15"),
    "C25.9",
    "checkin_waiting",
    "Patel",
  ],
  [
    17,
    "Agnes Moreland",
    "1950-03-27",
    "northgate",
    at("10-30", "09:30"),
    "C85.90",
    "checkin_waiting",
    "Okafor",
  ],
  [
    18,
    "Victor Santos",
    "1956-08-18",
    "riverside",
    at("10-30", "11:55"),
    "C61",
    "checkin_waiting",
    "Patel",
  ],
  [
    19,
    "Eleanor Fitch",
    "1953-01-05",
    "lakeview",
    at("10-31", "10:20"),
    "C34.10",
    "teachback_unclear",
    "Okafor",
  ],
  [
    20,
    "Howard Quan",
    "1947-06-14",
    "northgate",
    at("11-02", "09:05"),
    "C18.9",
    "results_overdue",
    "Okafor",
  ],
  [
    21,
    "Doris Kettering",
    "1959-10-29",
    "riverside",
    at("11-02", "14:30"),
    "C50.912",
    "teachback_waiting",
    "Brooks",
  ],
  [
    22,
    "Raymond Achebe",
    "1951-04-08",
    "lakeview",
    at("11-03", "08:50"),
    "C34.90",
    "teachback_waiting",
    "Patel",
  ],
  [
    23,
    "Lucille Barros",
    "1962-12-19",
    "northgate",
    at("11-03", "13:10"),
    "C50.211",
    "summary_waiting",
    "Okafor",
  ],
  [
    24,
    "Samuel Okonkwo",
    "1948-02-02",
    "riverside",
    at("11-04", "10:40"),
    "C61",
    "summary_waiting",
    "Okafor",
  ],
  [
    25,
    "Ingrid Halvorsen",
    "1955-07-07",
    "lakeview",
    at("11-05", "09:25"),
    "C18.7",
    "confirmed",
    "Brooks",
  ],
  [
    26,
    "Peter Mwangi",
    "1960-05-15",
    "northgate",
    at("11-06", "11:00"),
    "C34.90",
    "confirmed",
    "Patel",
  ],
  [
    27,
    "Gloria Reinholt",
    "1943-09-23",
    "riverside",
    at("11-06", "15:35"),
    "C25.9",
    "confirmed_wheelchair",
    "Okafor",
    { wheelchair: true },
  ],
  [
    28,
    "Francis Doyle",
    "1954-11-11",
    "lakeview",
    at("11-09", "09:45"),
    "C85.90",
    "clinical_reply",
    "Brooks",
  ],
  [
    29,
    "Nadia Petrov",
    "1966-03-04",
    "northgate",
    at("11-10", "10:15"),
    "C50.912",
    "unconfirmed",
    "Patel",
  ],
  [
    30,
    "Oscar Lindgren",
    "1950-08-26",
    "riverside",
    at("11-10", "14:05"),
    "C61",
    "unconfirmed",
    "Brooks",
  ],
  [
    31,
    "Beatrice Amari",
    "1957-01-31",
    "lakeview",
    at("11-11", "08:30"),
    "C18.9",
    "confirmed",
    "Okafor",
  ],
  [
    32,
    "Walter Grimsby",
    "1945-04-17",
    "northgate",
    at("11-12", "09:50"),
    "C34.90",
    "auth_submitted",
    "Patel",
    { urgent: true },
  ],
  [
    33,
    "Mei Tanaka",
    "1963-06-02",
    "riverside",
    at("11-13", "11:20"),
    "C50.411",
    "auth_submitted",
    "Brooks",
  ],
  [
    34,
    "Desmond Reyes",
    "1952-10-10",
    "lakeview",
    at("11-13", "15:45"),
    "C61",
    "auth_submitted",
    "Patel",
  ],
  [
    35,
    "Clara Johansson",
    "1958-02-25",
    "northgate",
    at("11-16", "13:30"),
    "C18.7",
    "auth_waiting",
    "Okafor",
  ],
  [
    36,
    "Rafael Ortega",
    "1949-12-08",
    "riverside",
    at("11-17", "08:05"),
    "C34.90",
    "auth_waiting",
    "Brooks",
  ],
  [
    37,
    "Helen Abiodun",
    "1961-04-13",
    "lakeview",
    at("11-17", "08:40"),
    "C50.912",
    "auth_waiting",
    "Okafor",
  ],
  [
    38,
    "George Whitmore",
    "1947-09-19",
    "northgate",
    at("11-17", "09:05"),
    "C85.90",
    "question",
    "Patel",
    { smudged: true },
  ],
  [
    39,
    "Ines Carvalho",
    "1964-07-28",
    "riverside",
    at("11-17", "09:31"),
    "C25.9",
    "question",
    "Okafor",
    { smudged: true },
  ],
];

function spec(row: Row): ReferralSpec {
  const [n, name, dob, practice, receivedAt, diagnosis, plan, oncologist, extra] = row;
  return {
    id: `ref-${String(1000 + n)}`,
    patient: patient(n, name, dob, extra?.wheelchair ? "wheelchair" : "walking"),
    practice: PRACTICES[practice],
    receivedAt,
    address: `${100 + n * 37} ${STREETS[n % STREETS.length]}, Halden`,
    memberId: `LHP-${String(400000 + n * 7919).slice(0, 6)}-0${(n % 4) + 1}`,
    smudged: extra?.smudged ?? false,
    diagnosis,
    urgency: extra?.urgent ? "Urgent, within 1 week" : "Routine, within 2 weeks",
    plan,
    oncologist,
  };
}

/** Maria's referral (spec 10.3): Northgate, Nov 10, smudged member id. */
export const MARIA_SPEC: ReferralSpec = {
  id: "maria-001",
  patient: MARIA,
  practice: PRACTICES.northgate,
  receivedAt: at("11-10", "08:04"),
  address: "1420 Cedar Street, Halden",
  memberId: "LHP-883201-02",
  smudged: true,
  diagnosis: "C34.90",
  urgency: "Routine, within 2 weeks",
  plan: "maria",
  oncologist: "Okafor",
};

/** The referral book, oldest first, with Maria in received order. */
export const REFERRALS: ReferralSpec[] = [...ROWS.map(spec), MARIA_SPEC].sort((a, b) =>
  a.receivedAt.localeCompare(b.receivedAt),
);

/**
 * Faxes that arrived on the fax line and are waiting to be received by staff. Receiving one
 * starts a new journey while the visitor watches.
 */
export const FAX_LINE: ReferralSpec[] = [
  spec([
    41,
    "Theodore Banks",
    "1951-03-12",
    "lakeview",
    at("11-17", "08:51"),
    "C34.90",
    "auth_waiting",
    "Okafor",
  ]),
  spec([
    42,
    "Amara Nwosu",
    "1960-08-04",
    "riverside",
    at("11-17", "09:12"),
    "C50.912",
    "question",
    "Brooks",
    { smudged: true },
  ]),
  spec([
    43,
    "Lionel Ferreira",
    "1948-11-27",
    "northgate",
    at("11-17", "09:30"),
    "C61",
    "auth_waiting",
    "Patel",
  ]),
];

export const SERVICES = [
  "CBC w/ diff",
  "CMP",
  "CT chest/abdomen/pelvis with contrast",
  "New patient consult, medical oncology",
] as const;

export const FASTING = "Nothing to eat or drink except water for 8 hours before the blood draw.";

const VISITED: ReadonlySet<ReferralPlan> = new Set([
  "summary_waiting",
  "teachback_waiting",
  "teachback_unclear",
  "results_overdue",
  "checkin_waiting",
  "closed",
]);

/** Weekdays (Central) between two dates, inclusive. */
function weekdays(from: string, to: string): string[] {
  const out: string[] = [];
  for (
    let t = Date.parse(`${from}T12:00:00Z`);
    t <= Date.parse(`${to}T12:00:00Z`);
    t += 86_400_000
  ) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Whether a referral's visit has already happened by the morning of Nov 17. */
export function visited(spec: ReferralSpec): boolean {
  return VISITED.has(spec.plan);
}

/**
 * When each referral patient can come in (the scheduler books inside these windows). Visited
 * patients came the week of Nov 10; everyone else is free from Nov 18, so Nov 17 stays
 * Maria's morning.
 */
export const REFERRAL_AVAILABILITY: Record<string, { date: string; from: string; to: string }[]> =
  Object.fromEntries(
    [...REFERRALS, ...FAX_LINE]
      .filter((s) => s.id !== MARIA_SPEC.id)
      .map((s) => [
        s.patient.id,
        // Visited patients also come back for follow-ups about three weeks later.
        (visited(s)
          ? [...weekdays("2026-11-09", "2026-11-16"), ...weekdays("2026-11-30", "2026-12-09")]
          : weekdays("2026-11-18", "2026-12-04")
        ).map((date) => ({ date, from: "07:30", to: "17:30" })),
      ]),
  );

export function referralSpec(journeyId: string): ReferralSpec | undefined {
  return [...REFERRALS, ...FAX_LINE].find((s) => s.id === journeyId);
}

/** The hospitals on this deployment. Each one is a workspace with its own site. */
export const HOSPITALS = [
  {
    id: "halden",
    name: "Halden Medical Center",
    short_name: "Halden",
    city: "Halden",
    specialties: ["Medical oncology"],
    phone: "555-0100",
    phone_href: "+15550100",
    payers: ["Lonestar Health Plan"],
    status: "live" as const,
  },
  {
    id: "northgate",
    name: "Northgate University Hospital",
    short_name: "Northgate",
    city: "Marlow",
    specialties: ["Cardiology", "Neurology", "Medical oncology", "Orthopedics"],
    phone: "555-0300",
    phone_href: "+15550300",
    payers: ["Lonestar Health Plan", "Medicare", "Blue Cross Blue Shield"],
    status: "live" as const,
  },
  {
    id: "st-brennan",
    name: "St. Brennan Regional Medical Center",
    short_name: "St. Brennan",
    city: "Bayview",
    specialties: ["Orthopedics", "Gastroenterology", "Pediatrics"],
    phone: "555-0200",
    phone_href: "+15550200",
    payers: ["Lonestar Health Plan", "Aetna", "Medicaid"],
    status: "live" as const,
  },
];
