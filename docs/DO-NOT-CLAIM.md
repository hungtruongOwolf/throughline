# Do not claim

Verbatim list for the README, the video, and the Devpost page (SPEC.md 11.3). Update it whenever a new simulated component is added.

1. Throughline does not diagnose, triage, treat, or interpret results, and we do not claim it reduces clinical risk.
2. All patients, providers, documents, payers, cameras, SMS, voice calls, lab systems, and the clock are simulated; the demo runs on synthetic data generated in this repo.
3. The hospital is fictional; walking times, service times, and queue baselines are assumptions in `campus.json`, not measurements.
4. The no-show score is a fixed heuristic, not a trained or validated model.
5. The PHI-tier router demonstrates an architecture; it is not a HIPAA compliance claim. No BAA exists with any provider used here.
6. Wait estimates are estimates from counts and service-time assumptions; the UI always shows the source (sensed, tickets, simulation).
7. Problem numbers quoted in the pitch come from the cited studies and vendor reports (121 min / 20 min, 31.8 min per week of directions, 79% misunderstanding medication changes, 7.1% of abnormal results never communicated); they describe the US problem, not results we measured.
8. The public demo replays a recorded live run: every model output shown came from a real call, recorded in `fixtures/model-cache.sqlite` and marked `replayed` in the runtime's call records. The README says so; nothing replayed is described as a live call.
9. The private tier for identifiable data (Muse Glimmer on Modal) is designed in the spec but not built; model calls in the demo go to the Meta Model API and to Baseten.
10. Everything in this repo was built during Oct 27 – Nov 4, 2026, except the third-party libraries listed in `package.json` and `Cargo.toml`; the architecture pattern (event → capability → gate → handler, park-and-replay) is inspired by the open EIR project and is credited.
