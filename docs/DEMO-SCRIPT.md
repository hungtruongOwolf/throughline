# Demo script

Copy of SPEC.md sections 10.3–10.5. Voice-over lines are added on Day 4.

## 10.3 The scripted scenario (Maria Diaz, synthetic patient 001, Spanish-speaking, 71)

- Nov 10, 08:12 — referral fax and insurance card arrive. Extraction finds everything except the member id suffix → `ClarificationNeeded`, coordinator answers from the card crop. Eligibility: active, $40 specialist copay, CT requires authorization.
- Nov 10, 08:20 — prior-auth packet drafted; HELD; coordinator submits; synthetic payer approves Nov 12.
- Nov 12, 09:00 — scheduler proposes two visit days: Nov 14 08:00 labs; Nov 17 09:30 CT, 10:40 vitals, 11:00 Dr. Okafor (2A), 12:30 infusion. Alternative: Nov 18/21. Prep plan sent in Spanish with three cards; reminders at 72 h and 24 h.
- Nov 13, 17:05 — Maria replies by voice: "Sí, confirmo. Pero mi esposo no puede venir, voy a necesitar una silla de ruedas." → intent confirm + `mobility = wheelchair` + `companion_present = false`; itinerary rules switch to elevator-only; a volunteer escort task is created for arrival.
- Nov 17, 09:12 — kiosk check-in in Spanish; itinerary printed; the line appears on her phone and on the ops map.
- Nov 17, 09:40 — disruption: CT 1 down until 10:25. Sensing shows imaging wait climbing (frames with SAM boxes visible in the ops corner). 09:46 `BottleneckDetected`.
- Nov 17, 09:47 — ops proposes "move 3 scheduled CT 1 patients to CT 2 and open the 10:00 CT 2 slot" with what-if evidence (wait 22 → 13 min, 4 journeys affected); manager approves; replan: Maria's CT moves to CT 2 at 10:05 and vitals moves after CT; her phone shows the swap with the reason.
- Nov 17, 09:58 — she lingers at the café; `PatientLost` timer nudges her; she photographs the "Elevator A" sign; directions to Level 2 by elevator; SAM highlights the elevator doors in her photo.
- Nov 17, 10:52 — labs resulted (status only); provider stop can start; 11:05 Dr. Okafor; 11:35 provider sign-off → infusion pharmacy prep 35 min → 12:15 infusion chair; 14:30 checkout. KPIs: planned 310 min vs actual 318; 2 replans; 1 direction request.
- Nov 17, 14:31 — summary drafted beside the provider's verbatim instructions; provider approves; sent in Spanish with the disclosure line. Nov 18 teach-back: one wrong answer ("when is your next visit") → nurse call task. Follow-ups booked: repeat labs Dec 5, visit Dec 8. Nov 19: CT read acknowledged late → `ResultAckOverdue` clinician task at 48 h → acknowledged. Nov 20 logistics check-in: ride confirmed. Referral closed with a report to Northgate Family Medicine.

## 10.4 The 3-minute video (recorded on the Journey Control page, 1080p, English voice-over, captions)

| Time      | Beat                                                                                                                                                                                                                | On screen                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 0:00–0:15 | One sentence of problem: 121 minutes at the hospital, 20 with a clinician; staff spend half an hour a week giving directions; 79% of patients misunderstand a medication change.                                    | The line draws across the three phases                            |
| 0:15–0:55 | Before: fax in → packet with source crops → HELD auth → approve → plan with explanation and alternative → prep cards → voice reply in Spanish → wheelchair memory → plan updates                                    | Intake screen, then the phone frame; clock at 60×                 |
| 0:55–2:05 | Visit day: kiosk → the line on the map → CT 1 down → SAM counts climbing → proposal with what-if slider → approve → her phone swaps stops with the reason → sign photo → directions → results → infusion → checkout | Journey Control with the three frames; clock at 10× between beats |
| 2:05–2:40 | After: summary beside verbatim instructions → approve → Spanish summary with disclosure → teach-back miss → nurse task → follow-ups booked → result ack overdue → closed report                                     | Review screen, phone frame, cascade                               |
| 2:40–3:00 | Proof drawer: live call counts per Meta model, Spark Open toggle, Glimmer private tier, engine version, "Simulated in this demo" list; one line on what we did not build (no clinical outputs)                      | Proof drawer, then the README                                     |

## 10.5 Backups and failure handling during the demo

- `MODEL_CACHE=replay` runs the identical scenario from recorded responses; the proof panel labels every replayed call. The judges' public deployment runs this mode by default with a "Run live" switch.
- Each phase can be jumped to from the scrubber; `pnpm demo:reset` restores the start state in < 5 s.
- If the Modal Glimmer endpoint is cold, `TIER_MODE=cloud_only` is applied automatically after a 20 s timeout and the panel says so; if Spark Open is unreachable, `OPS_BRAIN=cloud` is used and recorded.
- If the voice path fails, the typed reply path is identical and the script continues.
- The video is recorded in segments per phase so a single failure never forces a full re-record; a full dry run is done on Day 4 evening and again on Day 5 morning.
