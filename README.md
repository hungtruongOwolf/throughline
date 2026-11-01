# Throughline

Throughline follows a cancer patient through her hospital visit, from the faxed referral to the closed loop weeks later. Agents do the administrative work around the care: reading the referral, the insurance approval request, scheduling, the plan for the day, directions inside the hospital, and the follow-up. A person signs off at every step that matters. Built for the Meta Global AI Developer Hackathon (Oct 27 to Nov 4, 2026).

**Try it:** https://throughline-zeta-ten.vercel.app. The front page shows Halden Medical Center on the morning of Nov 17: about 30 referrals in progress, a CT scanner down, and the work waiting for each person. Sign in as the referral coordinator, the nurse, the oncologist, or the operations lead (no password), or open the patient app with an example visit code. **New referral** receives a fax from the fax line and the agents start on it in front of you.

> Throughline is administrative software. It never diagnoses, triages, interprets results, or gives medication advice. A medical question always goes to a nurse.

## What it does

Every screen is built for a person with a job: the coordinator's **Inbox** puts each agent draft beside its source (the fax, the payer rule, the doctor's notes) with one decision; **Referrals** shows who holds the next move for every patient; each **patient record** is a timeline of what each agent did, with the model it ran on; **Agents** shows the 13 agents with their runs, how often they finished on their own, waited for staff, or handed to a nurse, and their guardrails; **Today** is the visit-day command center. One of the referrals, Maria Diaz, is followed below.

### One referral, end to end

| Phase     | What happens                                                                                                                                                                                                                                                                                                                                                                       | Who decides                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Before    | Spark vision reads the faxed referral. A smudged member ID becomes a question for the coordinator, not a guess. Throughline checks eligibility and drafts the insurer's approval request. It then books five appointments into one morning, on a day Maria's daughter can drive her. Maria confirms by voice note; Voice Transcribe and Spark pick up that she needs a wheelchair. | The coordinator sends the insurance request |
| Visit day | SAM 3.1 counts people in the waiting rooms, and the plan updates. A CT scanner breaks down. The Rust engine runs the rest of the day 20 times for each possible fix, and **Muse Spark Open** (open weights, on Baseten) writes one proposal. Maria takes a photo of a sign when she is lost, and Spark reads it to direct her. Her medical question goes to a nurse.               | The operations manager approves the fix     |
| After     | Follow-ups are booked with the engine. Spark restates the doctor's notes in plain words beside the verbatim text. A day later, three teach-back questions check Maria understood; an unsure answer becomes a nurse call. Results are acknowledged, a day-3 check-in follows, and the referring doctor gets a closure report.                                                       | Dr. Okafor approves the summary             |

```
Referral → [intake] → [eligibility] → [authorization ⟂ approve] → [scheduler] → [prep] → [messenger ⇄ patient]
Arrival  → [itinerary ← sensing (SAM)] ⇄ [companion ⇄ patient] ← [results_watcher]
             ↳ bottleneck → [ops: engine what-if → Spark Open proposal ⟂ approve] → re-plan
Checkout → [followup → engine] → [discharge ⟂ clinician] → teach-back → check-in → ReferralClosed
```

Every agent follows one contract: event → capability → safety gate → handler. A model agent must call exactly one validated tool, gets one retry, and otherwise falls back to a deterministic rule. Each gated action waits for a person and then replays exactly as it was proposed.

## Meta models

| Use                                                                                                                 | Model                         | Where                         |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------- |
| Fax reading (vision, structured output), summaries, teach-back grading, patient messages, reply intent, sign photos | `muse-spark-1.3`              | Meta Model API                |
| Ops proposals (open weights)                                                                                        | `meta-models/muse-spark-open` | Baseten (switch: `OPS_BRAIN`) |
| Counting people in waiting-room frames                                                                              | `sam-3.1`                     | Meta Model API                |
| Patient voice notes                                                                                                 | `muse-voice-transcribe-1.0`   | Meta Model API                |
| The waiting-room camera frames SAM counts                                                                           | `muse-image-1.0`              | Meta Model API                |

Measured with live calls (`docs/evals/`):

- Referral fax reading: **10/10** runs valid, each with the smudged ID flagged rather than guessed.
- Clinical-question screen on 60 clinical and 40 everyday prompts (EN/ES): keywords catch 60/60 and Spark catches 60/60, with **0** false positives.

## What is real and what is simulated

**Real:**

- the agents, gates, event log, and replay;
- the Rust scheduling and queue engine (WASM in the browser and on the server);
- every model call, recorded from live runs;
- the web app.

**Simulated:**

- the patient, the providers, the documents, the hospital, and the insurer;
- the SMS channel, the lab system, the cameras (frames generated with Muse Image), and the clock.

All of it is synthetic, generated in this repo, and every record carries `synthetic: true`.

**The public demo replays a recorded live run.** Every model output on the site came from a real call to the models above. That call was recorded in `fixtures/model-cache.sqlite`, and the deployed runtime serves it without API keys. To run it live, use `MODEL_CACHE=off` with keys (see Setup). See [`docs/DO-NOT-CLAIM.md`](docs/DO-NOT-CLAIM.md).

**Not built:**

- the private tier for identifiable data (Muse Glimmer on Modal), designed in the spec;
- real SMS or EHR integration;
- a HIPAA claim.

## Setup

You need Node 22, pnpm 10, Rust stable with `wasm32-unknown-unknown`, and wasm-pack.

```sh
pnpm install
pnpm build:engine
cp .env.example .env    # replay works without keys; add META_API_KEY / BASETEN_API_KEY for live
pnpm dev                # runtime on :4000, web on :3000 → http://localhost:3000/story
```

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test` (runtime, engine, shared), and `pnpm test:e2e` (Playwright).

Re-record the live run: `pnpm --filter @throughline/runtime record:story`.

Deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Repo

- `apps/runtime`: Node service with agents, gates, event log, sim clock, model clients, and the record/replay cache.
- `apps/web`: Next.js app with the story, the patient page, wayfinding, the command center, and the station boards.
- `packages/engine`: Rust engine for scheduling, the discrete-event queue simulation, and what-if.
- `packages/shared`: types, events, state machine, and copy.
- `packages/synthetic`: data generators.
- `packages/hospital`: campus, floor plans, and signs.

## Docs

[Spec](docs/SPEC.md) · [Decisions](docs/DECISIONS.md) · [Built during the hackathon](docs/BUILT-DURING-HACKATHON.md) · [Do not claim](docs/DO-NOT-CLAIM.md) · [Deploy](docs/DEPLOY.md) · [UX research](docs/UX-RESEARCH.md)

## Team

- Hung Truong (@hungtruongOwolf)

## Credits

The architecture pattern (event → capability → gate → handler, park-and-replay) is inspired by the open EIR project. Fonts: Atkinson Hyperlegible (Braille Institute), Barlow Condensed, Courier Prime. License: MIT.
