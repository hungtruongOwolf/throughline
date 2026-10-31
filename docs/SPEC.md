# Throughline — Build Spec for Claude Code

Meta Global AI Developer Hackathon · build window Oct 27 – Nov 4, 2026 · submission due Wed Nov 4, 9:00 PM ET.
Companion doc (same content, with the flow diagram): https://claude.ai/artifact/PfX5JdL3g7vuim77ych2tB

Start with section 0, then work section 13 (the ordered task list) top to bottom. Everything else is reference.

## Contents

0. Read me first
1. Product
2. The end-to-end journey (before, visit day, after)
3. Hospital model: Halden Medical Center
4. Architecture
5. Domain model
6. Agents
7. Engine (Rust → WebAssembly)
8. Meta models and sponsor infrastructure
9. Frontend and design
10. Synthetic data and the demo
11. Safety, compliance posture, and claims
12. Testing and quality gates
13. Build plan: five days, ordered tasks with "done when"
14. Repo layout, environment, commands, conventions
15. Decisions log and open questions

---

## 0. Read me first (for Claude Code)

This document is the single source of truth for building **Throughline** during the Meta Global AI Developer Hackathon (build window Oct 27 – Nov 4, 2026; submission due **Wed Nov 4, 9:00 PM ET**). Work from it top to bottom; section 13 is the ordered task list with acceptance criteria.

**How to use this spec**
- Treat every numbered section as a contract. Where the spec is silent, choose the simplest option that keeps the demo in section 10 working, and record the choice in `docs/DECISIONS.md`.
- Before writing any UI, load the `frontend-design` skill and produce the design plan described in section 9. Do not skip it; the client has rejected generic AI-looking interfaces.
- Keep `docs/BUILT-DURING-HACKATHON.md` and `docs/DO-NOT-CLAIM.md` current from day one. Judges disqualify entries that cannot show what was built during the event.
- Prefer small, verifiable increments: each task in section 13 has a "done when" line. Run tests before marking anything done.

**Rules that never bend**
1. **No clinical outputs.** Throughline never diagnoses, triages, interprets lab values, recommends treatments, or changes medication. Symptom questions are routed to a human (nurse line). This is required by the hackathon rules ("AI that generates and gives medical advice" is disqualified) and by US law (FDA device line; see section 11).
2. **Synthetic data only.** No real patient data, ever, including in tests, fixtures, screenshots, and the demo video. Every synthetic record carries `synthetic: true`.
3. **Every model-driven action goes through exactly one required tool** whose arguments are validated in code. The model proposes; code decides what is allowed to happen.
4. **Humans gate consequential actions.** Prior-auth submission, operational changes (staffing, diverting patients), and any message that contains clinical content stop at an approval and resume only after a person approves.
5. **Say what is real.** The UI shows which model tier handled each call and which adapters are simulated. Never present a simulated call, camera, or SMS as real.
6. **English everywhere** in product, code, docs, and demo. Spanish is a supported patient language.

**Decisions already made (do not reopen without a reason in DECISIONS.md)**
- Stack: TypeScript monorepo (Next.js web app + Node runtime service) and a **Rust engine compiled to WebAssembly** for simulation and planning. Python only for Modal deployment scripts. Rationale in section 4.
- Hospital: a fictional campus, **Halden Medical Center**, modeled on the structure of a large US academic cancer center (section 3). Map rendering is isometric SVG, not 3D.
- Models: Muse Spark 1.3 (reasoning, vision, structured output), SAM 3.1 (counting and locating), Muse Voice Transcribe (speech, EN/ES), Muse Image (illustrated prep cards and synthetic test frames). Open-weight tier: Muse Spark Open on Modal or Baseten; Muse Glimmer 30B on Modal for the private tier if time allows.
- Demo persona: **Maria Diaz**, 71, Spanish-speaking, synthetic, new oncology referral scheduled as two visit days (labs first; then CT, oncologist, and same-day infusion), wheelchair after her voice reply.

**What "done" means for the hackathon**
A public repo, a deployed demo URL, a 3-minute video showing the three phases on one journey with one live disruption and one human approval, a README that lists team members and what was built during the event, and an X post with the demo link.


---

## 1. Product

**Name:** Throughline. **One-liner:** one thread through the whole hospital visit — before, during, and after — run by a fleet of agents that know where every patient is, what comes next, and when a human needs to step in.

**The problem (US, sourced in the research doc)**
- A typical ambulatory visit takes 121 minutes, of which 20 are with the clinician; the rest is travel, forms, and waiting (Ray et al., AJMC 2015).
- Same-day cancer-center visits chain labs → provider → infusion; bottlenecks appear at phlebotomy, infusion chairs, and pharmacy, and patients occupy chairs waiting for lab results (Johns Hopkins Bayview, JHOP 2023; Mays Cancer Center/LeanTaaS).
- Hospital staff spend ~32 minutes a week each giving directions; 46% say it distracts from their duties (Jamshidi et al., HERD 2025, n=301).
- Only ~54% of referrals become a scheduled appointment; 15–20% of appointments are no-shows; 79% of discharged patients misunderstand at least one medication change; 7% of abnormal results are never communicated.
- No vendor found routes patients between departments based on live queue length; queue tools and wayfinding tools are sold separately.

**What Throughline does**
A durable **Journey** opens when a referral arrives and closes when the referral loop is reported back. Agents hand state to each other across three phases:
1. **Before:** extract the referral and insurance card, check eligibility, draft prior authorization, schedule dependent appointments in as few visit days as possible, send an illustrated prep plan, confirm by text or voice (EN/ES).
2. **Visit day:** plan the in-building itinerary from live queue estimates (camera counts + ticket data) and walking distances, give turn-by-turn directions, notify when results are ready, detect bottlenecks, propose operational actions for human approval, re-plan everyone affected.
3. **After:** send the after-visit summary (provider-reviewed or AI-disclosed), run a 24-hour teach-back, book follow-ups from orders, track results until a clinician acknowledges them, run a logistics check-in, and close the loop with the referring provider.

**Personas and what each can do**

| Persona | Surface | Can do |
|---|---|---|
| Patient / family (incl. older adults, Spanish speakers) | Phone (SMS-style thread + web), check-in kiosk, voice | Confirm or change appointments by text or voice; see prep plan; see "next stop, people ahead, minutes"; photograph a sign to get directions; get result-ready and follow-up notices; always reach a human |
| Clinic nurse / front desk | Station board | See who is on the way and when, who has results back, who is lost, handoff requests; resolve handoffs |
| Operations manager | Command center | Live campus map with queue heat; bottleneck alerts; agent proposals with predicted effect; approve/reject; audit replay; KPI strip |
| Scheduler / referral coordinator | Work queue | Review extracted referrals, approve prior-auth packets, override schedules |
| Judges (demo) | Journey Control page | Start a journey, fast-forward through phases, inject a disruption, see the proof panel |

**Non-goals (write them in the README)**
No diagnosis, triage, result interpretation, or medication guidance; no real SMS/phone network (simulated threads, Twilio optional behind a flag); no real EHR/FHIR server (FHIR-shaped JSON fixtures); no BLE beacons or GPS (localization by sign photo and station check-in); no 3D engine; no real cameras (synthetic frames); no HIPAA claim.

**Hackathon judging mapping**

| Criterion | Where Throughline scores |
|---|---|
| Impact 30% | Documented US pain points with numbers; an end-to-end journey nobody automates today; before/after KPIs from simulation (labeled as simulation) |
| Use of Meta AI tooling 25% | SAM 3.1 ↔ Spark sensing loop; Voice Transcribe EN/ES intake → structured actions; Spark vision for referral faxes, insurance cards, and signage; Muse Image prep cards; open-weight tier on Modal/Baseten |
| Technical depth 20% | Event-sourced journey runtime with park-and-replay approvals; Rust engine (simulation + solver) in WASM running in browser and server; PHI tier router; invariant tests |
| Demo 25% | One patient, three phases, time control, one live disruption, one approval, three screens side by side |
| Bonus: Best Agentic Use-Case | Multi-step autonomy with explicit stopping points |
| Bonus: Best Build on Open Weights | Planner and ops agents run on Muse Spark Open via Modal or Baseten with a visible switch |
| Bonus: Community Vote / Most Viral | "121 minutes, 20 with the doctor" story; post the 3-screen demo on X |


---

## 2. The end-to-end journey (one patient, three phases, explicit handoffs)

The product is one state machine, not three features. Each phase ends by leaving structured state that the next phase consumes without a human re-entering it. The table below is the reference flow for Maria Diaz (synthetic); every row names the event that fires, the agent that handles it, and whether a human gates it.

### 2.1 Before the visit

| Step | Trigger / event | Agent | What happens | Hand-off state | Gate |
|---|---|---|---|---|---|
| B1 | `ReferralReceived` (fax PDF or photo + insurance card image dropped into the intake queue) | referral_intake | Spark 1.3 vision extracts a `ReferralPacket`: patient attributes, referring provider, diagnosis code as written (stored, never interpreted), requested services, urgency flag as written, documents list. Missing fields produce `ClarificationNeeded` with a plain question. | `journey.patient`, `journey.referral`, `journey.orders[]` (requested services become orders) | none |
| B2 | `IntakeExtracted` | eligibility | Deterministic rules against a synthetic payer table: plan active, copay, which orders need prior authorization. | `journey.coverage`, `orders[].auth_required` | none |
| B3 | `EligibilityChecked` with any `auth_required` | authorization | Spark drafts a prior-auth packet from the referral and orders (admin document assembly). | `journey.auth_packets[]` status `draft` | **Submission is PRE_APPROVAL**: coordinator reviews and submits; a synthetic payer responds after a simulated delay |
| B4 | `PriorAuthDecided` (or no auth needed) | scheduler | Engine `schedule()` chains dependent appointments: labs resulted ≥ 48 h before oncologist; CT only after auth approved; infusion same day after oncologist; patient availability and preferences (language, mobility, mornings) from memory. Goal: fewest distinct visit days, then shortest span. Spark explains the plan in plain language and offers one alternative. | `journey.appointments[]` with dependencies and `visit_days[]` | Auto-book if patient confirms; coordinator can override |
| B5 | `AppointmentsBooked` | prep | Builds a `PrepPlan`: what to bring (card, ID, med list as written by provider), fasting window copied from the order text, parking and entrance, estimated time on site from the engine, transport need. Muse Image renders 2–3 illustrated cards (entrance, lab draw, infusion lounge) with consistent style. | `journey.prep_plan` | none |
| B6 | `PrepPlanSent` | messenger | Sends SMS-style messages in the patient's language; schedules reminders at 72 h and 24 h; records delivery. | `journey.outreach_log[]` | none |
| B7 | `PatientReplied` (text or voice note) | messenger | Voice Transcribe (EN/ES) → Spark intent extraction via required tool `handle_reply` → confirm / reschedule / question / human. Reschedule re-runs B4. Any symptom content → `HandoffRequested`. | `journey.confirmation`, memory keys (`preferred_language`, `mobility`, `preferred_time`) | Handoff is BLOCKING |
| B8 | 24 h before: `VisitConfirmed` | scheduler | Engine predicts a no-show risk score from simple features (lead time, confirmation, distance); if high, messenger offers a waitlist slot to another synthetic patient. | `journey.visit_confirmed` | none |

### 2.2 Visit day

| Step | Trigger / event | Agent | What happens | Hand-off state | Gate |
|---|---|---|---|---|---|
| V1 | `PatientArrived` (kiosk check-in or QR scan at the welcome desk; voice allowed) | companion | Confirms identity attributes already on file (no new PHI collection), prints/sends the itinerary QR. | `journey.phase = VISIT` | none |
| V2 | `ItineraryPlanned` | itinerary | Engine `plan_itinerary()` orders today's stops using live `QueueState` per station, walking times from the campus graph, and constraints (fasting first, labs before oncologist, infusion after provider sign-off). Output: ordered stops with ETAs and the reason for the order. | `journey.itinerary` | none |
| V3 | Every 60 s (sim time): `QueueStateUpdated` | sensing | SAM 3.1 counts `person` in each waiting-area frame; counts are fused with ticket data (EMA) and converted to minutes with Little's law. If the deviation from the plan exceeds 10 minutes, `ItineraryReplanned` fires for affected journeys. | `station.queue_state` | none |
| V4 | `StopStarted` / `StopCompleted` (QR scan at the station, staff tap, or simulator) | itinerary + companion | Advances the itinerary; sends "next stop" with people ahead and minutes; staff board shows arrival ETA. | `journey.itinerary[i].status` | none |
| V5 | `PatientLocated` (patient photographs the nearest sign) | companion | Spark reads the sign text; the signage registry maps it to a graph node; A* gives turn-by-turn landmark directions; SAM 3.1 highlights the door/elevator in the photo. | `journey.last_location` | none |
| V6 | `ResultReady` (LIS status event from the simulator) | results_watcher | Marks the order as resulted (status only), notifies patient and clinic, triggers re-plan so the provider stop can start. | `orders[].status = resulted` | none |
| V7 | `PatientLost` (no check-in at the next stop within ETA + 12 min) | companion | Sends a nudge; if no reply in 5 min, creates a staff task on the station board. | `journey.lost = true` | Staff task |
| V8 | `BottleneckDetected` (queue minutes > threshold for 3 consecutive samples) | ops | Runs the engine simulation as a tool for 2–3 candidate actions (open a second phlebotomy chair, divert N patients to CT-2, call a volunteer to the lobby), compares predicted wait reduction, proposes the best with evidence. | `ops_actions[]` status `proposed` | **`ops_action.apply` is PRE_APPROVAL**: manager approves; then itineraries re-plan for affected journeys |
| V9 | Patient asks a clinical question in chat | companion | Refuses to answer clinically, creates `HandoffRequested` for the nurse line, keeps logistics help available. | `journey.handoff_open` | BLOCKING |
| V10 | `VisitCheckedOut` | itinerary | Closes the day; stores actual vs planned times for KPIs. | `journey.phase = POST` | none |

### 2.3 After the visit

| Step | Trigger / event | Agent | What happens | Hand-off state | Gate |
|---|---|---|---|---|---|
| A1 | `VisitCheckedOut` | discharge | Assembles the after-visit summary from provider-entered instructions verbatim (synthetic), restated in plain language in the patient's language. | `journey.summary` status `draft` | **`summary.send` is PRE_APPROVAL** when a provider review is configured; otherwise the message carries the AI disclaimer and human-contact line (California AB 3030 pattern) |
| A2 | `SummarySent` + 24 h | discharge | Teach-back by message: three questions that check understanding of logistics and instructions (when is the next visit, what to bring, who to call). Wrong or "not sure" → staff task for a nurse call. | `journey.teachback` | Staff task |
| A3 | `VisitCheckedOut` with follow-up orders | followup | Engine `schedule()` books follow-ups and repeat labs with the same dependency rules; messenger confirms. | `journey.appointments[]` | Auto-book; coordinator override |
| A4 | `ResultReady` for any order | results_watcher | Tracks until `ResultAcknowledged` by the ordering clinician (status only); after 48 h unacknowledged, `ResultAckOverdue` creates a clinician task. | `orders[].ack` | Clinician task |
| A5 | Day +3 | followup | Logistics check-in: medication picked up? ride to the next visit? want a nurse call? Answers never interpreted clinically. | `journey.logistics_checkin` | Staff task if "want a nurse call" |
| A6 | All follow-ups booked and results acknowledged | followup | `ReferralClosed`: report to the referring provider (dates, completed services, pending items). | `journey.phase = COMPLETED` | none |

### 2.4 What is automated and what a human gates

Automated end to end: extraction, eligibility, scheduling, prep plan, reminders, confirmations, itinerary planning and re-planning, directions, result-ready notices, follow-up booking, result-acknowledgment tracking, loop closure. Human-gated: prior-auth submission, operational actions, summaries with clinical content when provider review is on, anything symptom-related (nurse), lost-patient escalation, teach-back failures. The Journey Control page shows both lists so judges see the boundary.

Text diagram of the handoffs:

```
Referral → [intake] → [eligibility] → [authorization ⟂ approve] → [scheduler] → [prep] → [messenger ⇄ patient]
      ↓ journey.appointments, prep_plan, memory
Arrival → [itinerary ← sensing (SAM)] ⇄ [companion ⇄ patient] ← [results_watcher ← LIS]
      ↳ bottleneck → [ops → engine what-if → proposal ⟂ approve] → re-plan
      ↓ actuals, orders, instructions
Checkout → [discharge ⟂ review] → teach-back → [followup → scheduler] → [results_watcher → ack] → ReferralClosed
```


---

## 3. Hospital model: Halden Medical Center (fictional)

Halden Medical Center is a fictional campus whose structure follows large US academic cancer centers: a main pavilion with lobby, registration, lab draw, imaging, and pharmacy; a separate cancer-center tower with clinic pods and an infusion center; a parking garage joined by a skybridge; two routes between the buildings (a ground-level covered walkway and a level-2 link bridge); color-coded zones on signage. Nothing here copies a real hospital's floor plan. All geometry lives in `packages/hospital/campus.json`; the renderer and the engine both read that file, so the map, the walking times, and the simulation never disagree.

### 3.1 Buildings, floors, zones

| Building | Floor | Zone (sign color) | What is there |
|---|---|---|---|
| Main Pavilion (MP) | L1 | Blue | Main entrance, lobby and welcome desk, registration kiosks and desks, outpatient lab draw (phlebotomy, 6 chairs) with waiting area, outpatient pharmacy, café, Elevator A, door to the Garden Link |
| Main Pavilion (MP) | L2 | Gold | Imaging (CT-1, CT-2, X-ray, MRI) with waiting area, financial counseling, skybridge to the garage, level-2 link bridge to the Cancer Center |
| Parking Garage (G) | L2 | Gold | Garage level 2 skybridge entrance, patient parking |
| Garden Link (GL) | ground | Green | 110 m covered outdoor walkway between MP L1 and the Cancer Center lobby |
| Cancer Center (CC) | L1 | Green | Cancer Center lobby, Elevator B, radiation oncology (out of demo scope) |
| Cancer Center (CC) | L2 | Rose | Vitals station, Medical Oncology Clinic pods 2A and 2B (12 exam rooms each) with waiting areas, nurse station, link bridge landing |
| Cancer Center (CC) | L3 | Violet | Infusion Center (24 chairs) with waiting area, infusion pharmacy (staff only), patient and family lounge |

### 3.2 Walking graph

Nodes are rooms, waiting areas, corridor junctions, elevator landings, and bridge ends. Edges carry walking seconds at 1.2 m/s; elevators are 90 s (wait + ride) per trip regardless of floors; stairs are 45 s per floor and are excluded when `journey.mobility = wheelchair`. Coordinates are meters on a campus grid (origin at the MP south-west corner, x east, y north) plus a floor index; the renderer projects them to isometric space.

| Node id | Building/floor | x, y | Kind | Sign text (registry) |
|---|---|---|---|---|
| mp1.entrance | MP L1 | 10, 30 | entrance | "Main Entrance" |
| mp1.lobby | MP L1 | 30, 30 | lobby | "Main Lobby · Welcome Desk" |
| mp1.registration | MP L1 | 30, 50 | station | "Registration & Check-in" |
| mp1.cafe | MP L1 | 50, 10 | amenity | "Café" |
| mp1.elevA | MP L1 | 60, 15 | elevator | "Elevator A" |
| mp1.corr_a | MP L1 | 60, 30 | junction | "Blue Zone" |
| mp1.lab_wait | MP L1 | 85, 50 | waiting | "Outpatient Lab · Waiting" |
| mp1.lab_draw | MP L1 | 95, 50 | station | "Lab Draw" |
| mp1.pharmacy | MP L1 | 100, 15 | station | "Outpatient Pharmacy" |
| mp1.garden_door | MP L1 | 115, 30 | door | "Garden Link → Cancer Center" |
| mp2.elevA | MP L2 | 60, 15 | elevator | "Elevator A · Level 2" |
| mp2.corr_b | MP L2 | 75, 30 | junction | "Gold Zone" |
| mp2.imaging_wait | MP L2 | 95, 45 | waiting | "Imaging · Waiting" |
| mp2.ct1 | MP L2 | 105, 55 | station | "CT 1" |
| mp2.ct2 | MP L2 | 110, 45 | station | "CT 2" |
| mp2.xray | MP L2 | 100, 60 | station | "X-ray" |
| mp2.financial | MP L2 | 90, 15 | station | "Financial Counseling" |
| mp2.bridge_g | MP L2 | 40, 55 | bridge | "Skybridge → Parking Garage" |
| mp2.bridge_cc | MP L2 | 120, 30 | bridge | "Link Bridge → Cancer Center Level 2" |
| g2.bridge | G L2 | 40, 80 | bridge | "Garage Level 2 · Skybridge" |
| g2.parking | G L2 | 40, 100 | parking | "Patient Parking" |
| gl.walkway | GL | 150, 30 | walkway | "Garden Link" |
| cc1.lobby | CC L1 | 185, 30 | lobby | "Cancer Center Lobby" |
| cc1.elevB | CC L1 | 200, 15 | elevator | "Elevator B" |
| cc2.elevB | CC L2 | 200, 15 | elevator | "Elevator B · Level 2" |
| cc2.bridge_mp | CC L2 | 170, 30 | bridge | "Link Bridge → Main Pavilion" |
| cc2.corr | CC L2 | 200, 30 | junction | "Rose Zone" |
| cc2.vitals | CC L2 | 215, 20 | station | "Vitals" |
| cc2.wait_2a | CC L2 | 215, 45 | waiting | "Clinic 2A · Waiting" |
| cc2.pod_2a | CC L2 | 230, 45 | station | "Medical Oncology 2A" |
| cc2.wait_2b | CC L2 | 185, 45 | waiting | "Clinic 2B · Waiting" |
| cc2.pod_2b | CC L2 | 170, 45 | station | "Medical Oncology 2B" |
| cc2.nurse | CC L2 | 200, 45 | staff | "Nurse Station" |
| cc3.elevB | CC L3 | 200, 15 | elevator | "Elevator B · Level 3" |
| cc3.infusion_wait | CC L3 | 215, 30 | waiting | "Infusion Center · Waiting" |
| cc3.infusion | CC L3 | 230, 40 | station | "Infusion Center" |
| cc3.lounge | CC L3 | 180, 40 | amenity | "Patient & Family Lounge" |

Edges (walking seconds): entrance–lobby 25; lobby–registration 17; lobby–cafe 38; lobby–corr_a 30; corr_a–elevA 12; corr_a–lab_wait 35; lab_wait–lab_draw 8; corr_a–pharmacy 42; corr_a–garden_door 50; garden_door–gl.walkway 48; gl.walkway–cc1.lobby 47; mp1.elevA–mp2.elevA 90 (elevator); mp1.corr_a–mp2.corr_b 45 (stairs); mp2.elevA–corr_b 17; corr_b–imaging_wait 38; imaging_wait–ct1 12; imaging_wait–ct2 17; imaging_wait–xray 21; corr_b–financial 25; corr_b–bridge_g 50; bridge_g–g2.bridge 58; g2.bridge–g2.parking 33; corr_b–bridge_cc 42; bridge_cc–cc2.bridge_mp 42; cc2.bridge_mp–cc2.corr 25; cc1.lobby–cc1.elevB 21; cc1.elevB–cc2.elevB 90; cc2.elevB–cc3.elevB 90; cc1.elevB–cc3.elevB 90; cc2.elevB–cc2.corr 17; cc2.corr–vitals 21; cc2.corr–wait_2a 29; wait_2a–pod_2a 8; cc2.corr–wait_2b 46; wait_2b–pod_2b 8; cc2.corr–nurse 12; cc3.elevB–infusion_wait 25; infusion_wait–infusion 8; cc3.elevB–lounge 33. Edges are undirected.

### 3.3 Stations (service model shared by the simulator and the solver)

| Station id | Node | Servers | Service time (min, lognormal mean / sd) | Hours | Notes |
|---|---|---|---|---|---|
| registration | mp1.registration | 4 kiosks + 2 desks | 3 / 1.5 | 06:30–17:00 | kiosk path is faster; desk for exceptions |
| lab_draw | mp1.lab_draw | 6 chairs | 6 / 2 | 07:00–16:00 | result turnaround in sim: CBC 45 min, CMP 60 min |
| imaging_ct | mp2.ct1, mp2.ct2 | 2 scanners | 25 / 6 | 07:30–17:00 | demo disruption: CT-1 down 09:40–10:25 |
| imaging_xray | mp2.xray | 1 room | 10 / 3 | 07:30–17:00 | |
| vitals | cc2.vitals | 2 | 5 / 1.5 | 07:30–16:30 | must precede provider |
| clinic_2a | cc2.pod_2a | 4 providers | 20 / 7 | 08:00–16:30 | 20-minute oncologist slots |
| clinic_2b | cc2.pod_2b | 4 providers | 20 / 7 | 08:00–16:30 | |
| infusion | cc3.infusion | 24 chairs | 120 / 40 | 07:00–18:00 | pharmacy prep lead 35 min after provider sign-off |
| pharmacy | mp1.pharmacy | 2 windows | 8 / 3 | 08:00–18:00 | |
| financial | mp2.financial | 2 | 15 / 5 | 08:00–16:00 | optional stop |

Waiting areas with camera frames (for SAM counting): mp1.lobby, mp1.lab_wait, mp2.imaging_wait, cc2.wait_2a, cc2.wait_2b, cc3.infusion_wait. Each has `seats` (lobby 60, lab 24, imaging 30, 2A 28, 2B 28, infusion 20) and a `camera_id`.

### 3.4 Signage registry

Every node has one or more signs: `{ sign_id, node_id, lines: ["Imaging", "Level 2"], arrows: [{ target_node_id, direction: "right" }], zone }`. The companion localizes a patient by matching Spark-extracted sign text to registry lines (normalized, fuzzy ≥ 0.85) and never by face or GPS. The repo also contains an SVG signage renderer that draws every sign in the registry in the campus style (used for demo photos, kiosk screens, and the wayfinding cards), so the signs the model reads are the signs the hospital "has".

### 3.5 Rendering modes

1. **Isometric campus map** (command center hero): 2:1 isometric projection; floors drawn as exploded layers (vertical offset 28 px per floor) with the building outline; stations as blocks whose fill intensity shows queue minutes; waiting areas as hatched zones with the live count; the selected journey drawn as a single transit-style line through its stops; patient dots animate along edges when stops advance. Hover a station: a 30-minute queue sparkline. Click: details and the current ops proposals. Toggle "simulation vs sensed" to show where the count comes from.
2. **Phone map snippet** (patient): a cropped, simplified corridor line from "you are here" to the next stop with 2–3 landmarks, never the whole campus.
3. **Wayfinding cards**: a step list ("Walk to Elevator A, 12 s. Take Elevator A to Level 2. Turn right at the Gold Zone sign.") with one illustrated card per landmark generated once by Muse Image from the campus style and cached per node.
4. **Signage renderer**: SVG signs for every registry entry; also prints the kiosk itinerary ticket (QR + first three stops).

3D is explicitly out of scope; isometric SVG reads faster, prints to the video better, and fits the 5-day budget. Keep the data model 3D-ready (floor index + meters) so a Three.js view could be added later.


---

## 4. Architecture

### 4.1 Stack decision and why

| Layer | Choice | Why (and the alternative we rejected) |
|---|---|---|
| Web app | Next.js 15 (App Router), React 19, Tailwind v4, TypeScript | Fast to build three role shells and a demo page; EIR proved the pattern. |
| Agent runtime | Node 22 service (Hono + `ws`), TypeScript, zod | One language with the web app; the official SAM parser exists for JS (`@meta-sam/parser`); OpenAI-compatible SDK works against Meta's API; WebSocket proxying for Voice is trivial in Node. We rejected Python (two toolchains, two package managers, no shared types) and Next.js route handlers for the runtime (no long-running workers, serverless timeouts). |
| Engine (simulation, itinerary solver, scheduler) | **Rust crate → WebAssembly** (`wasm-pack`, `wasm-bindgen`, `serde`) | Runs identically in the browser (instant what-if, no round trip) and in the Node runtime (same binary, same results). Hot loops (200 patients × 8 hours × 60-second ticks, permutation search) are where speed matters; everything else is bound by model latency, so Rust elsewhere buys nothing. Requested by the client as a learning goal; the contract in section 7 keeps it a bounded risk. |
| Engine fallback | TypeScript implementation of the same interface in `packages/engine-ts` | If the Rust spike (task D1-3) is not green by Day 1 evening, implement in TS and keep the interface; the UI and runtime never know the difference. |
| Persistence | SQLite via `better-sqlite3` + Drizzle (file in a volume) | Zero ops; event log + aggregates + telemetry in one file; Postgres not needed for a demo. |
| Realtime | Server-Sent Events from runtime to web (`/events/stream`) | Simpler than WebSocket for one-way updates; reconnects for free. WebSocket only for the voice proxy. |
| Model clients | `openai` npm SDK with `baseURL` per provider; `@meta-sam/parser`; raw `ws` for Voice; `fetch` for Images | OpenAI-compatible surfaces on Meta API, Baseten, Modal, Fireworks. |
| Deployment | Docker Compose; runtime on Fly.io (persistent volume), web on Vercel; one `DEPLOY.md` | Public URL required by the judges; both free-tier friendly. |
| Deployment scripts for open weights | Python in `infra/modal/` (Modal requires Python) | Only place Python appears. |

### 4.2 Monorepo

```
throughline/
  apps/web          Next.js: patient phone, kiosk, station board, command center, journey control
  apps/runtime      Node service: HTTP API, event bus + worker, agents, model clients, SSE, voice proxy, sim clock
  packages/shared   zod schemas + TS types for Journey, events, capabilities, agents, API contracts (single source)
  packages/hospital campus.json, signage registry, SVG signage renderer, graph utilities (A*, walking matrix)
  packages/engine   Rust crate (sim, itinerary solver, scheduler) + wasm-pack output in packages/engine/pkg
  packages/engine-ts fallback implementation of the engine interface (only if the Rust spike fails)
  packages/synthetic generators: patients, providers, slots, orders, referral PDFs, insurance cards, frames, sign photos
  infra/modal       Python: Muse Glimmer 30B dedicated endpoint; optional SAM self-host
  docs/             SPEC.md (this file), DESIGN.md, DEMO-SCRIPT.md, DO-NOT-CLAIM.md, BUILT-DURING-HACKATHON.md, DECISIONS.md
```
pnpm workspaces + Turborepo; Node 22; Rust stable + `wasm-pack`; one `.env` at the root (section 14).

### 4.3 Runtime loop (borrowed from EIR, adapted)

1. An HTTP route or the simulator **persists an event and publishes it**, then returns. Routes never run workflows.
2. The in-process **EventBus** delivers the event to the **JourneyRuntime** (and to the **OpsRuntime** for station-scoped events). Each runtime subscribes to its own event set; the two sets are disjoint and a test asserts it.
3. The runtime loads the aggregate (Journey or Station), applies the **phase guard** (events for a paused or completed journey are logged and dropped, except approvals and handoffs), then asks the **Orchestrator** for the next capability (`EVENT_TO_CAPABILITY` + state rules).
4. The **Registry** resolves the capability to an agent; the **SafetyGate** returns `allowed`, `requires_human_approval`, or `blocked` (content screening, grant check, PRE_APPROVAL set).
5. If approval is required, the runtime **parks** the triggering event verbatim on a `HumanReview` with `pending_capability`, flips the aggregate to `paused_for_review`, and stops.
6. Otherwise the **AgentRunner** executes the agent: deterministic agents run their handler directly; model agents run a tool loop against the model tier chosen by the **PHI router**, and the runner verifies the **required tool** was called exactly once with arguments that pass the zod schema. Failure → one retry with the validation error in context → deterministic fallback → `used_fallback` telemetry.
7. The handler returns `HandlerResult { summary, state_patch, next_events, review_reason }`. The runtime applies the patch, appends `next_events` to the log, and publishes them unless the capability is BLOCKING (then only `HumanReviewRequested` propagates).
8. `HumanReviewResolved` rebuilds the parked event and replays it with `approved_by` injected into the payload.

Every model call writes a `ModelCallRecord` (tier, provider, model, capability, tools invoked, latency, tokens, success, fallback) that feeds the proof panel; message content is never stored in telemetry.

### 4.4 PHI tier router

`routeModelCall(payload, capability)` classifies the payload: identifiers present (name, DOB, MRN, phone, address, member id, free-text replies, document images) → **private tier** (Muse Glimmer 30B on a Modal dedicated endpoint, or Muse Spark Open on Modal/Baseten); none present (queue counts, station ids, anonymized itinerary facts, ops proposals, sign text) → **cloud tier** (Muse Spark 1.3 on the Meta Model API). Env `TIER_MODE=auto|cloud_only|private_only` forces behavior; `cloud_only` is the hackathon default when credits for Modal are not yet active, and the proof panel says so. All data is synthetic, so this is a demonstration of the control, not a compliance claim.

### 4.5 Time control (simulated clock)

The runtime keeps a `SimClock` (speed 1×, 10×, 60×, or jump). All scheduled work (reminders at 24 h, result turnaround, lost-patient timers, teach-back at 24 h) is registered against the sim clock, not wall time, so the demo can fast-forward through three phases in three minutes. The Journey Control page drives the clock; production would bind the same timers to a real scheduler.

### 4.6 Observability and audit

Audit replay: `/api/journeys/:id/events` returns the full event log; the command center renders it as a cascade (EIR-style waterfall) with HELD markers on approvals. Logs are JSON lines; no PHI in logs (synthetic anyway, but the redaction code path exists and is tested).


---

## 5. Domain model (`packages/shared`, zod schemas are the source of truth)

### 5.1 Journey

```ts
Journey {
  id: string; synthetic: true;
  patient: { id, display_name, dob, language: "en"|"es", mobility: "walking"|"wheelchair", phone_sim: string };
  referral: { received_at, referring_provider, service_requested, documents: DocumentRef[], as_written: { diagnosis_code?: string, urgency?: string } };
  coverage: { plan_id, active: boolean, copay_cents, auth_required_order_ids: string[] };
  orders: Order[];                 // see 5.5
  auth_packets: AuthPacket[];      // status: draft | submitted | approved | denied
  appointments: Appointment[];     // see 5.5
  visit_days: string[];            // ISO dates
  prep_plan?: PrepPlan;
  outreach_log: Message[];
  confirmation?: { confirmed_at, channel };
  phase: "PRE" | "VISIT" | "POST" | "COMPLETED";
  state: JourneyState;             // see 5.2
  itinerary?: Itinerary;           // see 5.5
  last_location?: { node_id, at, source: "checkin"|"sign_photo" };
  lost: boolean; handoff_open: boolean; paused_for_review: boolean;
  summary?: { draft, sent_at?, reviewed_by?, disclaimer_mode: boolean };
  teachback?: { sent_at, answers: {...}, passed?: boolean };
  logistics_checkin?: {...};
  kpis: { planned_minutes_on_site?, actual_minutes_on_site?, walking_seconds?, direction_requests?, replans? };
  memory: Record<MemoryKey, string>; // allowlisted keys only, 5.6
  created_at; updated_at; version: number;
}
```

### 5.2 Phases and states

- `PRE`: `REFERRAL_RECEIVED → INTAKE_EXTRACTED → ELIGIBILITY_CHECKED → AUTH_DRAFTED → AUTH_SUBMITTED → AUTH_DECIDED → SCHEDULED → PREP_SENT → CONFIRMED` (`AUTH_*` skipped when no order needs authorization; `CLARIFICATION_NEEDED` is a side state that returns to `INTAKE_EXTRACTED`).
- `VISIT`: `ARRIVED → PLANNED → ACTIVE → CHECKED_OUT`. While `ACTIVE`, the itinerary holds the detail: each stop is `pending | in_transit | waiting | in_service | done | skipped`.
- `POST`: `SUMMARY_DRAFTED → SUMMARY_SENT → TEACHBACK_PENDING → TEACHBACK_DONE → FOLLOWUPS_BOOKED → RESULTS_ACKNOWLEDGED → REFERRAL_CLOSED`.
- `COMPLETED` is terminal. Cross-cutting flags: `paused_for_review`, `handoff_open`, `lost`.
Transitions are a table in `packages/shared/src/journey/transitions.ts` and a test asserts every event handler only produces allowed transitions.

### 5.3 Event catalog (`type`, emitted by, payload summary)

PRE: `ReferralReceived` (intake queue; documents[]), `IntakeExtracted` (referral_intake; ReferralPacket), `ClarificationNeeded` (referral_intake; question, field), `EligibilityChecked` (eligibility; coverage), `PriorAuthDrafted` (authorization; packet_id), `PriorAuthSubmitted` (human; packet_id, by), `PriorAuthDecided` (payer sim; packet_id, decision), `AppointmentsProposed` (scheduler; plan, alternative), `AppointmentsBooked` (scheduler; appointments[]), `PrepPlanSent` (messenger; message_ids), `ReminderSent` (messenger), `PatientReplied` (channel sim; text | transcript, language), `ReplyHandled` (messenger; intent), `VisitConfirmed` (scheduler), `NoShowRiskScored` (scheduler; score), `WaitlistOffered` (messenger; to_journey_id).

VISIT: `PatientArrived` (kiosk/desk; node_id), `ItineraryPlanned` (itinerary; stops[], reason), `QueueStateUpdated` (sensing; station_id, count, est_wait_min, source), `StopStarted`/`StopCompleted` (scan/staff/sim; station_id), `PatientLocated` (companion; node_id, confidence), `DirectionsSent` (companion; steps[]), `ResultReady` (LIS sim; order_id), `ItineraryReplanned` (itinerary; reason, diff), `PatientLost` (timer), `BottleneckDetected` (sensing; station_id, severity, minutes), `OpsActionProposed` (ops; action, predicted_effect, evidence), `OpsActionApproved`/`OpsActionRejected` (human; action_id, by), `OpsActionApplied` (ops; action_id), `HandoffRequested` (companion/messenger; reason), `HandoffResolved` (human), `VisitCheckedOut` (station/sim).

POST: `SummaryDrafted` (discharge), `SummaryReviewed` (human; by), `SummarySent` (discharge; disclaimer_mode), `TeachbackSent` (discharge), `TeachbackAnswered` (channel sim; answers, passed), `FollowUpsBooked` (followup; appointments[]), `ResultAcknowledged` (clinician sim/human; order_id, by), `ResultAckOverdue` (results_watcher; order_id), `LogisticsCheckinSent`/`LogisticsCheckinAnswered` (followup), `ReferralClosed` (followup; report).

Cross-cutting: `HumanReviewRequested`, `HumanReviewResolved`, `ContentBlocked` (safety gate; category), `MemoryUpdated` (key). Telemetry (not domain): `ModelCallRecorded`.

All events: `{ id, type, journey_id? , station_id?, occurred_at (sim time), payload, synthetic: true }`. Journey events carry `journey_id`; station/ops events carry `station_id`. `JOURNEY_EVENT_TYPES` and `OPS_EVENT_TYPES` partition the catalog.

### 5.4 Capabilities and gates

`referral.extract, referral.clarify, eligibility.check, prior_auth.draft, prior_auth.submit, schedule.plan, schedule.book, prep.compose, message.send, reply.handle, noshow.score, waitlist.offer, itinerary.plan, itinerary.replan, queue.estimate, patient.locate, directions.send, patient.message, result.watch, bottleneck.detect, ops_action.propose, ops_action.apply, handoff.request, summary.draft, summary.send, teachback.run, followup.book, result_ack.track, logistics.checkin, referral.close`.

- `PRE_APPROVAL = { prior_auth.submit, ops_action.apply, summary.send (when provider review is on) }` → park and replay after `HumanReviewResolved`.
- `BLOCKING = { handoff.request }` → execute, open a review, suppress downstream events except `HumanReviewRequested`.
- Agents declare `granted_capabilities`; the gate refuses anything outside the grant.

### 5.5 Supporting types

- `Order { id, kind: "lab"|"imaging"|"visit"|"infusion"|"pharmacy", code_as_written, station_id, duration_min, depends_on: OrderDependency[], auth_required, status: "ordered"|"scheduled"|"in_progress"|"resulted"|"acknowledged", result_ready_at?, acknowledged_by? }`; `OrderDependency { order_id, kind: "resulted_before"|"same_day_after"|"after_auth", min_gap_minutes? }`.
- `Appointment { id, order_id, station_id, provider_id?, start, end, status: "proposed"|"booked"|"arrived"|"fulfilled"|"cancelled"|"noshow" }`.
- `Itinerary { stops: Stop[], planned_at, reason: string[] }`; `Stop { order_id, station_id, node_id, status, eta_start, eta_end, people_ahead?, est_wait_min? }`.
- `QueueState { station_id, at, count_sensed?, count_ticketed?, count_fused, est_wait_min, source: "sam"|"tickets"|"fused"|"sim" }`.
- `HumanReview { id, kind: "approval"|"handoff"|"task", journey_id?, station_id?, reason, capability, agent, status: "pending"|"resolved"|"rejected", pending_event?, resolved_by?, resolved_at?, note }`.
- `OpsAction { id, kind: "open_server"|"divert"|"call_volunteer"|"close_station", params, predicted_effect: { station_id, wait_before_min, wait_after_min, affected_journeys }, evidence: SimRunRef, status }`.
- `PrepPlan { items: PrepItem[], fasting_window_as_written?, entrance, parking, estimated_minutes_on_site, cards: ImageRef[] }`.
- `Message { id, direction: "out"|"in", channel: "sms_sim"|"voice_sim"|"kiosk", language, text, disclaimer: boolean, at }`.

### 5.6 Memory allowlist

Keys: `preferred_language`, `mobility`, `preferred_time_of_day`, `preferred_entrance`, `companion_present`, `transport_need`. Nothing else is stored; a test rejects payloads with other keys or with symptom, medication, or document text. Memory is per journey and copied forward to the next journey of the same synthetic patient.


---

## 6. Agents

Every agent lives in `apps/runtime/src/agents/<name>/` with `descriptor.ts` (name, capabilities, grants, risk, tier), `handler.ts` (deterministic logic and the required tool implementation), `prompt.ts` (system prompt and tool schemas for model agents), and `handler.test.ts`. Model agents run a tool loop: read-only tools first, then exactly one required tool. Deterministic agents have no prompt file.

| Agent | Capabilities | Trigger events | Read tools | Required tool (validated by code) | Model / tier | Risk, gate | Deterministic fallback |
|---|---|---|---|---|---|---|---|
| referral_intake | referral.extract, referral.clarify | ReferralReceived | get_documents | `submit_referral_packet(ReferralPacket)` with structured output | Spark 1.3 vision (private tier when available) | MEDIUM; attribute extraction only, never identity search | Regex extraction of name, DOB, member id from OCR text; otherwise ClarificationNeeded |
| eligibility | eligibility.check | IntakeExtracted | payer table | none (pure code) | none | LOW | n/a |
| authorization | prior_auth.draft, prior_auth.submit | EligibilityChecked | get_referral, get_orders, payer rules | `submit_auth_draft(AuthPacket)` | Spark 1.3 | HIGH; `prior_auth.submit` is PRE_APPROVAL | Template packet |
| scheduler | schedule.plan, schedule.book, noshow.score | PriorAuthDecided, AppointmentsProposed+confirmed, VisitCheckedOut (follow-ups), ReplyHandled(reschedule) | engine.schedule, memory | `propose_schedule(plan, alternative, explanation)` | Engine (Rust) + Spark 1.3 only for the explanation and alternative choice | LOW | Engine result without explanation |
| prep | prep.compose | AppointmentsBooked | get_orders (as written), campus, engine.estimate_time_on_site | `compose_prep_plan(PrepPlan)` | Spark 1.3 + Muse Image for cards | LOW; fasting text copied verbatim from the order, never invented | Template plan without cards |
| messenger | message.send, reply.handle, waitlist.offer | PrepPlanSent, ReminderSent timer, PatientReplied, WaitlistOffered | journey, memory | `handle_reply(intent: confirm / reschedule / question / human, slots?, memory_updates?)` | Voice Transcribe (EN/ES) → Spark 1.3 (private tier for free text) | MEDIUM; symptom content → handoff.request (BLOCKING) | Keyword intent: "yes/sí" confirm, "change/cambiar" reschedule, else human |
| sensing | queue.estimate, bottleneck.detect | sim tick (60 s) | frames, ticket counts | `publish_queue_state(QueueState[])` (code) | SAM 3.1 (`person`), fusion in code | LOW; counts only, no identity, frames discarded after counting | Ticket counts only (`source: tickets`) |
| itinerary | itinerary.plan, itinerary.replan | PatientArrived, QueueStateUpdated (deviation), ResultReady, OpsActionApplied | engine.plan_itinerary, campus graph | code | Engine | LOW | Order of the printed ticket |
| companion | patient.locate, directions.send, patient.message, handoff.request | StopCompleted, PatientLocated, PatientLost, inbound chat | journey, itinerary, campus, signage registry | `send_patient_message(text, language, kind: next_stop / directions / wait_update / handoff)` | Spark 1.3 vision (sign photos) + SAM 3.1 (door/elevator boxes); text via Spark 1.3 | MEDIUM; clinical classifier runs before every reply; handoff is BLOCKING | Template next-stop message with people ahead and minutes; A* directions as text |
| results_watcher | result.watch, result_ack.track | ResultReady, timers | orders | code | none | LOW; status only, never reads values | n/a |
| ops | ops_action.propose, ops_action.apply | BottleneckDetected, OpsActionApproved | engine.simulate (what-if), station state | `propose_ops_action(OpsAction with predicted_effect and evidence)` | Spark 1.3 or **Spark Open on Modal/Baseten** (switchable; the open-weight showcase) | HIGH; `ops_action.apply` is PRE_APPROVAL | Rule: open a server if available, else divert to the sibling station |
| discharge | summary.draft, summary.send, teachback.run | VisitCheckedOut, SummarySent + 24 h, TeachbackAnswered | provider instructions (verbatim), orders, memory | `submit_summary(plain_text_by_section, language, disclaimer: boolean)` | Spark 1.3 (private tier) | HIGH; `summary.send` PRE_APPROVAL when provider review on; disclaimer + human contact otherwise; teach-back failure → nurse task | Verbatim instructions with a fixed header |
| followup | followup.book, logistics.checkin, referral.close | VisitCheckedOut, Day +3 timer, FollowUpsBooked + ResultAcknowledged | orders, appointments, engine.schedule | `submit_closure_report(report)` | Engine + Spark 1.3 for the report text | LOW; check-in answers never interpreted clinically | Template report |

### 6.1 Prompt rules shared by all model agents

- System prompt opens with identity and limits: "You are Throughline, an administrative assistant for Halden Medical Center. You help with scheduling, directions, waiting times, documents, and follow-up logistics. You never give medical advice, interpret results, or discuss symptoms; if asked, say you will connect the person with a nurse." Patient-facing messages add "I'm an AI assistant" on first contact and whenever a conversation resumes after 24 h.
- Tools: read tools are idempotent and return JSON; the required tool is the only write. Spark's `tool_choice` cannot be forced, so the prompt states "You must call `<required_tool>` exactly once before finishing" and the runner enforces it.
- Structured output uses the Responses API `text.format` json_schema with `strict: true` for extraction tasks; arguments are still validated with zod because strict mode does not guarantee conformance.
- Reasoning effort: `low` for messaging and directions, `medium` for extraction and ops proposals. Context is compacted in code (no server-side truncation).
- Language: respond in `journey.patient.language`; Spanish copy is reviewed by a human before the video.

### 6.2 Clinical-content classifier (runs before every outbound and on every inbound)

Deterministic layer first (keyword and pattern lists for symptoms, medications, dosages, results, diagnoses in EN/ES), then a Spark 1.3 yes/no check on borderline text. Any hit on inbound → `handoff.request`. Any hit on outbound generated text → the message is blocked and the fallback template is sent; the event `ContentBlocked` is logged and shown on the proof panel.


---

## 7. Engine (`packages/engine`, Rust → WebAssembly)

The engine is the only place where speed matters and the only place where the same code must run in two hosts (browser for instant what-if, Node for the runtime). It is a pure library: no I/O, no clock, no network, deterministic given its inputs and a seed. Everything else in the product is bound by model latency and stays in TypeScript.

### 7.1 Crate layout

```
packages/engine/
  Cargo.toml            crate-type = ["cdylib", "rlib"]; deps: wasm-bindgen, serde, serde_json, rand, rand_chacha, rand_distr
  src/lib.rs            wasm-bindgen exports (JSON string in, JSON string out) + version()
  src/campus.rs         load campus.json → graph; Dijkstra/A*; all-pairs walking matrix; mobility filter
  src/queue.rs          Little's-law wait estimate; EMA fusion of sensed and ticket counts
  src/itinerary.rs      visit-day stop ordering solver + replan with diff
  src/schedule.rs       multi-day dependency-aware appointment scheduler + one alternative
  src/sim.rs            discrete-event simulation of the campus; disruptions; ops actions; what-if replicates
  src/noshow.rs         heuristic no-show score (documented weights, not a trained model)
  src/types.rs          serde structs mirroring packages/shared zod schemas (one test checks the JSON fixtures parse in both)
  fixtures/*.json       golden inputs/outputs shared with the TS tests
  pkg-web/, pkg-node/   wasm-pack outputs (gitignored; built by `pnpm build:engine`)
  src-ts/index.ts       typed wrapper: loads the right pkg per host, validates in/out with zod, exposes the Engine interface
```

Build: `wasm-pack build --target web --out-dir pkg-web` and `wasm-pack build --target nodejs --out-dir pkg-node`. The web app imports the wrapper, which calls `init(fetch('/engine_bg.wasm'))` once (the `.wasm` file is copied to `apps/web/public/` by the build script); the runtime imports the Node build directly. No framework-specific WASM loaders; this avoids Next.js bundler surprises.

### 7.2 Interface (`Engine`, identical for Rust and the TS fallback)

```ts
interface Engine {
  version(): string;
  walkingRoute(req: { from: NodeId; to: NodeId; mobility: "walking"|"wheelchair" }): { nodes: NodeId[]; seconds: number; steps: Step[] };
  estimateWait(req: { station: StationSpec; count: number; open_servers: number }): { est_wait_min: number };
  planItinerary(req: ItineraryRequest): ItineraryPlan;
  replanItinerary(req: ItineraryRequest & { current: ItineraryPlan }): { plan: ItineraryPlan; diff: StopDiff[]; reason: string[] };
  schedule(req: ScheduleRequest): { primary: SchedulePlan; alternative?: SchedulePlan };
  estimateTimeOnSite(req: { orders: OrderLite[]; arrival: string; typical_day: boolean }): { minutes: number; walking_seconds: number };
  simulate(req: SimRequest): SimResult;                 // one replicate, returns 60 s snapshots
  whatIf(req: SimRequest & { actions: OpsActionLite[]; replicates: number; horizon_min: number }): WhatIfResult;
  noshowScore(req: NoShowFeatures): { score: number; drivers: string[] };
}
```

Key request/response shapes (full zod schemas live in `packages/shared/src/engine.ts`; Rust mirrors them in `types.rs`):

- `ItineraryRequest { campus_version, now (sim ISO), location: NodeId, mobility, stops: StopReq[], queues: QueueState[], station_hours, constraints: Constraint[] }`; `StopReq { order_id, station_id, duration_min, must_be_first?: boolean }`; `Constraint = { kind: "before", a: order_id, b: order_id, min_gap_min? } | { kind: "after_event", order: order_id, event: "result_ready"|"provider_signoff", lead_min }`.
- `ItineraryPlan { stops: PlannedStop[], total_minutes, walking_seconds, reason: string[] }`; `PlannedStop { order_id, station_id, node_id, eta_arrive, eta_start, eta_end, people_ahead, est_wait_min }`.
- `ScheduleRequest { orders: OrderLite[], dependencies: OrderDependency[], calendars: StationCalendar[] (15-min slots with remaining capacity), availability: Window[], preferences: { time_of_day?: "morning"|"afternoon", max_days_span?: number }, earliest: date, latest: date }`.
- `SchedulePlan { appointments: { order_id, station_id, start, end }[], visit_days: string[], span_days, score, facts: string[] }` where `facts` are plain statements the explanation model may use ("CT is after the authorization decision expected Nov 12", "Labs on Nov 14 so results are back 48 h before the Nov 17 clinic").
- `SimRequest { campus_version, seed, start, end, patients: SimPatient[], disruptions: Disruption[], initial_queues?: QueueState[] }`; `SimResult { snapshots: { at, station_id, count, est_wait_min }[], per_patient: { id, minutes_on_site, walking_seconds, waits: {...} }[], kpis }`.
- `WhatIfResult { baseline: { station_id, mean_wait_min, p90_wait_min }[], per_action: { action_id, station_id, mean_wait_min, p90_wait_min, delta_min, affected_journeys }[] }`.

All functions are total: invalid input returns `{ error: { code, message } }` rather than throwing across the WASM boundary.

### 7.3 Algorithms

- **Walking**: Dijkstra on the undirected graph with edge seconds; stairs edges removed for wheelchair; elevator edges are 90 s flat. All-pairs matrix between station and waiting nodes precomputed on load (37 nodes, trivial). `steps` are human-readable landmarks built from node kinds and sign text ("Take Elevator A to Level 2", "Turn toward the Gold Zone sign").
- **Wait estimate**: `est_wait_min = count_ahead × mean_service_min / open_servers`, clamped to the station's hours; `count_fused = α·sensed + (1−α)·ticketed` with α = 0.6 when a fresh frame (< 3 min) exists, else ticket-only. Documented as an estimate; the UI always shows the source.
- **Itinerary solver**: n ≤ 8 stops on a visit day. Depth-first enumeration of orderings that satisfy precedence, with branch-and-bound on the lower bound (remaining service + min walking). Cost = expected finish time; tie-breaker = total walking seconds; a second tie-breaker prefers keeping fasting stops first. Queue projection: each station's queue decays toward its hour-of-day baseline (from `campus.json`) at the station's service rate, so a stop planned 40 minutes from now uses the projected queue, not the current one. Expected: < 5 ms for 7 stops. `replan` fixes done and in-service stops, re-solves the rest, and emits a diff (`moved_earlier`, `moved_later`, `swapped_station` for sibling stations like CT-1 → CT-2) plus reasons.
- **Scheduler**: topological order of orders by dependency; for each order choose the earliest slot that satisfies `after_auth` (auth decision date + 0), `resulted_before` (result turnaround + min gap), `same_day_after` (same calendar day, after the predecessor's end + lead), station hours, patient availability, and preference; then a second pass tries to collapse appointments onto the fewest distinct days by shifting within slack. Alternative = the same search with the primary's first visit day forbidden. Expected < 50 ms for 6 orders over a 30-day horizon.
- **Simulation**: discrete-event, event heap keyed by sim time; entities are synthetic patients with itineraries produced by the same solver (so the simulation uses the product's own logic); stations are multi-server FIFO queues with lognormal service (`rand_distr::LogNormal` on a seeded `ChaCha8Rng`); walking uses the matrix; disruptions change `open_servers` for a window; ops actions: `open_server` (+1 server at a station from t), `divert` (re-plan N waiting patients to a sibling station), `call_volunteer` (lobby service rate +30% for 30 min), `close_station`. Snapshots every 60 s produce `QueueState` rows with `source: "sim"`. Target: 200 patients × 8 hours in < 15 ms per replicate; what-if with 3 actions × 20 replicates × 90-minute horizon in < 400 ms in the browser.
- **No-show score**: logistic function over lead-time days, confirmed flag, prior no-shows, distance band, appointment hour, with fixed weights listed in `noshow.rs` and in DO-NOT-CLAIM.md as a heuristic. Output includes the top two drivers in words.

### 7.4 Determinism, parity, tests

- Same inputs + same seed → byte-identical JSON output (test in Rust and in the Node wrapper).
- Parity: the TS fallback must produce the same itinerary ordering on all golden fixtures and simulation KPIs within 5% (tolerance test), so switching implementations never changes the demo.
- Property tests (Rust `proptest`): precedence constraints are never violated; ETAs are monotone along the plan; no stop is scheduled outside station hours; `replan` never moves a `done` stop; scheduler respects every dependency and capacity.
- Wrapper tests (vitest): load WASM in Node, run every fixture, validate output with the zod schemas, assert `version()` matches `Cargo.toml`.
- Benchmarks (`cargo bench` optional; a `pnpm bench:engine` script in Node prints the four targets above and fails CI if any exceeds 2× its target).

### 7.5 The Day-1 spike and the fallback rule

Spike checklist (time-boxed to Day 1, 09:00–18:00): `cargo init` with `wasm-bindgen`; export `version()` and `walkingRoute()`; build both targets; call from the runtime (Node) and from a Next.js page (browser) with the campus fixture; print a route. If any step is still red at 18:00, implement `packages/engine-ts` as the primary (same interface, greedy itinerary with the same cost function, simplified simulation) and keep Rust as stretch work after Day 4. The decision and its time are recorded in DECISIONS.md. The product never depends on which implementation is active; the proof panel reports `engine: rust-wasm 0.x` or `engine: ts 0.x`.


---

## 8. Meta models and sponsor infrastructure

All clients live in `apps/runtime/src/models/`. One file per provider, one `ModelRouter` that picks provider + model by `(capability, tier)`, and one `ModelCallRecord` writer wrapped around every call. Never call a model from the web app directly; the browser talks to the runtime.

### 8.1 Providers and ids

| Use | Provider / base URL | Model id | Notes verified on official docs |
|---|---|---|---|
| Cloud tier: extraction, messaging, directions, explanations, ops proposals, clinical-content check | Meta Model API `https://api.meta.ai/v1`, `Authorization: Bearer $META_API_KEY`, Responses API `POST /v1/responses` via the `openai` npm SDK (`baseURL`) | `muse-spark-1.3` | $1.25 in / $0.15 cached / $4.25 out per 1M; 1M context; 3,000 RPM / 4M TPM per team; `reasoning.effort` ∈ minimal/low/medium/high/xhigh; structured output `text.format = { type: "json_schema", name, schema, strict: true }`; `tool_choice` must stay `"auto"` (named/required → 400); `strict` does not guarantee argument conformance; no server-side truncation (compact history yourself); images only in `user` messages, ≤ 50 per request; PDFs via Files API; perception grounding returns points/boxes/counts on a 0–1000 grid relative to the image sent |
| Sign photo and insurance-card reading | same | `muse-spark-1.3` with `input_image` + json_schema | Treat ID cards as attribute extraction (name, DOB, member id), never identity search |
| People counting in waiting-area frames; door/elevator boxes in sign photos | same, `POST /v1/responses` with `model: "sam-3.1"`, `input` = one user message `[input_text (one noun), input_image]`, `metadata: { mask_encoding: "one_bit", include_confidence: "true" }`, `stream: true` | `sam-3.1` | Output is a special-token grammar, parsed with `@meta-sam/parser` (`parseImageStream` → `finalResult.boxes`, `masks`); number of records = count; one noun per request ("person"; "door"; "elevator"); $2.50 per 1,000 images; 3,000 RPM; weak on fine medical vocabulary, fine on everyday nouns |
| Voice replies (EN/ES) from the patient | `wss://api.meta.ai/v1/asr/realtime` (handshake JSON within 10 s: `{ authorization: { accessToken: "Bearer <key>" }, audioEncoding: "PCM_16KHZ", model: "muse-voice-transcribe-1.0", mode: "ENDPOINTING", partialMode: true, languageBias: ["en","es"], keywords: [...station and provider names] }`, then raw 16-bit mono PCM frames, end with `{ "type": "endStream" }`); batch `POST /v1/asr/transcribe` (multipart `request` JSON + WAV mono 16-bit 16/24 kHz, ≤ 10 min, ≤ 32 MB) | `muse-voice-transcribe-1.0` | Events `speechStart`, `transcript` (partials), `speechEnd`, `speechComplete`; `DIARIZATION` mode for two-speaker desk recordings; turn-level timestamps only; $0.18/hour; 256 concurrent streams; **no TTS on the Model API** — spoken replies use the browser's `speechSynthesis`, labeled as such |
| Wayfinding cards and prep illustrations | `POST /v1/images/generations` via `client.images.generate({ model, prompt, n: 1, size: "1536x1024", output_format: "webp", response_format: "b64_json" })` | `muse-image-1.0` | $0.01 per image; 150 RPM; `size` sets aspect ratio only; no mask parameter; keep the style consistent with a fixed style prefix and reference images; generated once per node and committed to `apps/web/public/cards/` so the demo never waits on image generation |
| Private tier (identifiers, free text, documents) | Modal dedicated endpoint created with `modal endpoint create --model meta-models/Muse-Glimmer-30B` (BF16, 1×H100, ~72 GB VRAM, scale-to-zero), or self-hosted vLLM `vllm/vllm-openai:muse-glimmer` with `--enable-auto-tool-choice --tool-call-parser muse_glimmer --reasoning-parser muse_glimmer --generation-config auto`; base URL from the endpoint → `GLIMMER_BASE_URL` | `meta-models/Muse-Glimmer-30B` | Apache 2.0, ungated; sampling temp 1.0, top_p 0.95, top_k 64 (never greedy); reasoning strength via system prompt line `Reasoning strength: low`; tool calling supported; structured output not documented → validate and retry in code; ~$3.95/GPU-hour on Modal, covered by the $100 Modal credit if the endpoint scales to zero |
| Open-weight ops brain (switchable) | Modal shared endpoint `modal endpoint create --shared --model meta-models/Muse-Spark-Open-816B-A42B` (OpenAI-compatible base URL printed by the CLI; lowest latency of the partners) **or** Baseten `https://inference.baseten.co/v1` with `meta-models/muse-spark-open-1026` (the id in the participant guide; needs the credited key — fall back to `meta-models/muse-spark-open` and confirm with `GET /v1/models`) **or** Fireworks `https://api.fireworks.ai/inference/v1` with `accounts/fireworks/models/muse-spark-open` | Muse Spark Open 816B-A42B | $1.25 / $0.15 / $4.25 per 1M on all three; reasoning always on (`reasoning_effort` low/medium/high/xhigh; response carries `reasoning_content`, strip before display); Baseten accepts `json_schema` but **does not enforce it**; stream to avoid timeouts; `GET /v1/models` on each provider at boot to confirm the slug and record the result on the proof panel |
| Optional stretch: fine-tuned intake extractor | Fireworks Serverless Training: `firectl sftj create --base-model accounts/fireworks/models/muse-glimmer-30b --dataset intake-sft --lora-rank 16 --epochs 2 --output-model glimmer-intake-lora` (SFT free through Nov 30) | Glimmer 30B LoRA | A trained LoRA can only be served on an on-demand deployment (~$8/h H100), so this is a Day-5 stretch with a hard stop; the JSONL dataset generator (synthetic referral text → ReferralPacket) is written on Day 3 regardless and is useful as eval data |

### 8.2 Call patterns

```ts
// apps/runtime/src/models/spark.ts (cloud tier)
import OpenAI from "openai";
export const meta = new OpenAI({ baseURL: "https://api.meta.ai/v1", apiKey: process.env.META_API_KEY });

export async function runToolLoop(agent: AgentSpec, input: ResponseInput[], ctx: Ctx) {
  let previous: string | undefined; let requiredCall: ToolCall | undefined;
  for (let step = 0; step < agent.maxSteps; step++) {
    const r = await meta.responses.create({
      model: ctx.model, input: previous ? ctx.pendingOutputs : [{ role: "system", content: agent.system }, ...input],
      tools: agent.tools, tool_choice: "auto", parallel_tool_calls: false,
      reasoning: { effort: agent.effort }, previous_response_id: previous,
      max_output_tokens: 2000 });
    previous = r.id;
    const calls = r.output.filter(o => o.type === "function_call");
    if (calls.length === 0) break;
    ctx.pendingOutputs = [];
    for (const c of calls) {
      const parsed = agent.schemas[c.name].safeParse(JSON.parse(c.arguments));
      if (!parsed.success) { ctx.pendingOutputs.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify({ error: parsed.error.flatten() }) }); continue; }
      if (c.name === agent.requiredTool) { requiredCall = { name: c.name, args: parsed.data }; ctx.pendingOutputs.push(ok(c)); continue; }
      ctx.pendingOutputs.push({ type: "function_call_output", call_id: c.call_id, output: JSON.stringify(await agent.readTools[c.name](parsed.data)) });
    }
    if (requiredCall) break;
  }
  if (!requiredCall) throw new RequiredToolMissing(agent.name);   // runner retries once, then falls back
  return requiredCall;
}
```

```ts
// sam.ts — count people in a frame
import { parseImageStream } from "@meta-sam/parser";
export async function countPeople(frame: Buffer, cameraId: string) {
  const stream = await meta.responses.create({ model: "sam-3.1", stream: true,
    metadata: { mask_encoding: "one_bit", include_confidence: "true" },
    input: [{ role: "user", content: [{ type: "input_text", text: "person" }, { type: "input_image", image_url: `data:image/jpeg;base64,${frame.toString("base64")}` }] }] });
  const { finalResult } = await parseImageStream(stream);
  return { count: finalResult.boxes.length, boxes: finalResult.boxes, cameraId };   // frame is not persisted
}
```

Voice: the browser captures 16 kHz mono PCM with an `AudioWorklet`, streams it over the runtime's `/voice` WebSocket, and the runtime relays to `wss://api.meta.ai/v1/asr/realtime` (key never reaches the browser). On `speechComplete` the transcript is posted as `PatientReplied { channel: "voice_sim", transcript, language }`.

Private tier and open-weight providers use the same `openai` SDK with a different `baseURL`; Chat Completions is used there (the most portable surface across Modal, Baseten, Fireworks and vLLM), structured output is requested as a JSON object in the prompt and validated with zod; one retry with the validation error, then fallback.

### 8.3 Model router configuration

```ts
// apps/runtime/src/models/router.ts
export const PROVIDERS = {
  meta:     { baseURL: "https://api.meta.ai/v1", key: "META_API_KEY", api: "responses" },
  modal:    { baseURL: env.MODAL_SPARK_OPEN_BASE_URL, key: "MODAL_API_KEY", api: "chat" },
  baseten:  { baseURL: "https://inference.baseten.co/v1", key: "BASETEN_API_KEY", api: "chat" },
  fireworks:{ baseURL: "https://api.fireworks.ai/inference/v1", key: "FIREWORKS_API_KEY", api: "chat" },
  glimmer:  { baseURL: env.GLIMMER_BASE_URL, key: "GLIMMER_API_KEY", api: "chat" },
};
export const ROUTES: Record<Capability, { cloud: Route; private: Route }> = {
  "referral.extract":   { cloud: ["meta", "muse-spark-1.3"], private: ["glimmer", "meta-models/Muse-Glimmer-30B"] },
  "reply.handle":       { cloud: ["meta", "muse-spark-1.3"], private: ["glimmer", "meta-models/Muse-Glimmer-30B"] },
  "summary.draft":      { cloud: ["meta", "muse-spark-1.3"], private: ["glimmer", "meta-models/Muse-Glimmer-30B"] },
  "ops_action.propose": { cloud: ["meta", "muse-spark-1.3"], private: [env.OPEN_WEIGHT_PROVIDER ?? "modal", "meta-models/Muse-Spark-Open-816B-A42B"] },
  // ...directions, prep, explanations: cloud only (no identifiers in the payload by construction)
};
```

`TIER_MODE=auto|cloud_only|private_only`; `OPEN_WEIGHT_PROVIDER=modal|baseten|fireworks`; `OPS_BRAIN=cloud|open` toggles the ops agent between Spark 1.3 and Spark Open live in the command center (a visible switch; both results are recorded so the video can show the open-weight path working).

### 8.4 Caching, replay, and limits

- `MODEL_CACHE=off|record|replay`. `record` stores every model response keyed by `(provider, model, sha256(request))` in SQLite; `replay` serves from the cache and marks the call `replayed: true`. The demo video runs live with `record` on; the judges' deployment runs `replay` for the scripted journey so it never depends on a provider at 2 a.m., and the proof panel says "replayed" per call. Nothing is ever shown as live that was replayed.
- SAM: cache by frame hash; in the simulator only the six waiting-area cameras produce frames, at most one per camera per 20 real seconds while the demo is running (≈ 18 images per minute, $0.05/min).
- Muse Image: generated once per `(node_id, style_version)` and committed; regeneration is a manual script.
- Rate limits are far above demo load; the client retries 429/5xx with exponential backoff (3 tries) and then falls back.
- Token discipline: `reasoning.effort = "low"` for all patient-facing text; `medium` for extraction and ops; `max_output_tokens` set per agent; history compacted to the last 6 turns plus a summary; stable system prompts first for prompt caching.

### 8.5 Budget (credits: Meta $150 per person, Baseten $100 + 2M TPM, Modal $100; Fireworks not guaranteed)

| Item | Estimate | Basis |
|---|---|---|
| Development Spark 1.3 calls (~4,000 calls × ~4k in / 600 out) | ~$30 | $1.25 / $4.25 per 1M |
| SAM 3.1 during development and demos (~6,000 images) | ~$15 | $2.50 per 1,000 |
| Voice Transcribe (~5 hours total) | ~$1 | $0.18 per hour |
| Muse Image (~150 generations incl. iterations) | ~$2 | $0.01 each |
| Modal: Glimmer dedicated endpoint, ~12 GPU-hours total with scale-to-zero | ~$50 | ~$3.95 per GPU-hour |
| Modal/Baseten Spark Open tokens (~1,500 ops calls) | ~$10 | $1.25 / $4.25 per 1M |
| Reserve | the rest | set a spend limit on dev.meta.ai/billing on Day 1 |

### 8.6 Proof panel (what judges see)

A drawer available on every surface lists, from `ModelCallRecord`: provider, model id, capability, tier, latency, tokens, live / replayed / fallback, and the required tool that was validated. A header line summarizes the session: "Meta Model API: 41 live calls, 0 fallbacks · Spark Open (Modal): 6 live · Glimmer (Modal): 12 live · SAM 3.1: 38 frames · Voice: 2 turns · engine: rust-wasm 0.3". Everything simulated (clock, LIS, payer, SMS channel, cameras) is listed under "Simulated in this demo" on the same panel.


---

## 9. Frontend and design

Read this section with the `frontend-design` skill loaded. The brief below is the design plan that skill asks for (tokens, type, layout, principles), already reviewed against the "generic default" and corrected; `docs/DESIGN.md` in the repo is a copy of it and is the only place tokens are defined. Each surface answers one question. Nothing goes on a screen because it exists in the data model.

### 9.1 Brief

- Subject: hospital wayfinding and logistics. The visual world is painted floor lines ("follow the blue line to Imaging"), color-coded zone signage, departures boards, printed itinerary tickets. Not a SaaS dashboard, not a chat app.
- Audiences: a patient (often older, stressed, on a phone, maybe reading Spanish; Maria is 71); staff reading a board from two meters; an ops manager who needs calm density; judges who have 3 minutes.
- The one memorable element: **the line.** A single continuous route line runs through every surface and changes color as it passes through zones, exactly like a floor line. On the phone it is vertical and the stops hang off it; on the station board it is the arrivals timeline; in the command center it is drawn through the isometric map; on the Journey Control page it is the three-phase thread. Everything else is quiet: paper background, ink text, almost no borders, no shadows.
- Review against the default (what changed and why): the first sketch had a KPI tile row on the patient screen → removed, the patient needs one answer (where next, how long). Messages were chat bubbles → now plain text blocks attached to the line, because this is a route, not a conversation. The station board was a light table → now a dark departures board, which is what staff already read and which gives the product one deliberate dark surface. Cards everywhere → only ops proposals are card-like, and they carry an evidence bar instead of a shadow.

### 9.2 Tokens (`apps/web/app/theme.css`, Tailwind v4 `@theme`)

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F6F7F4` | page background on patient, kiosk, ops, journey control (cool off-white, not cream) |
| `--ink` | `#18223A` | text; station board background |
| `--ink-soft` | `#4B5566` | secondary text |
| `--line` | `#0F766E` | the Throughline when not inside a zone; primary actions; focus ring |
| `--wait-low` / `--wait-mid` / `--wait-high` | `#CFE8E3` / `#D97706` / `#C2410C` | queue intensity on the map and boards; always paired with the number |
| `--zone-blue` / `--zone-gold` / `--zone-green` / `--zone-rose` / `--zone-violet` | `#3B6FD6` / `#C9971A` / `#3C8C5A` / `#C2506A` / `#7C5CBF` | zone chips, line segments, sign renderer; the only decorative color |
| `--held` | `#B45309` on `#FDF1DC` | HELD markers on approvals (the human gate) |
| `--board-text` | `#F4F6F2` | text on the dark station board |

Type: **Atkinson Hyperlegible** (Google Fonts) for everything read as text, chosen because it was designed for low-vision readers and the first user is 71; **Barlow Condensed** (600/700) for display: station names, floor levels, big numbers, board rows, the sign renderer, because it reads like directional signage. Scale: body 17 on the patient surface (19 for the current stop line), 15 elsewhere, 13 for secondary; display 28 / 40 / 64 / 96 in Barlow Condensed; line length under 70 characters; sentence case everywhere; no letter-spaced capitals.

Spacing: 4-pt grid, generous (24/32/48) on the patient surface; the line is 6 px wide; stops are 16 px dots (done = filled ink, current = 24 px filled line color, future = 16 px outline). Corners: 12 px on buttons, 0 on the line and stops, 6 px on zone chips. Borders only where a boundary carries meaning (the kiosk ticket, device frames).

### 9.3 Surfaces and layouts

**Patient phone** `apps/web/app/p/[journeyId]` (390 px first, scales up): answers "where do I go next and how long will it take". Left-aligned. The current stop is the only large thing.

```
┌──────────────────────────────┐
│ Halden Medical Center   EN ES│
│                              │
│ ●  Registration     done 8:41│
│ │                            │
│ ●  Lab draw         done 9:05│
│ ┃                            │
│ ┃  CT 2                      │   ← Barlow Condensed 40
│ ┃  Level 2, Gold Zone        │   ← zone chip, gold
│ ┃                            │
│ ┃  3 people ahead            │   ← number in Barlow 64
│ ┃  about 12 minutes          │
│ ┃                            │
│ ┃  [ Show me the way ]       │
│ ┃  [ I'm here ]              │
│ │                            │
│ ○  Vitals             ~10:05 │
│ ○  Dr. Okafor, Clinic 2A     │
│ ○  Infusion           ~11:10 │
│                              │
│ Talk to a person             │   ← always present, same place
└──────────────────────────────┘
```

Before the visit the same line shows days instead of stops (Nov 14: labs; Nov 17: clinic and infusion), with prep items as a checklist hanging off the day and the illustrated cards inline. After the visit it shows the summary sections, then the teach-back as three single-question screens, then the next visit. Directions open as a sheet with the phone map snippet (one corridor, two landmarks) and numbered steps; the step list is the accessible version and the map is decorative. The sign-photo button sits inside that sheet, not on the main screen. Messages from Throughline are plain text blocks on the line with a small mark and the disclosure line on first contact; the patient's own replies are right-aligned plain text. No bubbles, no avatars.

**Kiosk** `apps/web/app/kiosk`: landscape 1280×800, 48 px targets, EN/ES as two big buttons first, check-in by scanning the QR from the message or typing name + date of birth (attributes already on file); shows the first three stops and prints the ticket (SVG from the signage renderer) with the QR and the first stop's zone color across the top edge; a microphone button for voice; after 30 s of inactivity it resets. One screen, one job.

**Station board** `apps/web/app/board/[stationId]`: dark surface (`--ink` background, `--board-text`), Barlow Condensed throughout, readable from two meters: station name and time at the top, then arriving patients as rows (initials and ticket number only; never a full name on a public board), ETA, and status in words ("walking from Lab", "waiting here", "in CT 1"); on the right the live count and a 30-minute sparkline; staff actions as big buttons ("Start", "Done", "Didn't arrive"). Tasks (lost patient, nurse call) appear as a row at the bottom with the HELD color, never as a modal.

```
┌─────────────────────────────────────────────────────────────┐
│ CT 2                              9:52     Imaging, Level 2 │
│                                                             │
│ Arriving                        ETA       Status            │
│ M. D.   ticket 1047             9:58      walking from Lab  │
│ R. K.   ticket 1051            10:06      waiting here      │
│                                                             │
│ Waiting now 3      next 30 min ▁▂▃▅▆▅▃     [Start] [Done]   │
│ Ticket 1044 may be lost: no check-in for 14 min   [Send help]│
└─────────────────────────────────────────────────────────────┘
```

**Command center** `apps/web/app/ops`: the isometric campus map is the hero and takes the full width; left rail lists journeys in the building (initials, current stop, minutes behind plan) and selecting one draws its line through the map; right rail holds proposals; the bottom strip is the day's timeline with bottleneck bands and the SimClock controls, plus the what-if slider that re-runs the WASM simulation on every change and redraws the predicted wait curve with no round trip.

```
┌──────────────────────────────────────────────────────────────┐
│ Halden Medical Center   Thu Nov 13, 9:52   ▶ 10×   Proof     │
├──────────┬───────────────────────────────────┬───────────────┤
│ In house │                                   │ Proposals     │
│ 41       │     isometric campus map          │ CT 1 is down  │
│ ▸ M. D.  │     floors as exploded layers,    │ until 10:25   │
│   V. L.  │     stations tinted by wait,      │ Open CT 2     │
│   …      │     selected journey as the line  │ second slot   │
│          │                                   │ wait 22→13 min│
│          │                                   │ [Approve]     │
├──────────┴───────────────────────────────────┴───────────────┤
│ 7:00 ───────────▓▓▓▓───────────────── 17:00   what-if ◉────  │
└──────────────────────────────────────────────────────────────┘
```

**Journey Control** `apps/web/app/journey/[id]` (the demo and judging page): three device frames side by side (phone, station board, campus map), a scrubber below that is the three-phase line (referral → booked → arrived → CT → clinic → summary → closed) with the SimClock speed, and an event cascade on the right with HELD markers where a human gated. The proof drawer opens from the header. This page is where the video is recorded.

**Intake queue** `apps/web/app/intake` and **Review** `apps/web/app/review`: coordinator and provider screens. Intake shows the dropped document on the left and the extracted packet on the right with each field's source crop highlighted on hover, clarifications as plain questions, and the prior-auth packet with one action ("Submit to payer"). Review shows the provider's verbatim instructions beside the plain-language draft, each section aligned, with "Approve and send" or inline edits. Both are light, two-column, left-aligned, no cards.

### 9.4 Components (`apps/web/components/`)

`Throughline` (vertical | horizontal; segments colored by zone; stops with status), `Stop`, `CurrentStop` (the large block), `BigNumber`, `ZoneChip`, `WaitTint` (maps minutes to the three wait tokens and always renders the number next to the color), `IsoMap` (SVG, data from `campus.json`, layers per floor, `selectedJourneyId`, hover sparkline, click details), `QueueSpark`, `Proposal` (title in words, predicted effect as a before/after bar, evidence link to the sim run, Approve/Reject), `HeldMarker`, `EventCascade`, `ProofDrawer`, `SimClock`, `Message` (with disclosure variant), `TeachbackQuestion`, `SignCard` and `Ticket` (from `packages/hospital` renderer), `DeviceFrame`, `LanguageToggle`, `VoiceButton` (AudioWorklet + WebSocket, shows partial transcript inline).

### 9.5 Motion

Motion only answers an action or a real event, and shows what changed: when a stop completes, the line grows and the next stop moves into the large slot (280 ms, ease-out); when a replan arrives, the affected stops swap with a two-second amber wash and a one-line reason; on the map the patient dot travels along the edge when a stop starts; a proposal slides in from the right rail; an approval turns HELD into a check. No page-load fades, no hover lifts, no parallax, no looping ambient animation. `prefers-reduced-motion` switches every transition to an instant state change.

### 9.6 Copy

All strings live in `packages/shared/src/copy/en.ts` and `es.ts`; a test fails if a key is missing in either. Sentence case, plain verbs, numbers as numerals, times as "about 12 minutes". Buttons say what happens: "Show me the way", "I'm here", "Talk to a person", "Approve and open CT 2", "Send to payer". Errors say what happened and what to do next ("We couldn't read the sign. Try the sign with the floor number, or tap 'Talk to a person'."). Empty states invite action ("No one is waiting here right now."). Disclosure line on first patient contact and after 24 h: "You're texting with Throughline, an AI assistant at Halden Medical Center. For medical questions reply NURSE and a person will call you." No exclamation marks on the patient surface. No "please be advised", no "kindly", no "seamless".

### 9.7 Accessibility floor

Contrast AA on every pair (ink on paper 13:1, line on paper 5.5:1, board text on ink 14:1, wait colors never carry meaning alone); patient body text at least 17 px; touch targets at least 48 px; visible focus ring (2 px `--line`, 2 px offset) on every control; the itinerary is a real list for screen readers and the map is `aria-hidden` with the step list as its text alternative; `lang` switches with the language toggle; the board is readable at 2 m (minimum 28 px rows); everything works with keyboard only; reduced motion respected.

### 9.8 Anti-patterns (reject in review)

Cream background with terracotta accent; near-black with acid green; hairline-rule broadsheet grids; identical rounded cards with the same soft shadow; gradient washes; letter-spaced all-caps eyebrows above headings; middle dots between meta items; "→" appended to buttons or links; monospace for data labels; one word of a headline in a different color; numbered markers on content that isn't a sequence; KPI tile rows on any patient or staff surface; chat bubbles and avatar circles; stock illustration; dashboards that show everything at once; any text that explains the system instead of the next step. A screen that fails any of these is redone before it is committed.

### 9.9 Process for every surface

1. Write the one-screen wireframe and the question it answers in `docs/DESIGN.md` (10 lines).
2. Compare with the generic default for that kind of page; change at least the part that reads as default and note why.
3. Build with the tokens only (no ad-hoc hex), with real copy from `copy/*.ts` and real data from the synthetic journey.
4. Screenshot with Playwright at 390×844 (phone), 1280×800 (kiosk and board), 1536×960 (ops and journey control); look at it; remove one element; check the anti-pattern list and the accessibility floor.
5. Commit the screenshot to `docs/screens/` so the video and the README use the same images.


---

## 10. Synthetic data and the demo

Every record in the system is synthetic and says so (`synthetic: true` on every aggregate and event; a "Synthetic data" mark on every surface header). No real patient, provider, payer, or hospital names; fictional organizations only (Halden Medical Center, Northgate Family Medicine as the referring clinic, Lonestar Health Plan as the payer). Phone numbers use the reserved fictional range `+1 555 01xx`.

### 10.1 Generators (`packages/synthetic`, all seeded; default `SEED=1104`)

| Generator | Output | Notes |
|---|---|---|
| `patients.ts` | 200 synthetic patients for the simulated day | curated name lists (not a faker library, so nothing accidentally real-looking slips in), DOB 1940–1995, language 80% en / 20% es, mobility 10% wheelchair, `phone_sim` |
| `providers.ts` | 8 oncologists in pods 2A/2B, 20-minute templates | Dr. Okafor, Dr. Lindqvist, Dr. Reyes, Dr. Patel, Dr. Nakamura, Dr. Brennan, Dr. Adeyemi, Dr. Kowalski (fictional) |
| `slots.ts` | station calendars, 30 days from Nov 10, 15-minute slots, 70–85% pre-booked | makes the scheduler search rather than pick the first slot |
| `orders.ts` | order templates per referral type | "new patient, medical oncology": CBC and CMP (lab), CT chest/abdomen/pelvis with contrast (imaging, auth required), oncologist visit, same-day infusion if the provider signs off; follow-up template: repeat labs in 3 weeks + visit. Codes are stored as written, never interpreted |
| `documents.ts` | referral fax PDF and insurance card PNG | `pdf-lib` for the letterhead letter with a stamped "FAX" header and skew/noise via `sharp`; card image with member id, group, plan name, copay line. Looks like a document without imitating any real insurer's design |
| `frames.ts` | waiting-area frame bank | ~60 images per camera generated once with Muse Image ("hospital waiting area, N people seated, wide shot, no faces visible, photo"), then labeled offline by running SAM 3.1 once per image and storing the real count; at run time the camera simulator serves the frame whose stored count is nearest the simulated count, and the live SAM call re-counts it. The frames are committed under `packages/synthetic/frames/` with their labels |
| `signs.ts` | sign photos | SVG signs from the registry rendered to PNG (`@resvg/resvg-js`), composited onto a corridor background (Muse Image) with perspective and blur; used by the sign-photo demo and the localizer tests |
| `payer.ts` | synthetic payer rules | which order codes need authorization, decision delay 2 simulated days, 90% approve, denial reason text |
| `lis.ts` | result turnaround | CBC 45 min, CMP 60 min, CT read 90 min; `ResultReady` only carries order id and status |
| `scenario.ts` | the scripted journey for Maria Diaz | see 10.3; every timed beat is a function of the sim clock, so the same scenario replays identically |

`pnpm seed` rebuilds the SQLite file from the generators; `pnpm demo:reset` restores the Maria scenario to its start in under 5 seconds.

### 10.2 Fixtures (committed, used by tests and replay)

`fixtures/journey-maria.json` (the full event log of the scripted journey, ~140 events), `fixtures/day-2026-11-13.json` (sim inputs for the visit day: 200 patients, disruptions), `fixtures/engine/*.json` (golden itinerary, schedule, what-if cases), `fixtures/model-cache.sqlite` (recorded model responses for `MODEL_CACHE=replay`). `packages/hospital/campus.json` is the campus itself.

### 10.3 The scripted scenario (Maria Diaz, synthetic patient 001, Spanish-speaking, 71)

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

### 10.4 The 3-minute video (recorded on the Journey Control page, 1080p, English voice-over, captions)

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:15 | One sentence of problem: 121 minutes at the hospital, 20 with a clinician; staff spend half an hour a week giving directions; 79% of patients misunderstand a medication change. | The line draws across the three phases |
| 0:15–0:55 | Before: fax in → packet with source crops → HELD auth → approve → plan with explanation and alternative → prep cards → voice reply in Spanish → wheelchair memory → plan updates | Intake screen, then the phone frame; clock at 60× |
| 0:55–2:05 | Visit day: kiosk → the line on the map → CT 1 down → SAM counts climbing → proposal with what-if slider → approve → her phone swaps stops with the reason → sign photo → directions → results → infusion → checkout | Journey Control with the three frames; clock at 10× between beats |
| 2:05–2:40 | After: summary beside verbatim instructions → approve → Spanish summary with disclosure → teach-back miss → nurse task → follow-ups booked → result ack overdue → closed report | Review screen, phone frame, cascade |
| 2:40–3:00 | Proof drawer: live call counts per Meta model, Spark Open toggle, Glimmer private tier, engine version, "Simulated in this demo" list; one line on what we did not build (no clinical outputs) | Proof drawer, then the README |

### 10.5 Backups and failure handling during the demo

- `MODEL_CACHE=replay` runs the identical scenario from recorded responses; the proof panel labels every replayed call. The judges' public deployment runs this mode by default with a "Run live" switch.
- Each phase can be jumped to from the scrubber; `pnpm demo:reset` restores the start state in < 5 s.
- If the Modal Glimmer endpoint is cold, `TIER_MODE=cloud_only` is applied automatically after a 20 s timeout and the panel says so; if Spark Open is unreachable, `OPS_BRAIN=cloud` is used and recorded.
- If the voice path fails, the typed reply path is identical and the script continues.
- The video is recorded in segments per phase so a single failure never forces a full re-record; a full dry run is done on Day 4 evening and again on Day 5 morning.


---

## 11. Safety, compliance posture, and claims

Throughline is administrative software. The design keeps it on that side of every line below, and each line has a control in code and a test, not just a sentence in the README. Nothing here is legal advice; it is the posture the build follows.

### 11.1 Boundaries and the control behind each

| Boundary | Why it matters (US) | Control in the product | Test |
|---|---|---|---|
| No diagnosis, triage, treatment, or medication advice; no symptom handling | The hackathon names "AI that generates and gives medical advice" as the anti-project; FDA's software-function exclusion covers administrative support (scheduling, admissions, practice and inventory management, benefits eligibility, laboratory workflow) and not clinical decision support; FDA's Jan 2026 CDS guidance only covers clinician-facing tools | The clinical-content classifier (6.2) blocks outbound text and converts inbound symptom text into a nurse handoff; agents have no tool that reads a result value, a diagnosis, or a medication list as content | A red-team fixture of 60 EN/ES prompts ("is this normal", "can I take ibuprofen", "me duele el pecho") must produce 60 handoffs and 0 answers |
| Results are status only | Interpreting lab values or flagging abnormal results is the LIS/device side of the line | `ResultReady` and `ResultAcknowledged` carry `order_id` and timestamps only; the type has no value field | A type-level test asserts the event schema has no numeric/result fields; the results_watcher has no model call |
| Instructions are the provider's words | After-visit summaries are clinical content; California AB 3030 requires a disclaimer and human-contact path for GenAI clinical communications unless a licensed provider reviews them; the Texas TRAIGA disclosure duty (effective Jan 1, 2026) requires telling patients when AI is used in care-related interactions | Discharge agent restates provider-entered text; `summary.send` is PRE_APPROVAL when provider review is on, otherwise the disclaimer and human-contact line are mandatory and tested; every first contact carries "I'm an AI assistant" | Snapshot tests on both modes; a test fails if any outbound message lacks the disclosure when required |
| Counting, not identifying | Illinois BIPA and Texas CUBI treat face geometry as biometric identifiers; people counting with no face templates, no re-identification, and no stored frames stays outside | SAM is prompted with "person" only; frames are discarded after the count; no face or re-identification tooling anywhere; sign-photo localization matches sign text, never faces | A test asserts no frame bytes are persisted and the SAM prompt list is `["person","door","elevator"]` |
| Attribute extraction, not identity search | Meta's usage restrictions flag identity search as a gray zone | Referral and card extraction return attributes that are already on the document; there is no lookup against any external identity source | Code review item; the extraction schema has no "match" or "identity" field |
| Synthetic data only | Real PHI would require a HIPAA BAA with every vendor touching it, including during development; the Meta Model API publishes no BAA | Every aggregate carries `synthetic: true`; generators are the only source; the app refuses to boot with `SYNTHETIC_ONLY=false` outside tests | Boot test |
| Humans gate consequential actions | Prior-auth submission, ops actions, and clinical-content sends change the world outside the system | `PRE_APPROVAL` and `BLOCKING` sets in `packages/shared`; park-and-replay | Gate tests for each capability in both sets |
| Memory is minimal and administrative | Preferences are useful; symptoms and documents in memory would be clinical records | Allowlisted keys (5.6) | Schema test rejects unknown keys and free text |
| PHI-tier routing | Shows the architecture a deployment would need (identifiers never leave the private tier) without claiming compliance | `routeModelCall` and `TIER_MODE` (4.4) | Classifier tests on 40 payloads; proof panel shows the tier per call |

### 11.2 Disclosure text (English; Spanish in `copy/es.ts`)

- First contact and after 24 h of silence: "You're texting with Throughline, an AI assistant at Halden Medical Center. For medical questions reply NURSE and a person will call you."
- Summary without provider review: "This summary was prepared with AI from your care team's notes and has not been reviewed by a clinician. For questions about your care, call the clinic at 555-0100 or reply NURSE."
- Kiosk and phone footer: "Synthetic demo data. Not a real patient."
- Ops proposals: "Predicted by simulation; a manager decides."

### 11.3 DO-NOT-CLAIM.md (verbatim list for the README, the video, and the Devpost page)

1. Throughline does not diagnose, triage, treat, or interpret results, and we do not claim it reduces clinical risk.
2. All patients, providers, documents, payers, cameras, SMS, voice calls, lab systems, and the clock are simulated; the demo runs on synthetic data generated in this repo.
3. The hospital is fictional; walking times, service times, and queue baselines are assumptions in `campus.json`, not measurements.
4. The no-show score is a fixed heuristic, not a trained or validated model.
5. The PHI-tier router demonstrates an architecture; it is not a HIPAA compliance claim. No BAA exists with any provider used here.
6. Wait estimates are estimates from counts and service-time assumptions; the UI always shows the source (sensed, tickets, simulation).
7. Problem numbers quoted in the pitch come from the cited studies and vendor reports (121 min / 20 min, 31.8 min per week of directions, 79% misunderstanding medication changes, 7.1% of abnormal results never communicated); they describe the US problem, not results we measured.
8. Replayed model calls are labeled; nothing replayed is presented as live.
9. Everything in this repo was built during Oct 27 – Nov 4, 2026, except the third-party libraries listed in `package.json` and `Cargo.toml`; the architecture pattern (event → capability → gate → handler, park-and-replay) is inspired by the open EIR project and is credited.

### 11.4 Hackathon submission requirements (checklist)

- Public repo with README: one-paragraph description, the three-phase diagram, "What is real vs simulated", models and sponsors used (with model ids), setup in five commands, `DO-NOT-CLAIM.md`, `BUILT-DURING-HACKATHON.md`, license (MIT), credits (EIR pattern, Atkinson Hyperlegible, Barlow).
- Live URL (replay mode by default, "Run live" switch) and the 3-minute video.
- Devpost: Indie or Startup track per the user's choice; tags for Best Agentic Use-Case and Best Build on Open Weight Models; one line that names the anti-project and states how the product stays administrative.
- No real names in screenshots; the "Synthetic data" mark visible in every image.


---

## 12. Testing and quality gates

Tests exist to pin the invariants that make the product trustworthy, not to chase coverage. Vitest for TypeScript, `cargo test` + `proptest` for Rust, Playwright for the surfaces. CI (GitHub Actions) runs all of it on every push; `main` is always demoable.

### 12.1 Invariants pinned by tests (each is one named test file)

Runtime and domain (`apps/runtime`, `packages/shared`):
1. `events.partition.test.ts` — `JOURNEY_EVENT_TYPES` and `OPS_EVENT_TYPES` are disjoint and together equal the catalog.
2. `transitions.test.ts` — every handler's `next_events` only produce transitions allowed by the phase/state table; terminal states emit nothing.
3. `gate.preapproval.test.ts` — each capability in `PRE_APPROVAL` parks the event verbatim, flips `paused_for_review`, emits `HumanReviewRequested`, and replays with `approved_by` after `HumanReviewResolved`; `rejected` discards and records.
4. `gate.blocking.test.ts` — `handoff.request` executes, opens a review, and suppresses all downstream events except `HumanReviewRequested`.
5. `gate.grants.test.ts` — an agent calling a capability outside its grant is refused and recorded.
6. `required-tool.test.ts` — a model agent whose loop ends without the required tool is retried once and then falls back; a required tool called twice fails validation; invalid arguments are sent back as `function_call_output` errors.
7. `phase-guard.test.ts` — events for a paused or completed journey are logged and dropped except approvals and handoffs; depth guard stops cascades at 12.
8. `memory.allowlist.test.ts` — unknown keys and free text are rejected.
9. `classifier.redteam.test.ts` — the 60-prompt EN/ES red-team fixture yields 60 handoffs, 0 answers; 40 benign logistics prompts yield 0 false handoffs (false positives are tracked, not required to be zero, but must be < 5%).
10. `results.status-only.test.ts` — result events carry no value fields; results_watcher makes no model call.
11. `disclosure.test.ts` — first-contact and 24 h-resume messages carry the disclosure; summaries without provider review carry the disclaimer and human-contact line in both languages.
12. `router.tier.test.ts` — 40 payloads route to the expected tier; `TIER_MODE` overrides; fallback after timeout records `used_fallback`.
13. `cache.replay.test.ts` — `replay` returns the recorded response and marks `replayed: true`; `record` writes once per request hash.
14. `copy.parity.test.ts` — every key in `copy/en.ts` exists in `copy/es.ts` and vice versa; no string contains "→" or "·" or an exclamation mark on patient surfaces.
15. `synthetic.flag.test.ts` — the app refuses to start with `SYNTHETIC_ONLY=false` outside the test environment; every aggregate and event has `synthetic: true`.
16. `journey.e2e.test.ts` — replays `fixtures/journey-maria.json` through the runtime in replay mode and asserts the final state (phase COMPLETED, 2 replans, 3 reviews, the memory keys, the KPIs).

Engine (`packages/engine`):
17. Determinism: same input + seed → identical JSON (Rust and wrapper).
18. Property tests: precedence never violated; ETAs monotone; nothing outside station hours; `replan` never moves `done` stops; scheduler respects every dependency and slot capacity; wheelchair routes contain no stairs edges.
19. Golden fixtures: itinerary, schedule, and what-if outputs match committed expectations; TS fallback matches ordering exactly and KPIs within 5%.
20. Benchmarks: the four targets in 7.3; CI fails above 2× target.

Hospital package:
21. `campus.validate.test.ts` — every edge references existing nodes; the graph is connected per mobility mode; every station has a node, hours, and service parameters; every node has at least one sign; sign text is unique enough for the localizer (no two signs within fuzzy 0.85 of each other unless on the same node).
22. `localizer.test.ts` — 30 rendered sign photos map to the right node ≥ 28 times; misses return "unknown" rather than a wrong node.

Surfaces (Playwright):
23. Screenshots at the three viewports for each surface committed under `docs/screens/` and compared with a 2% pixel tolerance.
24. Accessibility: `@axe-core/playwright` on every surface with zero serious violations; keyboard-only run through the kiosk check-in and an approval.
25. Replay smoke: the Journey Control page plays the scenario in replay mode to COMPLETED in under 90 s at 60×.

### 12.2 CI

`pnpm lint` (eslint + prettier + `cargo fmt --check` + `cargo clippy -D warnings`), `pnpm typecheck`, `pnpm test` (vitest + cargo test), `pnpm build` (web, runtime, engine both targets), Playwright on a built app. Caches: pnpm store, cargo registry, wasm-pack output. Required checks on `main`. A nightly job runs the scenario live (not replay) once and posts the proof summary to the job log, so provider breakage is noticed before demo day.

### 12.3 Definition of done (per task and for the project)

A task is done when: the code is typed and linted; the invariant it touches has a test; the surface it touches has an updated screenshot that passed the design checklist (9.8 and 9.7); the proof panel reflects any new model call; `DO-NOT-CLAIM.md` is updated if a new simulated component was added; `pnpm test` is green locally; the task's "done when" line in section 13 is true.

The project is done when: the scripted scenario runs end to end in live mode and in replay mode; the public URL is up in replay mode; the video is uploaded; the README, `DO-NOT-CLAIM.md`, and `BUILT-DURING-HACKATHON.md` are complete; the Devpost form is submitted before Wed Nov 4, 9:00 PM ET with a 2-hour margin.


---

## 13. Build plan: five days, ordered tasks with "done when"

Calendar: Day 1 = Sat Oct 31, Day 2 = Sun Nov 1, Day 3 = Mon Nov 2, Day 4 = Tue Nov 3, Day 5 = Wed Nov 4 (submit by 7:00 PM ET, two hours before the 9:00 PM ET deadline). Visit day is built before pre-visit because it carries the map, the engine, SAM, and the ops loop (the hardest and most visible parts); pre-visit and post-visit are then mostly runtime handlers plus two light screens. The inter-phase handoffs are never cut: if time runs short, cut breadth inside a phase (fewer ops action kinds, no kiosk voice, fewer cards), not a phase.

Each task below is one unit of work for Claude Code. Work them in order inside a day; tasks marked ∥ can run in parallel (separate worktrees or subagents) because they touch different packages. Every task ends with tests green and, for surfaces, a screenshot committed.

### Day 1 — foundation, engine spike, campus (Sat Oct 31)

| # | Task | Done when |
|---|---|---|
| D1-1 | Scaffold the monorepo (pnpm + Turborepo, Node 22, TypeScript strict, eslint, prettier, vitest, Playwright, Tailwind v4, Next.js 15 app, Hono runtime, Drizzle + better-sqlite3), `.env.example`, `README.md` skeleton, `docs/` files from this spec (SPEC.md, DESIGN.md, DO-NOT-CLAIM.md, BUILT-DURING-HACKATHON.md, DECISIONS.md, DEMO-SCRIPT.md), MIT license, GitHub Actions CI | `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build` all green on an empty app; CI runs on push |
| D1-2 | `packages/shared`: zod schemas for Journey, events (full catalog), capabilities, PRE_APPROVAL/BLOCKING sets, HumanReview, OpsAction, QueueState, Itinerary, Appointment, Order, memory allowlist, ModelCallRecord, API contracts, copy keys (en/es stubs) | Tests 1, 8, 14, 15 from 12.1 pass |
| D1-3 ∥ | Rust engine spike: crate with `version()` and `walkingRoute()`, both wasm-pack targets, called from a Node script and from a Next.js page using the campus fixture | A route Main Entrance → CT 2 prints with seconds in both hosts by 18:00; otherwise record the fallback decision in DECISIONS.md and start `packages/engine-ts` |
| D1-4 ∥ | `packages/hospital`: `campus.json` from section 3 (nodes, edges, stations, waiting areas, signage registry, hour-of-day queue baselines), graph utilities, `campus.validate.test.ts`, SVG signage renderer and ticket renderer | Test 21 passes; `pnpm render:signs` writes every sign as SVG under `docs/signs/` |
| D1-5 | Engine: `types.rs`, `campus.rs` (Dijkstra, matrix, mobility), `queue.rs`; wrapper `src-ts/index.ts` with zod validation; golden fixtures for routes and wait estimates | Tests 17 and the route/wait goldens pass; wheelchair property test passes |
| D1-6 | Engine: itinerary solver with projection and `replan` diff | 7-stop fixture solves < 5 ms; property tests for precedence and monotone ETAs pass |
| D1-7 | `packages/synthetic` first pass: patients, providers, slots, orders, payer, lis; `pnpm seed` | SQLite seeded; 200 patients and 30-day calendars; deterministic under `SEED=1104` |
| D1-8 | Design tokens and type in `apps/web` (theme.css, fonts), `Throughline`, `Stop`, `CurrentStop`, `ZoneChip`, `BigNumber`, `DeviceFrame` components with a Storybook-free `/dev/components` page | Screenshot of the component page committed; tokens are the only colors in the codebase (lint rule for raw hex outside theme.css) |

### Day 2 — visit day end to end (Sun Nov 1)

| # | Task | Done when |
|---|---|---|
| D2-1 | Runtime core: SQLite event log, EventBus, JourneyRuntime and OpsRuntime, Orchestrator (`EVENT_TO_CAPABILITY`), Registry, SafetyGate (grants, PRE_APPROVAL, BLOCKING, content classifier stub), AgentRunner with required-tool enforcement and fallback, HumanReview park-and-replay, SimClock with timers, SSE `/events/stream`, `ModelCallRecord` writer | Tests 2–7, 12 (stub), 13 pass with mock agents |
| D2-2 | Model clients: Spark 1.3 Responses tool loop, SAM 3.1 count with `@meta-sam/parser`, Muse Image script, provider router with `TIER_MODE` and `MODEL_CACHE` record/replay | A live smoke script prints one Spark tool call, one SAM count on a fixture frame, one generated card; cache record then replay returns identical output |
| D2-3 | Engine: discrete-event simulator with disruptions and ops actions; `whatIf` with replicates | 200 patients × 8 h < 15 ms per replicate in Node; what-if 3 actions × 20 replicates < 400 ms in the browser page |
| D2-4 ∥ | Agents: sensing (frame bank + SAM + fusion + bottleneck detection), itinerary (plan/replan), companion (next-stop message, sign-photo localization, directions, lost nudge, clinical refusal → handoff), results_watcher, ops (what-if tool, proposal, apply after approval) | The visit-day fixture runs from `PatientArrived` to `VisitCheckedOut` in replay mode with 2 replans, 1 proposal approved, 1 handoff; tests 9 (first 20 prompts), 10 pass |
| D2-5 ∥ | Frame bank and sign photos (`frames.ts`, `signs.ts`) generated with Muse Image, labeled with SAM, committed | 6 cameras × ≥ 40 labeled frames; 30 sign photos; test 22 passes |
| D2-6 ∥ | Patient phone (visit mode): the line, current stop, directions sheet with map snippet and steps, sign-photo upload, messages, "Talk to a person" | Screenshot at 390×844 passes the design checklist; axe clean |
| D2-7 ∥ | Station board (dark) with live rows, sparkline, Start/Done/Didn't arrive, tasks row | Screenshot 1280×800; keyboard-only Start/Done works |
| D2-8 | Command center: IsoMap (layers, tint, selected journey line, hover sparkline), journeys rail, proposals rail with Approve/Reject (HELD → check), day strip with SimClock, what-if slider wired to WASM | Screenshot 1536×960; approving a proposal re-plans affected journeys live over SSE |
| D2-9 | Visit-day dry run on Journey Control (first version: map + phone + board frames, scrubber for VISIT only) | Scenario beats 09:12–14:30 play at 10× without manual intervention |

### Day 3 — before the visit (Mon Nov 2)

| # | Task | Done when |
|---|---|---|
| D3-1 | `documents.ts`: referral fax PDF and insurance card generators with noise; three fixtures for Maria | Files render; Spark extraction on them returns a valid `ReferralPacket` ≥ 9 of 10 runs |
| D3-2 | Agents: referral_intake (structured output + clarification), eligibility, authorization (packet, PRE_APPROVAL), scheduler (engine `schedule` + explanation + alternative + no-show score + waitlist offer), prep (plan + cards), messenger (reminders by sim timers, reply handling, memory updates) | The pre-visit fixture runs `ReferralReceived` → `VisitConfirmed` with one HELD auth, one clarification, one voice reply; tests 3, 8, 11 (first contact) pass |
| D3-3 | Engine: scheduler with dependencies, fewest-days objective, alternative; goldens | Maria's plan equals the fixture (Nov 14 / Nov 17); 6 orders over 30 days < 50 ms; property tests pass |
| D3-4 ∥ | Voice: AudioWorklet capture → runtime `/voice` WebSocket → Meta realtime ASR relay; typed fallback path | A Spanish voice note becomes `PatientReplied` with the transcript; the typed path produces the same event |
| D3-5 ∥ | Intake queue screen (document left, packet with source crops right, clarifications, "Send to payer") and the patient phone pre-visit mode (days on the line, prep checklist, cards, reply box) | Screenshots pass the checklist; the coordinator can resolve the clarification and submit the auth from the UI |
| D3-6 | Clinical-content classifier (deterministic lists EN/ES + Spark check) and red-team fixture | Test 9 passes in full; false-positive rate on benign prompts < 5% |
| D3-7 | Fireworks LoRA dataset generator (`intake-sft.jsonl` from synthetic referrals → packets) | 500 rows validate against the JSONL chat format; no training run yet |

### Day 4 — after the visit, private tier, polish, dry runs (Tue Nov 3)

| # | Task | Done when |
|---|---|---|
| D4-1 | Agents: discharge (verbatim restatement, PRE_APPROVAL or disclaimer mode, teach-back with nurse task), followup (booking via engine, logistics check-in, closure report), results_watcher ack tracking with `ResultAckOverdue` | The post-visit fixture runs `VisitCheckedOut` → `ReferralClosed`; tests 10, 11 pass in full; test 16 passes end to end |
| D4-2 ∥ | Review screen (verbatim instructions beside the draft, approve/edit/send) and patient phone post-visit mode (summary sections, three teach-back screens, next visit) | Screenshots pass; Spanish summary reviewed by a human for wording |
| D4-3 | PHI tier: Modal Glimmer dedicated endpoint (or vLLM) up with scale-to-zero; `routeModelCall` live; `TIER_MODE=auto` default when the endpoint answers; timeout fallback | Test 12 passes; proof panel shows Glimmer calls for extraction and replies in a live run |
| D4-4 | Open-weight ops brain: Spark Open on Modal (Baseten/Fireworks as alternates) behind `OPS_BRAIN`; command-center switch; `GET /v1/models` check at boot | A proposal generated by Spark Open appears with provider and model id on the proof panel |
| D4-5 | Journey Control page complete: three frames, three-phase scrubber, cascade with HELD markers, proof drawer, "Run live / Replay" switch; `pnpm demo:reset` | Full scenario plays PRE → POST in replay mode in < 90 s at 60× (test 25) |
| D4-6 | Polish pass with the design checklist on every surface; copy review EN/ES; motion rules; reduced motion; axe on all pages | Tests 23–24 pass; `docs/screens/` updated |
| D4-7 | Record `fixtures/model-cache.sqlite` from a full live run; deploy runtime (Fly.io volume) and web (Vercel) in replay mode; `DEPLOY.md` | Public URL plays the scenario; nightly live job configured |
| D4-8 | Evening dry run of the video script with a stopwatch; fix the three worst moments | A full take under 3:10 recorded as a backup |

### Day 5 — video, docs, submission (Wed Nov 4)

| # | Task | Done when |
|---|---|---|
| D5-1 | Record the final video in segments on Journey Control (live mode where stable, replay elsewhere, labeled); voice-over; captions; export 1080p | Final cut ≤ 3:00, uploaded and public by 2:00 PM ET |
| D5-2 | README (description, three-phase diagram, real vs simulated, models and ids, setup, credits), `DO-NOT-CLAIM.md`, `BUILT-DURING-HACKATHON.md`, `DECISIONS.md` final | A stranger can run `pnpm install && pnpm seed && pnpm dev` and see the Journey Control page in < 10 minutes |
| D5-3 | Devpost submission: track, tags (Best Agentic Use-Case, Best Build on Open Weight Models), links, screenshots with the synthetic mark | Submitted and confirmed by 7:00 PM ET |
| D5-4 (only if D5-3 is done) | Stretch: Fireworks LoRA SFT on the intake dataset; or Three.js view of the campus; or Baseten alternate live | Documented honestly in the README as stretch work if shipped |

### Cut list, in order (use only if behind schedule)

1. Kiosk voice (keep typed check-in).
2. Muse Image cards (keep the text prep plan).
3. Waitlist offer and no-show score.
4. Spark Open switch (keep Spark 1.3 for ops, keep the Glimmer tier).
5. `call_volunteer` and `close_station` action kinds (keep `open_server` and `divert`).
6. Teach-back (keep summary + follow-ups).

Never cut: the three phases and their handoffs, the human gates, the proof panel, the replay mode, the design checklist.


---

## 14. Repo layout, environment, commands, conventions

### 14.1 Layout (final)

```
throughline/
  apps/
    web/                      Next.js 15 (App Router), React 19, Tailwind v4
      app/
        p/[journeyId]/        patient phone (pre / visit / post modes from journey.phase)
        kiosk/                check-in kiosk
        board/[stationId]/    station board (dark)
        ops/                  command center (IsoMap, proposals, what-if)
        journey/[id]/         Journey Control (demo page)
        intake/               coordinator: referrals, clarifications, prior auth
        review/               provider: summary review
        dev/components/       component sheet for design review
        theme.css             tokens (the only place colors are defined)
      components/             see 9.4
      lib/                    SSE client, engine loader (web), copy hook, formatters
      public/                 engine_bg.wasm, cards/, fonts
    runtime/                  Node 22 + Hono + ws
      src/
        index.ts              HTTP + SSE + voice WebSocket
        bus/                  EventBus, persistence (Drizzle), SimClock, timers
        core/                 JourneyRuntime, OpsRuntime, Orchestrator, Registry, SafetyGate, AgentRunner, HumanReview
        agents/<name>/        descriptor.ts, handler.ts, prompt.ts, handler.test.ts
        models/               spark.ts, sam.ts, voice.ts, image.ts, openweight.ts, glimmer.ts, router.ts, cache.ts, telemetry.ts
        sim/                  world simulator: patients, LIS, payer, channels (sms_sim, voice_sim), cameras (frame bank)
        api/                  routes: journeys, events, reviews, ops, stations, proof, demo (reset, jump)
        safety/               clinical-content classifier, redaction, PHI classifier for the tier router
  packages/
    shared/                   zod schemas, types, event catalog, capabilities, copy/en.ts, copy/es.ts, transitions.ts
    hospital/                 campus.json, graph.ts, signage.ts (renderer), ticket.ts, validate.ts
    engine/                   Rust crate + src-ts wrapper (+ pkg-web, pkg-node builds)
    engine-ts/                TS fallback implementing the same Engine interface (built only if the spike fails)
    synthetic/                generators, frames/, signs/, scenario.ts
  fixtures/                   journey-maria.json, day-2026-11-13.json, engine/, model-cache.sqlite, redteam.json
  infra/
    modal/                    glimmer_endpoint.py (vLLM, scale-to-zero), optional sam_selfhost.py
    fly/                      fly.toml for the runtime
  docs/
    SPEC.md                   this document
    DESIGN.md                 tokens, wireframes, checklist (section 9)
    DEMO-SCRIPT.md            section 10.3–10.5 with voice-over lines
    DO-NOT-CLAIM.md           section 11.3
    BUILT-DURING-HACKATHON.md timeline of commits per day, what was pre-existing (nothing but libraries)
    DECISIONS.md              section 15 + decisions made during the build
    DEPLOY.md                 Fly + Vercel + Modal steps
    screens/                  committed screenshots
    signs/                    rendered signage
  .github/workflows/ci.yml
  package.json, pnpm-workspace.yaml, turbo.json, .env.example, LICENSE (MIT)
```

### 14.2 Environment variables (`.env.example`)

```
# Meta Model API
META_API_KEY=
META_BASE_URL=https://api.meta.ai/v1
SPARK_MODEL=muse-spark-1.3
SAM_MODEL=sam-3.1
VOICE_MODEL=muse-voice-transcribe-1.0
IMAGE_MODEL=muse-image-1.0

# Open weights
OPEN_WEIGHT_PROVIDER=modal            # modal | baseten | fireworks
MODAL_SPARK_OPEN_BASE_URL=            # printed by `modal endpoint create --shared --model meta-models/Muse-Spark-Open-816B-A42B`
MODAL_API_KEY=
BASETEN_API_KEY=
BASETEN_SPARK_OPEN_MODEL=meta-models/muse-spark-open-1026   # falls back to meta-models/muse-spark-open if 404
FIREWORKS_API_KEY=
GLIMMER_BASE_URL=                     # Modal dedicated endpoint or vLLM
GLIMMER_API_KEY=
GLIMMER_MODEL=meta-models/Muse-Glimmer-30B

# Behavior
TIER_MODE=auto                        # auto | cloud_only | private_only
OPS_BRAIN=cloud                       # cloud | open
MODEL_CACHE=record                    # off | record | replay
PROVIDER_REVIEW_ON=true               # summary.send requires provider approval
SYNTHETIC_ONLY=true                   # app refuses to start if false outside tests
SEED=1104
SIM_START=2026-11-10T08:00:00-06:00
DATABASE_URL=file:./data/throughline.sqlite
RUNTIME_PORT=4000
NEXT_PUBLIC_RUNTIME_URL=http://localhost:4000
```

Secrets never reach the browser; the web app only knows `NEXT_PUBLIC_RUNTIME_URL`.

### 14.3 Commands

| Command | What it does |
|---|---|
| `pnpm install` | installs everything; `rustup` + `wasm-pack` required for the engine (documented in README) |
| `pnpm build:engine` | builds both WASM targets, copies `engine_bg.wasm` to `apps/web/public/` |
| `pnpm seed` | regenerates the SQLite file from `packages/synthetic` with `SEED` |
| `pnpm dev` | runtime on :4000 and web on :3000 with SSE; Journey Control at `/journey/maria-001` |
| `pnpm demo:reset` | resets the Maria scenario to its start |
| `pnpm demo:play --speed 60` | drives the scenario from the CLI (used by the Playwright smoke test) |
| `pnpm render:signs` | writes every sign and the ticket template as SVG to `docs/signs/` |
| `pnpm gen:frames` / `pnpm gen:cards` | one-time Muse Image generation + SAM labeling (needs keys; outputs are committed) |
| `pnpm test` / `pnpm test:e2e` | vitest + cargo test / Playwright |
| `pnpm bench:engine` | prints the four engine targets |
| `pnpm proof` | prints the proof summary for the last run (same data as the drawer) |

### 14.4 Conventions

- TypeScript strict; no `any`; zod schema is the type source (`z.infer`); runtime validation at every boundary (HTTP, model output, WASM output).
- Events are immutable, appended, never edited; aggregates are rebuilt from events in tests to prove the log is sufficient.
- Agents: one folder per agent; the required tool name is `agent.requiredTool`; prompts are plain strings in `prompt.ts` with the shared preamble imported from `safety/preamble.ts`.
- Copy: never a literal user-facing string in a component; always `t("key")` from `packages/shared/copy`.
- Styles: Tailwind utilities with tokens; no inline hex; no component-level CSS files except the IsoMap's SVG styles.
- Commits: conventional commits (`feat(runtime): …`, `feat(web): …`, `feat(engine): …`), one task per PR or commit series, and `BUILT-DURING-HACKATHON.md` updated daily.
- Rust: `cargo fmt`, `clippy -D warnings`, no `unwrap()` outside tests, errors serialized to JSON across the WASM boundary.
- Python (infra/modal only): one file per endpoint, pinned versions, no application logic.


---

## 15. Decisions log and open questions

### 15.1 Decisions already made (do not reopen during the build)

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | Scope is the full journey (before, during, after) as one state machine with explicit handoffs | Visit day only | A visit-day tool is a feature; the handoffs between phases are where US hospitals lose patients (no-shows, unacknowledged results, misunderstood instructions) and where "automated end to end" is demonstrable |
| 2 | Administrative only; clinical content is the provider's words; results are status only; symptoms go to a nurse | Light triage, result explanations | The anti-project in the rubric; FDA device line; AB 3030 / TRAIGA duties; the product is stronger with a sharp boundary |
| 3 | TypeScript monorepo (Next.js web, Node runtime) with a Rust → WASM engine | Python runtime (EIR's choice); Rust everywhere; TS everywhere | One language for app and agents; Rust where speed and dual-host determinism matter; bounded by a Day-1 spike and a TS fallback |
| 4 | Fictional campus (Halden Medical Center) with a real graph in `campus.json` | Reproduce a real hospital's floor plan | Avoids copying a real institution; structure follows real academic cancer centers; one data file drives map, engine, and simulation |
| 5 | Isometric SVG map, not 3D | Three.js | Reads faster in a 3-minute video, fits the budget, data model stays 3D-ready |
| 6 | Models: Spark 1.3 (cloud tier), Glimmer 30B on Modal (private tier), Spark Open on Modal/Baseten/Fireworks (switchable ops brain), SAM 3.1, Voice Transcribe, Muse Image | Muse Wonder as orchestrator; Fireworks LoRA as a core feature | Wonder costs 3–5× for no demo benefit; LoRA must be served on-demand and is a stretch |
| 7 | Required-tool pattern with code validation for every model agent; deterministic fallback for every agent | Free-form model output parsed by regex | `tool_choice` cannot be forced on the Meta API; validation in code is what makes the agent verifiable |
| 8 | Park-and-replay human gates (`PRE_APPROVAL`) and `BLOCKING` handoffs, borrowed from EIR and credited | Approve-by-editing-state | The replay of the verbatim event is auditable and testable |
| 9 | Simulated clock drives all timers | Wall-clock timers with shortened durations | Three phases in three minutes, reproducible |
| 10 | Record/replay model cache with visible labels | Live only; mocked only | Live for the video, replay for judges at any hour, honesty preserved by labeling |
| 11 | Frame bank generated with Muse Image, labeled by SAM, re-counted live | Stock photos; synthetic silhouettes | No licensing or identity risk; SAM is exercised live; counts match the simulation |
| 12 | Design: the line as the single memorable element; Atkinson Hyperlegible + Barlow Condensed; paper/ink/teal + zone colors; dark departures board for staff | SaaS dashboard kit; cards; chat UI | Grounded in hospital wayfinding vernacular; passes the anti-pattern review; readable by a 71-year-old and from two meters |
| 13 | English product, Spanish as the second patient language | Vietnamese | US market; Spanish is the largest second language in US hospitals; Voice Transcribe supports both |
| 14 | Visit day is built on Day 2, before pre-visit | Chronological order | It carries the hardest, most visible parts; pre- and post-visit are mostly handlers |
| 15 | Persona Maria Diaz, 71, Spanish-speaking, wheelchair after the voice reply | A younger English-speaking patient | Exercises language, mobility routing, memory, and the disclosure rules in one journey |

### 15.2 Open questions (owner: the builder; decide on Day 1 and record here)

1. Track: Indie or Startup on Devpost (depends on whether a company entity exists; the project is unaffected).
2. Whether the hackathon Baseten key resolves `meta-models/muse-spark-open-1026`; if not, the unsuffixed id is used and the README says so.
3. Whether the Modal credit is active on Day 1; if not, `TIER_MODE=cloud_only` until it is, and the proof panel states it.
4. Provider review on or off for the demo summary (`PROVIDER_REVIEW_ON`): on shows the gate; off shows the disclaimer path. Default on; the video shows both if time allows.
5. Whether to show the kiosk in the video at all (it is the least novel surface); default: one 3-second shot.

### 15.3 How to record new decisions

Append a row to `docs/DECISIONS.md` with date, decision, alternatives, and reason, in the same table format, the moment the decision is made. The Day-1 engine spike outcome is the first new row.


---

