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
  | { kind: "ops" }
  | { kind: "review" }
  | { kind: "closed" };

export interface StoryStepCopy {
  id: string;
  rail: string;
  when: string;
  who: string;
  happened: string;
  screen: Screen;
  action: string;
  /** A text the actor sends with the action (Maria's answers after the visit). */
  draft?: string;
  /** A voice note the actor sends with the action (Maria's reply), with what she says. */
  voice?: { src: string; words: string };
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
    action: "Save member ID",
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
    action: "Send to Lonestar Health Plan",
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
    action: "Continue to Thu, Nov 12",
    next: "When the insurer approves, Throughline books every appointment in the right order and texts Maria.",
  },
  {
    id: "confirm",
    rail: "Maria confirms",
    when: "Thu, Nov 12, 8:05 am",
    who: "Maria, at home",
    happened:
      "The insurer approved. Throughline fit all five appointments into one morning, on a day her daughter can drive her, and texted Maria what to expect. She answers with a voice note.",
    screen: { kind: "patient", phase: "before" },
    action: "Send voice note",
    voice: {
      src: "/api/voice/maria-reply.wav",
      words: "Yes, I'll be there. But my husband can't come, so I'll need a wheelchair.",
    },
    next: "Throughline writes down what she said, confirms, notes the wheelchair, and sends reminders before the day.",
  },
  {
    id: "day_before",
    rail: "The evening before",
    when: "Mon, Nov 16, 6:00 pm",
    who: "Maria, at home",
    happened:
      "Maria got a reminder this morning. Her page says exactly what tomorrow looks like and what to do tonight.",
    screen: { kind: "patient", phase: "before" },
    action: "Continue to Tue, Nov 17, 9:13 am",
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
    action: "Continue to 9:53 am",
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
    action: "Open the command center",
    next: "Throughline works out what would help and sends the operations manager one proposal.",
  },
  {
    id: "decide",
    rail: "A manager decides",
    when: "Tue, Nov 17, 9:53 am",
    who: "Operations manager",
    happened:
      "Throughline ran the rest of the day 20 times with each possible fix. Muse Spark Open, an open-weight model, read the results and wrote one proposal. It changes nothing until a person approves.",
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
    action: "Continue to 11:47 am",
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
    action: "Continue to 12:47 pm",
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
    action: "Continue to 2:35 pm",
    next: "Her infusion ends and she goes home.",
  },
  {
    id: "after",
    rail: "She goes home",
    when: "Tue, Nov 17, 2:35 pm",
    who: "Maria, going home",
    happened:
      "Maria's day is done. Throughline booked her follow-up blood tests and visit for three weeks from now, and drafted a plain-language summary of Dr. Okafor's notes. Her page shows what happens next.",
    screen: { kind: "patient", phase: "after" },
    action: "Continue to 4:30 pm",
    next: "Dr. Okafor checks the summary before it reaches Maria.",
  },
  {
    id: "review",
    rail: "The doctor checks the summary",
    when: "Tue, Nov 17, 4:30 pm",
    who: "Dr. Okafor",
    happened:
      "Throughline put Dr. Okafor's own notes beside its plain-language version, section by section. Nothing reaches Maria until she approves it.",
    screen: { kind: "review" },
    action: "Approve and send",
    next: "Maria gets a text that her summary is ready. The next evening, Throughline asks three short questions to check it was clear.",
  },
  {
    id: "teachback",
    rail: "Did it make sense?",
    when: "Wed, Nov 18, 5:00 pm",
    who: "Maria, at home",
    happened:
      "Maria read her summary yesterday, and Dr. Okafor has seen her test results. Today Throughline asked three short questions: when is her next blood test, what does she bring, and who does she call.",
    screen: { kind: "patient", phase: "after" },
    action: "Send",
    draft:
      "My next blood test is Monday, December 7. I bring my insurance card and my ID. I'm not sure who to call.",
    next: "Throughline checks her answers. If one is unclear, a nurse calls her. It never answers medical questions itself.",
  },
  {
    id: "checkin",
    rail: "A check-in",
    when: "Fri, Nov 20, 10:05 am",
    who: "Maria, at home",
    happened:
      "Maria wasn't sure who to call, so Throughline put a nurse call on the clinic's list. Today it checks the practical things: her prescription, and a ride to her next visit.",
    screen: { kind: "patient", phase: "after" },
    action: "Send",
    draft:
      "Yes, I picked up the prescription. My daughter will drive me. No need for a nurse call, thank you.",
    next: "With every step done, Throughline closes the referral and reports back to the doctor who sent Maria.",
  },
  {
    id: "closed",
    rail: "The loop is closed",
    when: "Fri, Nov 20, 10:05 am",
    who: "Dr. Whitcombe's office",
    happened:
      "Dr. Whitcombe faxed Maria's referral ten days ago. Today her office gets one report back: what was done, when, and what is still open.",
    screen: { kind: "closed" },
    action: "Start again from the referral",
    next: "",
  },
];
