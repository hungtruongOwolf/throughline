import type { Order } from "@throughline/shared";

/**
 * What each appointment is, told from the patient's side (DESIGN-PORTAL principle 1 and 5):
 * what happens, why it is in this order, how long, and what to do. Administrative only:
 * how a test goes, never what a result means. Reviewed copy, not generated.
 */
export interface Guide {
  title: string;
  /** The name inside a sentence: "your CT scan". */
  short: string;
  what: string;
  why: string;
  howLong: string;
  youDo: string[];
}

const GUIDES: Record<string, Guide> = {
  lab: {
    title: "Blood tests",
    short: "blood tests",
    what: "A nurse takes a small sample of blood from your arm. It takes a few minutes.",
    why: "Your oncologist wants these results at least two days before your first visit, so this is a separate, short trip.",
    howLong: "About 10 minutes in the lab. Plan for 30 minutes with check-in.",
    youDo: [
      "Nothing to eat or drink except water for 8 hours before. Your doctor wrote this.",
      "Take your usual medicines with water unless your doctor told you otherwise.",
      "Wear a top with sleeves that roll up easily.",
    ],
  },
  imaging: {
    title: "CT scan",
    short: "CT scan",
    what: "A scan that takes detailed pictures of your chest, abdomen, and pelvis. You lie on a table that slides through a large ring. A dye called contrast goes in through a small IV in your arm so the pictures are clearer.",
    why: "Your oncologist looks at these pictures with you at your visit, so the scan comes first, on the same morning.",
    howLong: "About 25 minutes in the scanner room. Plan for an hour with check-in and the IV.",
    youDo: [
      "Tell the technologist if you have ever reacted to contrast dye or have kidney problems.",
      "Leave jewelry at home if you can. You can keep your clothes on unless they have metal.",
    ],
  },
  vitals: {
    title: "Vitals check",
    short: "vitals check",
    what: "A nurse checks your blood pressure, pulse, temperature, and weight.",
    why: "Your doctor sees these numbers at your visit.",
    howLong: "About 5 minutes, right before your doctor's visit.",
    youDo: ["Nothing to prepare."],
  },
  visit: {
    title: "First visit with your oncologist",
    short: "first visit with Dr. Okafor",
    what: "You meet Dr. Okafor, a cancer doctor, for the first time. You talk about your scan and blood tests together, and about what comes next.",
    why: "This is the main reason for your referral. Everything else that morning is so your doctor has what they need.",
    howLong: "About 20 to 40 minutes.",
    youDo: [
      "Bring a list of your medicines and your questions.",
      "A family member can join in person or by phone.",
    ],
  },
  infusion: {
    title: "Infusion, only if your doctor decides",
    short: "infusion",
    what: "If Dr. Okafor decides to start treatment that day, the infusion center gives it to you through an IV while you sit in a recliner.",
    why: "Your referral asks for it if your doctor signs off, so a chair is held for you right after your visit. Your doctor will tell you whether you need it.",
    howLong: "About 2 hours if it happens.",
    youDo: ["Bring something to read or a charged phone, and a snack."],
  },
};

const FOLLOW_UP: Guide = {
  title: "Follow-up visit with your oncologist",
  short: "follow-up with Dr. Okafor",
  what: "You see Dr. Okafor again. She goes over your CT scan and blood tests with you and plans what comes next.",
  why: "Your blood tests a couple of days before give her what she needs for this visit.",
  howLong: "About 20 to 30 minutes.",
  youDo: [
    "Bring a list of your medicines and your questions.",
    "Bring someone with you if you like.",
  ],
};

export function guideFor(
  order: Pick<Order, "kind" | "station_id"> & { code_as_written?: string },
): Guide {
  if (order.station_id === "vitals") return GUIDES.vitals as Guide;
  if (order.kind === "visit" && /follow-up/i.test(order.code_as_written ?? "")) return FOLLOW_UP;
  return (GUIDES[order.kind] ?? GUIDES.visit) as Guide;
}

/** Orders drawn together (CBC and CMP) are one appointment for the patient. */
export function samePatientAppointment(
  a: { station_id: string; start: string },
  b: { station_id: string; start: string },
) {
  return a.station_id === b.station_id && a.start === b.start;
}
