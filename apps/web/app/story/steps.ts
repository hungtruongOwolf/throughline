import type { Phase } from "../p/[journeyId]/patient-portal";

/**
 * Maria's journey, one step at a time (runtime demo/story.ts runs the same steps). Each step
 * says what just happened, whose screen we are looking at, the one thing to do, and what
 * happens after. Copy is written from the people in the story, not from the system.
 */
export type Screen =
  | { kind: "intake" }
  | { kind: "auth" }
  | { kind: "waiting" }
  | { kind: "patient"; phase: Phase }
  | { kind: "station" }
  | { kind: "ops" };

export interface StoryStepCopy {
  id: string;
  rail: string;
  when: string;
  who: string;
  happened: string;
  screen: Screen;
  action: string;
  next: string;
}

export const STEPS: StoryStepCopy[] = [
  {
    id: "fax",
    rail: "A referral arrives",
    when: "Tue, Nov 10, 8:05 am",
    who: "Intake coordinator",
    happened:
      "Dr. Whitcombe's office faxed a referral for Maria Diaz. Throughline read the fax and the insurance card. One thing was unreadable: the end of her member ID is smudged on the fax.",
    screen: { kind: "intake" },
    action: "Enter the member ID from the card",
    next: "Throughline checks her insurance and drafts the approval request for the CT scan.",
  },
  {
    id: "auth",
    rail: "Approve the insurance request",
    when: "Tue, Nov 10, 8:05 am",
    who: "Intake coordinator",
    happened:
      "Her insurance is active. Her plan must approve the CT scan and the infusion before they can be booked, so Throughline drafted the request. Nothing goes to an insurer without a person.",
    screen: { kind: "auth" },
    action: "Send the request to the insurer",
    next: "The insurer usually answers within two business days.",
  },
  {
    id: "insurer",
    rail: "Wait for the insurer",
    when: "Tue, Nov 10, 8:06 am",
    who: "Throughline",
    happened:
      "The request is with Lonestar Health Plan. There is nothing for anyone to do until they answer.",
    screen: { kind: "waiting" },
    action: "Skip ahead two days",
    next: "When the insurer approves, Throughline books every appointment in the right order and texts Maria.",
  },
  {
    id: "confirm",
    rail: "Maria confirms",
    when: "Thu, Nov 12, 8:05 am",
    who: "Maria, at home",
    happened:
      "The insurer approved. Throughline fit all five appointments into one morning, on a day her daughter can drive her, and texted Maria what to expect.",
    screen: { kind: "patient", phase: "before" },
    action: "Reply as Maria: “Yes. My husband can't come, so I'll need a wheelchair.”",
    next: "Throughline confirms, notes the wheelchair, and sends reminders before the day.",
  },
  {
    id: "day_before",
    rail: "The evening before",
    when: "Mon, Nov 16, 6:00 pm",
    who: "Maria, at home",
    happened:
      "Maria got a reminder this morning. Her page says exactly what tomorrow looks like and what to do tonight.",
    screen: { kind: "patient", phase: "before" },
    action: "Go to Tuesday morning: Maria arrives",
    next: "She checks in at the Main Entrance kiosk and gets her plan for the day.",
  },
  {
    id: "arrive",
    rail: "She arrives",
    when: "Tue, Nov 17, 9:13 am",
    who: "Maria, at the hospital",
    happened:
      "Maria checked in. Her daughter pushes her wheelchair. Her page shows her first stop, how many people are ahead, and a step-free way there.",
    screen: { kind: "patient", phase: "visit" },
    action: "Play the morning",
    next: "She has her blood drawn and her vitals checked, then waits for her CT scan. Meanwhile, CT scanner 1 breaks down.",
  },
  {
    id: "outage",
    rail: "A CT scanner breaks",
    when: "Tue, Nov 17, 9:53 am",
    who: "CT front desk",
    happened:
      "CT scanner 1 went down at 9:40. The waiting room camera counts the people waiting, and the wait has jumped. Maria is one of the people waiting.",
    screen: { kind: "station" },
    action: "Show the operations manager",
    next: "Throughline simulated what would help and sent the operations manager one proposal.",
  },
  {
    id: "decide",
    rail: "A manager decides",
    when: "Tue, Nov 17, 9:53 am",
    who: "Operations manager",
    happened:
      "Throughline ran the rest of the day 20 times with and without a fix. Opening a slot on CT scanner 2 cuts the wait the most. It changes nothing until a person approves.",
    screen: { kind: "ops" },
    action: "Approve: open CT 2",
    next: "Every patient affected gets a new plan, including Maria.",
  },
  {
    id: "changed",
    rail: "Her plan changes",
    when: "Tue, Nov 17, 9:53 am",
    who: "Maria, at the hospital",
    happened:
      "Maria's page says her scan moved to CT 2, next door, and shows her new times. She doesn't have to ask anyone.",
    screen: { kind: "patient", phase: "visit" },
    action: "Play until after her doctor's visit",
    next: "After her scan she stops at the café and loses track of time. Her next stop notices she is late.",
  },
  {
    id: "lost",
    rail: "She finds her way back",
    when: "Tue, Nov 17, 11:47 am",
    who: "Maria, at the hospital",
    happened:
      "Maria wasn't at the vitals desk on time, so Throughline asked if she was on her way. She took a photo of the nearest sign, and Throughline recognized where she was and sent directions from there.",
    screen: { kind: "patient", phase: "visit" },
    action: "Play until her infusion",
    next: "She sees Dr. Okafor, then goes up to the Infusion Center.",
  },
  {
    id: "question",
    rail: "A medical question",
    when: "Tue, Nov 17, 12:47 pm",
    who: "Maria, at the hospital",
    happened:
      "During her infusion Maria texted “Is it normal to feel dizzy?” Throughline does not answer medical questions. It told her a nurse would call and opened a task for the nurse.",
    screen: { kind: "patient", phase: "visit" },
    action: "Finish the day",
    next: "Her infusion ends and she goes home.",
  },
  {
    id: "after",
    rail: "After the visit",
    when: "Tue, Nov 17, 2:35 pm",
    who: "Maria, at home",
    happened:
      "Maria is home. Her page now shows what happens next: her visit summary, a short check that it made sense, her results, and her next appointment.",
    screen: { kind: "patient", phase: "after" },
    action: "Start the story again",
    next: "",
  },
];
