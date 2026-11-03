# Submission text (draft)

**Name:** Throughline

**Tagline:** One thread through a hospital visit, from the faxed referral to the closed loop, with a person signing off at every step that matters.

**Track / tags:** Best Agentic Use-Case · Best Build on Open Weight Models

**Links:**

- Demo: https://throughline-zeta-ten.vercel.app (sign in as "Jordan Park, referral coordinator", or open the patient app with an example visit code)
- Code: https://github.com/hungtruongOwolf/throughline
- Video: _(add after upload)_

## Inspiration

My family has lived this: a lost referral, weeks waiting on an insurance approval, and test results nobody called about. None of it was medical. All of it was coordination.

A hospital is organized around its departments, not around the patient. One referral touches a clinic, an insurer, a scheduling desk, the building itself, a lab, and two doctors, each with its own software, and nobody owns the whole chain. People with someone on the inside get through; people without, struggle, especially older patients, the more than 25 million people in the US with limited English (CMS, ACS), and the 28% of US adults who now read at the lowest literacy levels (NCES, PIAAC 2023).

- **Before:** physicians and staff spend about 13 hours a week on prior authorization, about 40 requests per physician (AMA survey, December 2025). 58% of insured adults hit a problem using their coverage in a year (KFF, 2023). A new patient waits 31 days on average for an appointment in large US cities (AMN Healthcare, 2025).
- **Between steps:** only 58% of tests and referrals ordered at in-person visits, and 43% at video visits, were completed on time (JAMA Network Open, 2023). More than a third of documents sent to health care facilities still arrive by fax (Documo, 2025, vendor survey).
- **The cost:** administrative costs are an estimated 25% to 35% of US health spending (American Hospital Association, 2025). Worldwide, 4.6 billion people lack full coverage of essential health services (WHO and World Bank, 2025), and the world will be 11.1 million health workers short by 2030 (WHO).

None of this is clinical work. It is the coordination around the care, and it is where people fall through the gaps. Each figure comes from its own survey or study; we cite them as signals, not as one national rate.

## What it does

Throughline is a multi-hospital patient-access and visit-day workspace. Choose a hospital from the front page (three are listed, including campuses of up to 14 floors) or add your own. The live workspace is Halden Medical Center on the morning of Nov 17: about 30 referrals at every stage, 54 people in the building, a CT scanner down, and the work waiting for each person. Staff sign in as themselves (coordinator, nurse navigator, oncologist, operations lead):

- **Inbox:** every decision an agent parked for a person, with the agent's draft beside its source (the fax, the payer rule, the doctor's notes, the conversation) and one action.
- **Referrals:** every patient, the stage, who holds the next move, and the next step.
- **Patient record:** a timeline of what each agent did, with the Meta model it ran on, and the full run on click.
- **Agents:** 13 agents with their runs, how often they finished on their own, waited for staff, or handed to a nurse, and their guardrails.
- **New referral:** receive a fax from the fax line and watch intake, coverage, and prior auth work on it.

The patient app is separate: one plan, the next step, and a way to write or send a voice note to the clinic. One referral, Maria's, end to end:

- **Before the visit.** Spark vision reads the faxed referral. The member ID is smudged, so Throughline asks the coordinator instead of guessing. It checks her insurance and drafts the approval request; the coordinator sends it. When the insurer approves, it books five appointments into one morning on a day her daughter can drive her. Maria answers with a voice note, which Voice Transcribe and Spark turn into "confirmed, and she needs a wheelchair".
- **The visit day.** SAM 3.1 counts people in the waiting rooms, and Maria's page shows her next stop, how many people are ahead of her, and a step-free route. At 9:40 a CT scanner breaks down. The Rust engine simulates the rest of the day 20 times for each possible fix. Muse Spark Open, an open-weight model on Baseten, reads the results and writes one proposal. The change is small and clearly helps, so it applies within policy and the operations lead sees what changed and why; larger changes wait for the lead. Maria's plan moves to CT 2 on its own. Later she gets lost; she photographs a sign, and Spark reads it to direct her back. When she asks whether dizziness is normal, Throughline doesn't answer; a nurse calls her.
- **After the visit.** Throughline books her follow-ups. Spark restates Dr. Okafor's notes in plain words, shown beside the original text, and Dr. Okafor approves it before Maria sees it. A day later three short questions check that Maria understood. She isn't sure who to call, so a nurse call goes on the clinic's list. A day-3 check-in follows, and the doctor who referred her gets one report: what was done, when, and what is still open.

## How we built it

- **Agents.** A TypeScript runtime runs 13 agents on one contract: event → capability → safety gate → handler.
  - A model agent must call one validated tool. It gets one retry, then falls back to a deterministic rule.
  - Insurance requests, operations changes, and clinician-reviewed summaries park for a person and replay exactly as proposed.
  - Medical questions are a blocking handoff to a nurse.
- **Meta models.**
  - Muse Spark 1.3 does vision, structured output, and the patient messages.
  - Muse Spark Open, on Baseten, writes the operations proposals.
  - SAM 3.1 counts people in the waiting rooms.
  - Muse Voice Transcribe reads the voice notes.
  - Muse Image generated the camera frames.
- **Engine.** A Rust engine, compiled to WASM, does the scheduling with dependencies and the discrete-event queue simulation and what-if.
- **Web.** The front end is Next.js.
- **Recording and deployment.** Every model call goes through a record/replay cache. The public demo replays a recorded live run, with no API keys on the server. The runtime runs on Modal and the web app on Vercel.

## Measured

- **Referral fax reading:** 10/10 live runs gave a valid packet, each with the smudged ID flagged rather than guessed.
- **Clinical-question screen** (60 clinical and 40 everyday prompts, English and Spanish): Spark caught 60/60, with 0 false positives.

## Challenges

- **Prose instead of tool calls.** Models sometimes answer in prose instead of calling the tool. We added one nudge, then a deterministic fallback.
- **"null" as text.** Spark once wrote the word "null" for an unreadable ID, which would have skipped the human check. Running the real model surfaced it.
- **Reasoning budget.** The reasoning budget can eat the whole output. One grading call came back empty until we raised the limit.
- **One flow.** Keeping the whole journey as one connected flow, instead of separate dashboards, took three redesigns.

## What's next

- A private tier for identifiable data (Muse Glimmer on Modal).
- Real SMS and EHR connections.
- A trial with a clinic's own referral queue.

## Built with

TypeScript · Rust · WebAssembly · Next.js · React · Hono · SQLite · Muse Spark 1.3 · Muse Spark Open · SAM 3.1 · Muse Voice Transcribe · Muse Image · Baseten · Modal · Vercel

## Disclosure (keep with the submission)

All patients, providers, documents, the hospitals, the insurers, SMS, cameras, the lab system, and the clock are simulated with synthetic data generated in the repo. The demo replays a recorded live run of the models. Throughline does not diagnose, triage, or interpret results.
