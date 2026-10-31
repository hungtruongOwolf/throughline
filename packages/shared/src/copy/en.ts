/** English copy. Every key must exist in es.ts (test 14). Patient strings: no "→", no "·", no "!". */
export const en = {
  "app.name": "Throughline",
  "hospital.name": "Halden Medical Center",
  "footer.synthetic": "Synthetic demo data. Not a real patient.",
  "disclosure.first_contact":
    "You're texting with Throughline, an AI assistant at Halden Medical Center. For medical questions reply NURSE and a person will call you.",
  "disclosure.summary_unreviewed":
    "This summary was prepared with AI from your care team's notes and has not been reviewed by a clinician. For questions about your care, call the clinic at 555-0100 or reply NURSE.",
  "ops.proposal_footer": "Predicted by simulation; a manager decides.",
  "patient.show_way": "Show me the way",
  "patient.im_here": "I'm here",
  "patient.talk_to_person": "Talk to a person",
  "patient.people_ahead": "{count} people ahead",
  "patient.people_ahead_one": "1 person ahead",
  "patient.about_minutes": "about {minutes} minutes",
  "patient.done_at": "done {time}",
  "patient.sign_unreadable":
    "We couldn't read the sign. Try the sign with the floor number, or tap 'Talk to a person'.",
  "board.empty": "No one is waiting here right now.",
  "board.start": "Start",
  "board.done": "Done",
  "board.didnt_arrive": "Didn't arrive",
  "ticket.number": "Ticket {number}",
  "ticket.first_stops": "Your first stops",
  "ticket.level": "Level {floor}",
  "intake.send_to_payer": "Send to payer",
  "review.approve_send": "Approve and send",
  "handoff.nurse":
    "I can't help with medical questions, but a nurse can. I've asked a nurse to call you. I can still help with directions and times.",
} as const;

export type CopyKey = keyof typeof en;

/** Keys rendered on the patient phone or kiosk; checked for forbidden characters. */
export const PATIENT_SURFACE_PREFIXES = [
  "patient.",
  "disclosure.",
  "handoff.",
  "footer.",
  "ticket.",
] as const;
