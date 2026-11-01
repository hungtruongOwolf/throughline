import type { AgentName } from "./capabilities";
import type { JourneyState } from "./journey/states";
import type { Journey } from "./journey/types";
import type { HumanReview } from "./ops";

/** How each agent is named and credited on screen (docs/PLATFORM-DESIGN.md section 5). */
export interface AgentProfile {
  name: AgentName;
  label: string;
  glyph: string;
  job: string;
  runsOn: string;
  /** The model-backed capabilities; an empty list means rules or the engine only. */
  usesModel: boolean;
  guardrails: string[];
  group: "Before the visit" | "Visit day" | "After the visit";
}

export const AGENT_CATALOG: AgentProfile[] = [
  {
    name: "referral_intake",
    label: "Intake",
    glyph: "IN",
    job: "Reads each faxed referral into a structured packet. Anything unreadable becomes a question for the coordinator instead of a guess.",
    runsOn: "Muse Spark 1.3 vision",
    usesModel: true,
    guardrails: [
      "Copies diagnosis and urgency exactly as written",
      "Never guesses a field it cannot read",
    ],
    group: "Before the visit",
  },
  {
    name: "eligibility",
    label: "Coverage",
    glyph: "CV",
    job: "Checks the plan, the copay, and which ordered services need the payer's approval.",
    runsOn: "Payer rules",
    usesModel: false,
    guardrails: ["Uses the payer's published rules only"],
    group: "Before the visit",
  },
  {
    name: "authorization",
    label: "Prior auth",
    glyph: "PA",
    job: "Drafts the prior authorization request from the referral and the payer's rules.",
    runsOn: "Muse Spark 1.3",
    usesModel: true,
    guardrails: ["Submitting to a payer always needs coordinator approval"],
    group: "Before the visit",
  },
  {
    name: "scheduler",
    label: "Scheduling",
    glyph: "SC",
    job: "Books every ordered service in the right order in as few trips as possible, around the patient's availability.",
    runsOn: "Rust scheduling engine",
    usesModel: false,
    guardrails: ["Respects order dependencies and the patient's stated times"],
    group: "Before the visit",
  },
  {
    name: "prep",
    label: "Visit prep",
    glyph: "VP",
    job: "Sends the plan for the day: times, where to go, what to bring, and the instructions exactly as the doctor wrote them.",
    runsOn: "Rules",
    usesModel: false,
    guardrails: ["Instructions are quoted, never reworded"],
    group: "Before the visit",
  },
  {
    name: "messenger",
    label: "Patient messaging",
    glyph: "PM",
    job: "Reads patient replies and voice notes: confirmations, changes, and needs like a wheelchair. Sends reminders.",
    runsOn: "Muse Spark 1.3; Voice Transcribe for voice notes",
    usesModel: true,
    guardrails: [
      "Clinical questions always go to a nurse",
      "Remembers only allowlisted facts (mobility, companion, time of day, transport)",
    ],
    group: "Before the visit",
  },
  {
    name: "sensing",
    label: "Waiting-room sensing",
    glyph: "WS",
    job: "Counts people in each waiting room from camera frames and spots a growing queue.",
    runsOn: "SAM 3.1",
    usesModel: true,
    guardrails: ["Counts people only; frames are not stored with identities"],
    group: "Visit day",
  },
  {
    name: "itinerary",
    label: "Itinerary",
    glyph: "IT",
    job: "Plans each patient's stops for the day and re-plans when queues change.",
    runsOn: "Rust scheduling engine",
    usesModel: false,
    guardrails: ["Keeps clinical order (labs before the visit that needs them)"],
    group: "Visit day",
  },
  {
    name: "companion",
    label: "Visit companion",
    glyph: "CO",
    job: "Tells the patient where to go next and how long the wait is, gives step-free directions, and reads sign photos when someone is lost.",
    runsOn: "Muse Spark 1.3 (messages and sign photos); directions in code",
    usesModel: true,
    guardrails: [
      "Clinical questions always go to a nurse",
      "Patient messages are screened; anything clinical uses an approved template",
    ],
    group: "Visit day",
  },
  {
    name: "ops",
    label: "Ops planner",
    glyph: "OP",
    job: "When a queue grows, runs the rest of the day with each possible fix and proposes the best one.",
    runsOn: "Muse Spark Open, open weights on Baseten",
    usesModel: true,
    guardrails: [
      "Changes apply only after the operations lead approves",
      "Uses the engine's numbers, never its own",
    ],
    group: "Visit day",
  },
  {
    name: "results_watcher",
    label: "Results watch",
    glyph: "RW",
    job: "Tracks results until the ordering clinician acknowledges them. Never reads or shares values.",
    runsOn: "Rules",
    usesModel: false,
    guardrails: [
      "Status only, never result values",
      "Unacknowledged after 48 hours becomes a clinician task",
    ],
    group: "After the visit",
  },
  {
    name: "discharge",
    label: "Discharge",
    glyph: "DS",
    job: "Restates the clinician's notes in plain words beside the original, and checks a day later that the patient understood.",
    runsOn: "Muse Spark 1.3",
    usesModel: true,
    guardrails: [
      "Summaries are signed by the clinician before sending",
      "An unclear answer becomes a nurse call",
    ],
    group: "After the visit",
  },
  {
    name: "followup",
    label: "Follow-up",
    glyph: "FU",
    job: "Books follow-up labs and visits, checks in on day 3, and sends the closure report to the referring doctor.",
    runsOn: "Rust scheduling engine",
    usesModel: false,
    guardrails: ["Check-in answers are read as yes or no only, never clinically"],
    group: "After the visit",
  },
];

export function agentProfile(name: string): AgentProfile | undefined {
  return AGENT_CATALOG.find((a) => a.name === name);
}

export type StaffRole = "coordinator" | "nurse" | "clinician" | "ops";

export interface StaffMember {
  id: string;
  name: string;
  initials: string;
  role: StaffRole;
  title: string;
  home: "/inbox" | "/today";
}

export const STAFF: StaffMember[] = [
  {
    id: "jordan",
    name: "Jordan Park",
    initials: "JP",
    role: "coordinator",
    title: "Referral coordinator",
    home: "/inbox",
  },
  {
    id: "renee",
    name: "Renee Alvarez, RN",
    initials: "RA",
    role: "nurse",
    title: "Nurse navigator",
    home: "/inbox",
  },
  {
    id: "okafor",
    name: "Dr. Okafor",
    initials: "DO",
    role: "clinician",
    title: "Medical oncology",
    home: "/inbox",
  },
  {
    id: "sam",
    name: "Sam Whitfield",
    initials: "SW",
    role: "ops",
    title: "Operations lead",
    home: "/today",
  },
];

/** Who owns an item a person must act on. */
export function roleForReview(
  review: Pick<HumanReview, "kind" | "capability" | "agent" | "reason">,
): StaffRole {
  if (review.kind === "handoff") return "nurse";
  if (review.capability === "prior_auth.submit") return "coordinator";
  if (review.capability === "ops_action.apply") return "ops";
  if (review.capability === "summary.send") return "clinician";
  if (review.agent === "results_watcher") return "clinician";
  if (review.agent === "discharge") return "nurse";
  if (review.agent === "followup") return /nurse/i.test(review.reason) ? "nurse" : "coordinator";
  if (review.agent === "companion") return "ops";
  return "coordinator";
}

export const STAGES = [
  "Intake",
  "Coverage",
  "Prior auth",
  "Scheduled",
  "Visit day",
  "After visit",
  "Closed",
] as const;
export type Stage = (typeof STAGES)[number];

const STAGE_OF: Record<JourneyState, Stage> = {
  REFERRAL_RECEIVED: "Intake",
  INTAKE_EXTRACTED: "Intake",
  CLARIFICATION_NEEDED: "Intake",
  ELIGIBILITY_CHECKED: "Coverage",
  AUTH_DRAFTED: "Prior auth",
  AUTH_SUBMITTED: "Prior auth",
  AUTH_DECIDED: "Prior auth",
  SCHEDULED: "Scheduled",
  PREP_SENT: "Scheduled",
  CONFIRMED: "Scheduled",
  ARRIVED: "Visit day",
  PLANNED: "Visit day",
  ACTIVE: "Visit day",
  CHECKED_OUT: "After visit",
  FOLLOWUPS_BOOKED: "After visit",
  SUMMARY_DRAFTED: "After visit",
  SUMMARY_SENT: "After visit",
  TEACHBACK_PENDING: "After visit",
  TEACHBACK_DONE: "After visit",
  RESULTS_ACKNOWLEDGED: "After visit",
  REFERRAL_CLOSED: "Closed",
};

export function stageOf(journey: Pick<Journey, "state">): Stage {
  return STAGE_OF[journey.state];
}
