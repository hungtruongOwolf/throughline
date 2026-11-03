# Submission

The answers as entered in the submission form (Nov 3, 2026), then the longer write-up they draw from.

## Form answers

**Project name:** Throughline

**Track:** Indie Developer

**Problem statement:** Build for Your World

**Links:**

- Live app: https://throughline-zeta-ten.vercel.app (sign in as any staff member on the front page, or open the patient app)
- Code: https://github.com/hungtruongOwolf/throughline
- Demo video (3:00): https://github.com/hungtruongOwolf/throughline/releases/download/demo-video/throughline-demo.mp4

### Project description

Throughline is an agent platform that connects the steps of a patient's hospital journey, from the first referral to the last follow-up.

The problem: a hospital is organized around its departments, not around the patient. A single referral passes through a clinic, an insurer, schedulers, the building itself, a lab and several doctors, each with its own people and its own system. Nobody owns the whole journey, so the handoffs between steps happen by fax, phone and portal, and patients fall through them: in one 2023 study, only 58% of ordered tests and referrals were completed on time. Staff lose hours to the same coordination; doctors' offices spend about 13 hours a week on insurance approvals alone. The people hurt most are those without someone on the inside: older patients, people with limited English, anyone lost in medical terms. My family has lived this.

Our solution: one thread through every journey. Throughline gives each step to an AI agent. Agents pass the work, and what they learned, to the next agent through a shared event log, so nothing is retyped and nothing is dropped. A safety gate decides what an agent may do on its own and when a person must decide, and medical questions always go to a nurse.

What it covers today, with 13 agents:

- Before the visit: reads faxed referrals and insurance cards, checks coverage, drafts prior-authorization requests for staff to approve, books the visits, and confirms with the patient by text or voice note.
- On the visit day: tracks waits from waiting-room cameras, gives each patient a live plan with step-free directions, and when an area backs up, tests the possible fixes and applies small ones within policy. Staff can report a problem at any station (a room down, a missing staff member, a surge); the planner forecasts the next 90 minutes and proposes a fix, or asks a manager when none helps.
- After the visit: plain-language summaries the doctor signs, a check-in that sends unsure patients to a nurse, results tracked until a doctor acknowledges them, and a report back to the referring doctor.

A few examples from the demo: a smudged ID on a faxed referral becomes a question for the coordinator instead of a guess; a patient who mentions a wheelchair in a voice note gets a step-free route on her visit day, without anyone retyping it; and when a CT scanner breaks, the planner moves patients to the second scanner, cutting the simulated wait from 17 to 5 minutes.

Models read and write; our Rust engine does the math, so every number on screen is computed, not generated.

Built to grow: every agent is a descriptor (what it may do and how risky that is) plus a handler, and it inherits the safety gate, the audit log and the human approvals. Next: a voice agent that calls patients and takes their calls in their own language, to confirm visits, remind them of prep and check in the day after, so patients without a smartphone are not left out; plus agents for rides, interpreters, pharmacy refills and cost estimates. Any hospital can be added as its own workspace.

All patients and hospitals are synthetic; the public site replays recorded live model calls.

### Partner tools used

Modal (hosts the runtime) and Baseten (serves Muse Spark Open, the open-weight model that writes the operations proposals).

### Survey

| Question                                 | Answer                                                  |
| ---------------------------------------- | ------------------------------------------------------- |
| Likely to keep building on Meta models   | Very likely                                             |
| Opinion of Meta's models                 | Very favorable                                          |
| Would recommend the Meta Model API (1–5) | 4                                                       |
| Muse Code                                | Left blank (not used)                                   |
| Biggest obstacle                         | The model not following our instructions                |
| Comparison with other models             | Couldn't make a clear comparison                        |
| What matters most                        | Agent abilities                                         |
| Hardest part of switching models         | Prompts and flows tuned to the current model's behavior |
| What would stop a production launch      | Security or compliance (SOC 2; for us, HIPAA)           |

## Long-form write-up

### Inspiration

My family has lived this: a lost referral, weeks waiting on an insurance approval, and test results nobody called about. None of it was medical. All of it was coordination.

A hospital is organized around its departments, not around the patient. One referral touches a clinic, an insurer, a scheduling desk, the building itself, a lab, and two doctors, each with its own software, and nobody owns the whole chain. People with someone on the inside get through; people without, struggle, especially older patients, the more than 25 million people in the US with limited English (CMS, ACS), and the 28% of US adults who now read at the lowest literacy levels (NCES, PIAAC 2023).

- **Before:** physicians and staff spend about 13 hours a week on prior authorization, about 40 requests per physician (AMA survey, December 2025). 58% of insured adults hit a problem using their coverage in a year (KFF, 2023). A new patient waits 31 days on average for an appointment in large US cities (AMN Healthcare, 2025).
- **Between steps:** only 58% of tests and referrals ordered at in-person visits, and 43% at video visits, were completed on time (JAMA Network Open, 2023). More than a third of documents sent to health care facilities still arrive by fax (Documo, 2025, vendor survey).
- **The cost:** administrative costs are an estimated 25% to 35% of US health spending (American Hospital Association, 2025). Worldwide, 4.6 billion people lack full coverage of essential health services (WHO and World Bank, 2025), and the world will be 11.1 million health workers short by 2030 (WHO).

Each figure comes from its own survey or study; we cite them as signals, not as one national rate.

### What it does

Throughline is an agent platform for the patient's whole hospital journey. Each hospital is a workspace with its own campus; three are listed (campuses of up to 14 floors), and a hospital can add itself. The live workspace is Halden Medical Center on the morning of Nov 17: about 30 referrals at every stage, 54 people in the building, a CT scanner down, and the work waiting for each person. Staff sign in as themselves (coordinator, nurse navigator, oncologist, operations lead):

- **Inbox:** every decision an agent parked for a person, with the agent's draft beside its source (the fax, the payer rule, the doctor's notes, the floor) and one action.
- **Referrals:** every patient, the stage, who holds the next move, and the next step.
- **Patient record:** a timeline of what each agent did, with the Meta model it ran on, and the full run on click.
- **Agents:** 13 agents with their runs, how often they finished on their own, waited for staff, or handed to a nurse, and their guardrails.
- **Today on the floor:** live waits on a 3D campus, the planner's changes, a what-if slider, and a form to report a problem at any station.

One referral, Maria's, end to end:

- **Before the visit.** Spark vision reads the faxed referral. The member ID is smudged, so Throughline asks the coordinator instead of guessing. It checks her insurance and drafts the approval request; the coordinator sends it. When the insurer approves, it books the visits into one morning on a day her daughter can drive her. Maria answers with a voice note, which Voice Transcribe and Spark turn into "confirmed, and she needs a wheelchair".
- **The visit day.** SAM 3.1 counts people in the waiting rooms, and Maria's page shows her next stop and a step-free route. At 9:40 a CT scanner breaks down. The Rust engine runs the next 90 minutes 20 times for each possible fix, and Muse Spark Open, an open-weight model on Baseten, reads the results and writes one proposal. The change is small and clearly helps, so it applies within policy and the operations lead sees what changed and why; larger changes wait for the lead. Maria's plan moves to CT 2 on its own. The same chain runs at any station: the fixes come from the hospital's own data, and staff can report a problem before a line builds. Later Maria gets lost; she photographs a sign, and Spark reads it to direct her back. When she asks whether dizziness is normal, Throughline doesn't answer; a nurse calls her.
- **After the visit.** Spark restates Dr. Okafor's notes in plain words beside the original, and Dr. Okafor approves it before Maria sees it. A day later three short questions check that Maria understood; she isn't sure who to call, so a nurse call goes on the clinic's list. Results are tracked until a doctor acknowledges them, follow-ups are booked, and the referring doctor gets one report: what was done, when, and what is still open.

### How we built it

- **Agents.** A TypeScript runtime runs 13 agents on one contract: event → capability → safety gate → handler. Each agent is a descriptor (capabilities and risk) plus a handler.
  - A model agent must call one validated tool. It gets one retry, then falls back to a deterministic rule.
  - Insurance requests, operations changes, and clinician-reviewed summaries park for a person and replay exactly as proposed.
  - Medical questions are a blocking handoff to a nurse.
- **Meta models.** Seven agents use them; six run on rules or the engine.
  - Muse Spark 1.3 does vision, structured output, and the patient messages.
  - Muse Spark Open, on Baseten, writes the operations proposals. The same prompt and schema run on hosted Spark 1.3 behind one flag.
  - SAM 3.1 counts people in the waiting rooms.
  - Muse Voice Transcribe reads the voice notes.
  - Muse Image generated the waiting-room camera frames SAM counts (no real people's images).
- **Engine.** A Rust engine, compiled to WebAssembly for the browser and native for the runtime, does scheduling with dependencies, routing, and the discrete-event queue simulation and what-if.
- **Web.** Next.js.
- **Recording and deployment.** Every model call goes through a record/replay cache. The public site replays a recorded live run, with no API keys on the server. The runtime runs on Modal and the web app on Vercel.

### Measured

- **Referral fax reading:** 10 of 10 repeated live runs on the same fax gave a valid packet, each with the smudged ID flagged rather than guessed (median 3.0 s).
- **Clinical-question screen** (60 clinical and 40 everyday prompts, English and Spanish): the keyword layer and Spark each caught 60/60, with 0 false positives.
- **Ops planner on every station:** a test reports a room down, a missing staff member, and a surge at each of the 10 stations; each ends in a proposal that shortens the forecast wait, a manager asked, or nothing needed.
- **Tests:** about 370 across the runtime, engine, shared types, hospitals, and data, plus 22 Playwright end-to-end tests.

### Challenges

- **Prose instead of tool calls.** Models sometimes answer in prose instead of calling the tool. We added one retry with the error in context, then a deterministic fallback, and every fallback is recorded.
- **"null" as text.** Spark once wrote the word "null" for an unreadable ID, which would have skipped the human check. Running the real model surfaced it.
- **Reasoning budget.** The reasoning budget can eat the whole output. One grading call came back empty until we raised the limit.
- **One scripted outage.** The first ops planner knew the CT outage by name. Its fixes now come from each hospital's own data, staff can report a problem at any station, and when nothing helps it asks a manager.
- **One flow.** Keeping the whole journey as one connected flow, instead of separate dashboards, took three redesigns.

### What's next

None of this is built yet; every item runs on the same agent contract.

- **New abilities:** voice calls in and out in the patient's language, every language both ways, more channels (SMS, WhatsApp, portal, paper), any document, caregivers in the loop, a private tier on open weights inside the hospital, real FHIR and insurer connections.
- **New agents:** records collector, cost estimates, appeals, rides, interpreters, open slots, equipment, beds and transfers, pharmacy, home care, care gaps.
- **For each hospital:** an agent builder, a policy console, rehearsal on a recorded day before go-live, and outcomes measured before and after.
- **Proving it:** a pilot on one clinic's real referral queue.

### Built with

TypeScript, Rust, WebAssembly, Next.js, React, Hono, SQLite, Muse Spark 1.3, Muse Spark Open, SAM 3.1, Muse Voice Transcribe, Muse Image, Baseten, Modal, Vercel

## Disclosure (keep with the submission)

All patients, providers, documents, the hospitals, the insurers, SMS, cameras, the lab system, and the clock are simulated with synthetic data generated in the repo. The public site replays a recorded live run of the models; incidents reported by visitors that have no recorded model call get the planner's deterministic rule, with the engine's numbers. Throughline does not diagnose, triage, or interpret results.
