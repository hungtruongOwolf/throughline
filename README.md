# Throughline

One thread through the whole hospital visit — before, during, and after — run by a fleet of agents that know where every patient is, what comes next, and when a human needs to step in. Built for the Meta Global AI Developer Hackathon (Oct 27 – Nov 4, 2026).

> Synthetic demo data only. Throughline is administrative software: it never diagnoses, triages, interprets results, or gives medication advice. Symptom questions go to a human nurse line.

_Work in progress. The full spec is in [`docs/SPEC.md`](docs/SPEC.md)._

## How it works

```
Referral → [intake] → [eligibility] → [authorization ⟂ approve] → [scheduler] → [prep] → [messenger ⇄ patient]
      ↓ journey.appointments, prep_plan, memory
Arrival → [itinerary ← sensing (SAM)] ⇄ [companion ⇄ patient] ← [results_watcher ← LIS]
      ↳ bottleneck → [ops → engine what-if → proposal ⟂ approve] → re-plan
      ↓ actuals, orders, instructions
Checkout → [discharge ⟂ review] → teach-back → [followup → scheduler] → [results_watcher → ack] → ReferralClosed
```

## What is real vs simulated

_To be completed as components land. See [`docs/DO-NOT-CLAIM.md`](docs/DO-NOT-CLAIM.md)._

## Models and sponsors

| Use                                  | Model                                        |
| ------------------------------------ | -------------------------------------------- |
| Reasoning, vision, structured output | `muse-spark-1.3` (Meta Model API)            |
| People counting, door/elevator boxes | `sam-3.1`                                    |
| Voice replies (EN/ES)                | `muse-voice-transcribe-1.0`                  |
| Prep cards, synthetic frames         | `muse-image-1.0`                             |
| Private tier                         | `meta-models/Muse-Glimmer-30B` on Modal      |
| Open-weight ops brain                | Muse Spark Open 816B-A42B on Modal / Baseten |

## Setup

Requires Node 22, pnpm 10, and (for the engine) Rust stable with `wasm32-unknown-unknown` and wasm-pack.

```sh
pnpm install
cp .env.example .env   # add your keys
pnpm build
pnpm dev               # runtime on :4000, web on :3000
```

## Non-goals

No diagnosis, triage, result interpretation, or medication guidance; no real SMS/phone network; no real EHR/FHIR server; no BLE beacons or GPS; no 3D engine; no real cameras; no HIPAA claim.

## Team

- Hung Truong (@hungtruongOwolf)

## Docs

[Spec](docs/SPEC.md) · [Design](docs/DESIGN.md) · [Demo script](docs/DEMO-SCRIPT.md) · [Do not claim](docs/DO-NOT-CLAIM.md) · [Built during the hackathon](docs/BUILT-DURING-HACKATHON.md) · [Decisions](docs/DECISIONS.md)

## Credits

Architecture pattern (event → capability → gate → handler, park-and-replay) inspired by the open EIR project. Fonts: Atkinson Hyperlegible (Braille Institute), Barlow Condensed. License: MIT.
