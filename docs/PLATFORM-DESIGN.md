# Throughline: final frontend decision

Status: decided. This document replaces Proposals A, B and C and settles both critiques. Where it differs from a proposal, this document is the one to build.

---

## 1. Product framing

Throughline is the patient-access and visit-day workspace for Halden Medical Center. It is built for the staff who move referrals from fax to follow-up: the referral coordinator, the nurse navigator, the oncologist and the operations lead. Thirteen agents do the routine work for every patient in flight: they read faxes, check coverage, draft prior auths, book visits, message patients, guide them through the building, and close the loop. Staff only see the decisions that need a person: submitting to a payer, applying a floor change, signing a summary, and answering a clinical question. Each of those decisions is shown with the agent's draft next to its source.

Patients get their own simple app with one next step on each screen. The product opens on a busy hospital with about 36 referrals in progress and about 200 people in the building, not on one patient. Maria Diaz is one row among them.

---

## 2. Users and entry flow

### Personas (staff sign in by picking a person; no passwords)

| Person            | Role                 | Lands on                | Owns these gates and tasks                                                |
| ----------------- | -------------------- | ----------------------- | ------------------------------------------------------------------------- |
| Jordan Park       | Referral coordinator | `/inbox`, "Mine" filter | prior_auth.submit approval; intake questions; auth denied; "book by hand" |
| Renee Alvarez, RN | Nurse navigator      | `/inbox`, "Mine" filter | BLOCKING handoffs (messaging and companion agents); failed teach-back     |
| Dr. Okafor        | Medical oncology     | `/inbox`, "Mine" filter | summary.send signature; overdue result acknowledgment                     |
| Sam Whitfield     | Operations lead      | `/today`                | ops_action.apply approval                                                 |
| Patient           | Patient              | `/p/[id]`               | none                                                                      |

The discharge summary is signed by the clinician, never by the nurse (fixes Proposal B). "Dr. Okafor" is a staff identity and the author of one of the visit-note templates. The name is removed from hardcoded patient-portal copy, and the portal reads the provider from the appointment.

### Entry flow

1. **`/` is the sign-in screen, and it is also the product's front page.** It has two columns.
   - **Left (about 60%), the hero:** the live hospital rail. It is a horizontal 7-stop stage rail (Intake, Coverage, Prior auth, Scheduled, Visit day, After visit, Closed), with a live count under each stop.
     - Below the rail is a feed of the last 6 agent actions over SSE, each naming a different patient. Example: "Scheduling agent booked CT and consult for R. Chen, Nov 24", with the time on the right.
     - Below the feed is one sentence of computed figures: "212 people in the building today, 31 referrals in progress, 10 waiting on staff."
   - **Right (about 40%):** the wordmark "Throughline", then "Halden Medical Center".
     - One sentence: "Referrals, visit days and follow-up, run by 13 agents and approved by your staff."
     - "Sign in as" with four staff rows (avatar circle, name, role, and a live "4 items waiting").
     - A quieter row, "I'm a patient". It expands in place to a "Your visit code" field with a **Use a sample code** button, then **Open my visit**, which goes to `/p/[id]`.
   - Below the fold there are three short paragraphs: agents do the routine work, people approve what matters, patients get one plan. Each has one real screenshot. There is no pitch hero and no big-number tiles.
2. **Clicking a staff row** sets a `tl_user` cookie (localStorage fallback) and routes to that role's landing page. The name is sent as `by` on every resolve, so every timeline and lock marker reads "Approved by Jordan Park, 9:44 AM".
3. **A Getting started card is pinned in the sidebar** for every first sign-in. This is a real sequence, so it is numbered. Each step ticks itself off from real SSE events, and the card can be dismissed (state in localStorage).
   1. Receive a referral
   2. Approve an insurance submission
   3. Approve a change on today's floor
   4. See what the patient sees
4. **Switching role** is done from the workspace switcher at the top-left of the sidebar (avatar, name, role, caret). It is one click with no sign-out, so the video can change roles in a single take.
5. **Old links:** `/story` redirects to `/`, `/journey/[id]` redirects to `/patients/[id]`, and `/ops` redirects to `/today`.

A judge gets in with zero reading. The first screen is already moving. One click on Jordan opens an inbox with work in it, and the Getting started card names the next action.

**Cold-start protection.** `/` is a server component.

- If the runtime does not answer within 1.5 s, it renders counts from a committed `apps/web/lib/baseline-summary.json`, written when the baseline is built. Then it hydrates live.
- The page never shows "0 patients" or a spinner.
- The web app also pings `/healthz` on load, so the Modal container warms while the visitor reads.

---

## 3. Information architecture

### Global shell (all staff routes; `app/(staff)/layout.tsx`)

```
+----------------------+--------------------------------------------------------------------------+
| [JP] Jordan Park  v  | [ Search patients, MRN, ticket   / ]     Tue Nov 17, 9:42 AM   (o) 3 agents working  [bell 1]  [New referral] |
|      Referral coord. +--------------------------------------------------------------------------+
|                      |                                                                          |
| Getting started 1/4  |                         page content                                     |
|  [x] Receive a ref.  |                                                                          |
|  [ ] Approve insur.  |                                                                          |
|  ...                 |                                                                          |
|                      |                                                                          |
| Inbox            10  |                                                                          |
| Referrals        34  |                                                                          |
| Today                |                                                                          |
| Agents           13  |                                                                          |
|                      |                                                                          |
| Patient-facing       |                                                                          |
|   Patient app        |                                                                          |
|   Wayfinding map     |                                                                          |
|   Station displays   |                                                                          |
+----------------------+--------------------------------------------------------------------------+
```

- **Sidebar (232px).** Inbox count = pending items for the signed-in role. It turns red when a BLOCKING handoff is open.
- **Top bar (48px):**
  - Patient search (`/` focuses it) over the names, MRNs and tickets of journeys and in-house rows. Results open the record, or the light in-house drawer.
  - The hospital clock. It is read-only for everyone, with no speed control on screen.
  - "3 agents working" opens the live activity drawer. It replaces B's permanent rail.
  - A bell that counts BLOCKING handoffs only.
  - **New referral**, the always-present primary button.

### Routes (final, complete list)

| Route                | One line                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/`                  | Sign-in plus live hospital rail, agent feed and patient code entry                                             |
| `/inbox`             | Every item an agent parked for a person; list plus Source and Draft detail; `?item=<id>` deep-links            |
| `/referrals`         | All journeys as one table, filtered by the stage rail and saved tabs                                           |
| `/patients/[id]`     | Staff patient record: header, stage strip with agent tags and locks, attributed timeline, run view, tabs       |
| `/today`             | Visit-day command center: waiting room (SAM), station queues, floor map, proposed changes, in-house table      |
| `/agents`            | Roster of 13 agents with live status and metrics. A row opens the agent drawer (guardrails, runs, model calls) |
| `/p/[id]`            | Patient app (mobile, outside the shell)                                                                        |
| `/map`               | Wayfinding (outside the shell)                                                                                 |
| `/board/[stationId]` | Full-screen station display (outside the shell, dark)                                                          |

**Hard-cut now, not "if late":** `/activity`, `/patients` list, `/in-house` page, `/agents/[name]`, `/today/[station]`, `/operations/settings`, `/signin`, inline editing of drafts, any clock-speed UI.

The cut pages are covered elsewhere:

- Referrals has an "All, including closed" tab, so it covers the patient list.
- The in-house table is a tab inside Today.
- The agent detail is a drawer.

---

## 4. Key screens

### 4.1 `/`: sign-in

```
+-----------------------------------------------------------+------------------------------+
| Intake --- Coverage --- Prior auth --- Scheduled --- Visit day --- After --- Closed       |
|   3          6            6              8           4 + 208      10         5          |
|                                                           |  Throughline                 |
| 9:41  [SC] Scheduling booked CT and consult, R. Chen      |  Halden Medical Center       |
| 9:41  [CV] Coverage verified Lonestar PPO, A. Ndiaye      |  Referrals, visit days and   |
| 9:40  [IT] Itinerary moved Imaging before Labs, M. Diaz   |  follow-up, run by 13 agents |
| 9:39  [PM] Patient messaging confirmed visit, K. Ito      |  and approved by your staff. |
| 9:38  [OP] Ops planner proposed a 2nd lab chair           |  Sign in as                  |
| 9:37  [DS] Discharge drafted summary, L. Baptiste         |  (JP) Jordan Park   4 waiting|
|                                                           |  (RA) Renee Alvarez 3 waiting|
| 212 people in the building, 31 referrals in progress,     |  (DO) Dr. Okafor    3 waiting|
| 10 waiting on staff.                                      |  (SW) Sam Whitfield 1 waiting|
|                                                           |  I'm a patient               |
+-----------------------------------------------------------+------------------------------+
```

- **Primary action:** pick a person.
- **Agents shown:** feed glyphs and agent names.
- **Data:** `GET /api/overview` (new), SSE, `GET /api/inbox?role=` counts.
- **Empty or loading:** the baseline-summary fallback, as above. If the feed is empty, it shows the last 6 runs from the snapshot.
- **Mobile:** columns stack, sign-in first, and the rail scrolls horizontally inside its own box. The page itself never scrolls sideways.

### 4.2 `/inbox`: the center of the product

```
+-------------------------------+---------------------------------------------------------------+
| Needs you  [Mine] [All] [Done today]   | Approve insurance submission                         |
| Handoffs 1  Approvals 4  Questions 1   | R. Chen, Lonestar Health Plan, CT chest w/ contrast  |
| Tasks 3                                | [PA] Prior auth agent drafted this 6 min ago         |
|-------------------------------+        | Muse Spark 1.3, 3.1 s                                 |
|| red  Nurse handoff     2m    |---------------------------+---------------------------------|
||  D. Okoye  "fever since last |  Source                   |  Draft request                  |
||  night"            [PM]      |  [fax page 1, region      |  Diagnosis   C34.90             |
|| amb  Insurance        6m     |   outlined]               |  Orders      71260 CT chest     |
||  R. Chen  ready to submit [PA]|                          |  Justification ...              |
|| amb  Ops change       4m     |  Payer rule: Lonestar     |  Why                            |
||  Floor  2nd lab chair  [OP]  |  requires auth for 71260  |  - Order read from fax, p1      |
||  slate Question       20m    |                           |  - Rule LHP-CT-02 matched       |
||  K. Ito member ID     [IN]   |---------------------------+---------------------------------|
|                               | [Approve and submit]  [Send back]           Open record     |
+-------------------------------+---------------------------------------------------------------+
```

- **List (360px).** The left bar is red for BLOCKING, amber for approvals, slate for tasks and questions.
  - Sort: BLOCKING first, then approvals, questions and tasks, oldest first within each group.
  - Each row: kind in plain words, patient (or "Floor"), the agent's one-line reason, agent glyph, and age on the hospital clock.
- **Data:** a new `GET /api/inbox?role=&status=` merges three sources, joined with patient name, stage and the role that owns each capability:
  - pending `HumanReview`s;
  - journeys in `CLARIFICATION_NEEDED` (the Question kind; these are not reviews today);
  - a new auth-denied task opened on a denied `PriorAuthDecided`.
- **Detail: always Source | Draft, as one bordered panel with a divider.**

| Kind                                                             | Source pane                                                                                    | Draft pane                                                                                                                                                                                                  | Primary                                                            | Secondary |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------- |
| Insurance submission (PRE_APPROVAL)                              | Fax page with the read region, plus the payer rule                                             | `auth_packets[].draft` sections as fields, plus a "Why" list                                                                                                                                                | Approve and submit (toast: "Submitted to Lonestar Health Plan")    | Send back |
| Ops change (PRE_APPROVAL)                                        | SAM 3.1 frame thumbnail with count overlay ("SAM 3.1 counted 14"), plus the station QueueSpark | `Proposal.tsx` content: title, rationale, `WaitCurve` "Lab wait 42 → 18 min, forecast from 200 runs", affected patients as links, chip "Written by Ops planner on Muse Spark Open, open weights on Baseten" | Apply change ("Change applied")                                    | Dismiss   |
| Summary (PRE_APPROVAL)                                           | Visit note verbatim                                                                            | Plain-language summary. Hovering a line highlights its source line                                                                                                                                          | Sign and send ("Signed and sent")                                  | Send back |
| Nurse handoff (BLOCKING)                                         | Conversation so far                                                                            | "Why the agent stepped back" (classifier category or messenger `clinical`), plus a reply box. **Insert protocol reply** fills a fixed, pre-approved triage script for that category. It is never model text | Send as nurse ("Sent, handoff closed")                             | none      |
| Question (intake)                                                | Fax crop of the smudged field, plus the insurance card image                                   | The agent's question and a "Member ID" field. **Fill from insurance card** types the value                                                                                                                  | Send answer (posts `/clarify`; the timeline shows intake resuming) | none      |
| Task (auth denied, failed teach-back, overdue ack, book by hand) | Context                                                                                        | One sentence of what to do, plus a note field                                                                                                                                                               | Mark done                                                          | none      |

- **Send back requires a note.** It resolves the review with `decision: "sent_back"` and the note. The note appears in the timeline and feeds "Staff changed it".
- **After resolving:**
  - The item collapses (150ms).
  - A toast uses the button's verb.
  - The next item opens.
  - The primary button stays disabled until the source pane has rendered (image `onLoad`), so auto-advance cannot become blind approval.
- **Agents shown:** a glyph on every row, plus the drafting agent and model chip in the detail header.
- **Empty state:** "Nothing needs you. Agents are handling 34 referrals and 208 people in the building." with one button, **New referral**.
- **Loading:** skeleton rows (5) and an empty detail frame. No spinner.

### 4.3 New referral dialog (the "give the agents work" moment)

```
+------------------------------------------------------------------+
| New referral                                                      |
| +------------------------------+   Fax line, 3 unprocessed        |
| |  Drop a faxed referral       |   [thumb] Northgate Family Med   |
| |  PNG or PDF                  |   R. Chen, 2 pages, 8:51 AM [Use]|
| +------------------------------+   [thumb] Riverside Internal Med |
|                                    A. Ndiaye, 2 pages, 9:12 [Use] |
|                                    [thumb] Lakeview Primary Care  |
|                                    T. Moreau, 1 page, 9:30   [Use]|
|                                  [Receive referral]               |
+------------------------------------------------------------------+
```

- Sample data is presented as the **fax line**: faxes that arrived and are waiting. This is how an access team really receives referrals.
  - **Use** selects one.
  - **Receive referral** calls `POST /api/referrals {sample}`, which creates a new journey (`ref-1001`, and so on) with no reset, then routes to `/patients/[newId]`.
- **Fax-line samples:**
  - R. Chen: a clean fax that goes straight to a prior-auth draft.
  - A. Ndiaye: smudged member ID, so it raises a Question.
  - T. Moreau: missing diagnosis code, so intake asks for it. Ship this third fax only if recorded.
- Maria is **not** on the fax line, because a second Maria Diaz reads as fake. She stays a seeded row.
- **An uploaded file** that is not a known fax goes through the existing "documents unreadable" path: intake asks staff to key in the details. This is honest.
- **On the record**, the timeline streams the chain:
  1. Shimmer: "Intake agent is reading the fax…"
  2. The extracted fields appear beside the fax.
  3. "Coverage agent verified Lonestar Health Plan, $40 copay, prior auth needed for CT".
  4. "Prior auth agent drafted a request".
  5. An amber banner "Waiting on staff: approve submission" with **Review**, which opens the inbox item in a drawer.
- **Target:** 10–15 s of wall time from click to banner.
- Visitor-created referrals use a payer delay of 2 hospital minutes, so the scheduler books while the judge watches after approving.

### 4.4 `/referrals`

```
Referrals                                                                      [New referral]
Intake 3 --- Coverage 6 --- Prior auth 6 --- Scheduled 8 --- Visit day 4 --- After visit 10 --- Closed 5   (click = filter)
[Needs staff 10] [Due today] [Mine] [All] [All, including closed]
Patient            Referred by             For                  Stage      Waiting on              Next step                         Received  Flags
Maria Diaz  004417 Northgate Family Med    Med onc, new patient o-o-o-o-O-. [IT] Itinerary         Labs 9:50, Lab B, 2 ahead          9d 2h    Spanish, wheelchair
Ken Ito     004502 Riverside Internal Med  Med onc, new patient O-.-.-.-.-. (JP) Jordan Park       Answer intake question             3h 10m
Ruth Chen   004519 Northgate Family Med    Thoracic, new        o-o-O-.-.-. Payer                  Decision expected Nov 19           2d 4h
```

- **Primary action:** open a patient, or New referral.
- **"Waiting on"** names who has the next move:
  - an agent glyph and name (plus a scheduled time if known);
  - a staff avatar (amber);
  - "Patient";
  - "Payer".
- **"Next step"** is one sentence.
- Both come from a shared `stageOf(journey)` and `nextStepOf(journey, reviews)` in `packages/shared`.
- **"Received"** turns amber after 2 business days if the referral is still unscheduled (the SLA).
- **Rows:** 40px. A click opens the record.
- **Empty filter:** "No referrals in Prior auth right now." with a "Show all" link.
- **Loading:** 8 skeleton rows.

### 4.5 `/patients/[id]`: the patient record

```
+----------------------------------------------------------------------------------------------------+
| Maria Diaz   61, F   MRN 004417   Spanish   Uses wheelchair   Companion: son   Lonestar PPO          |
| Intake ---- Coverage ---- Prior auth ---- Scheduled ---- Visit day ---- After ---- Closed            |
|  [IN]        [CV]         [PA]<lock JP>    [SC][VP][PM]   [IT][CO] now                               |
| ! Discharge agent is waiting for Dr. Okafor's signature                         [Review]            |
+--------------------------------------------------------------------+-------------------------------+
| [Activity] [Documents] [Plan] [Messages] [Today]                    | Next step                     |
|                                                                    | Itinerary agent holds Labs    |
| 9:41  [IT] Itinerary agent moved Imaging before Labs.               | 9:50, Lab B, 2 ahead          |
|       Labs queue rose to 24 min.  Rust scheduling engine   Show run | [Open patient app]            |
| 9:40  (SW) Ops change approved by Sam Whitfield: 2nd lab chair      |-------------------------------|
| 9:12  [CO] Visit companion sent step-free directions (Spanish)      | Agents on this patient        |
|       Muse Spark 1.3, 1.1 s                               Show run  | Intake          done          |
| 8:58  (patient) Maria replied "Ya llegué"                           | Coverage        done          |
| Nov 10 [PA] Prior auth agent drafted request.                       | Prior auth      done, lock JP |
|       Approved by Jordan Park.                                      | ... 13 rows, lifecycle order  |
+--------------------------------------------------------------------+-------------------------------+
```

- **Header:** demographics, payer, and flags from `journey.memory`.
- **Stage strip:** one continuous teal line. Each stage carries the tags of the agents that acted in it. Each gate is a lock marker labelled with the initials of the person who cleared it, or amber while it waits. Hovering a tag highlights its timeline entries.
- **Pending banner:** shown only when this patient has an open inbox item. **Review** opens the same Source | Draft pane in a right drawer.
- **Activity timeline** (default tab). It is `GET /api/journeys/:id/timeline` (new): events joined with `agent_runs` and the actor. There are five kinds:
  - agent action (teal square glyph);
  - staff decision (circle avatar);
  - patient message (outline circle);
  - waiting on staff (amber);
  - used approved template (grey; this is `used_fallback`, labelled truthfully).
- **Show run** expands inline:
  - the trigger;
  - tools called;
  - the structured output as fields (never JSON);
  - the outcome: Applied, Sent to staff, Handed to nurse, Blocked by message screen, or Used approved template;
  - model, latency and tokens.
- **Intake run view:** the fax image on the left, extracted fields on the right, each marked "Read clearly", "Inferred" or "Needs check". These are categorical labels, never percentages.
- **Tabs:**
  - Documents: fax, card, summary, prep plan.
  - Plan: orders, auth packets, appointments with the scheduler's `explanation` and alternative plan, no-show score with its drivers.
  - Messages: the `outreach_log` thread, plus a "Log patient reply" box with example chips and a "Log voice note" control (section 6).
  - Today: shown only on the visit day. Itinerary stops with ETAs and the replan diff.
- **Right rail:** the Next step box, then "Agents on this patient", 13 rows with a status of done, working, waiting, later, or not needed.
- **Empty:** a brand-new referral shows the timeline with one "Referral received" row and the intake shimmer.
- **Loading:** the header skeleton, then the timeline streams in.

### 4.6 `/today`: visit-day command center (Sam's home)

```
+---------------------------+-------------------------------------+-------------------------------+
| Waiting room              | Floor map (IsoMap, queue heat)      | Proposed changes (1)          |
| [SAM frame + 14 overlay]  |                                     | Open a 2nd lab draw chair     |
| SAM 3.1 counted 14        |                                     | Lab wait 42 -> 18 min         |
| trend QueueSpark          |                                     | Ops planner, Muse Spark Open  |
+---------------------------+-------------------------------------+ [Review]                      |
| Station queues: Lab 9 / 2 chairs / 24 min  QueueSpark ...  [Open station display]  | Predicted delays (Rust)  |
+--------------------------------------------------------------------------------------------------+
| [Stations] [In the building 212]   table: ticket, initials, station, next stop, ETA, wait, flag   |
+--------------------------------------------------------------------------------------------------+
```

- It reuses `command-center.tsx` inside the shell, with the speed buttons removed.
- Every tile links somewhere:
  - Waiting room opens the Sensing agent drawer.
  - A station opens `/board/[id]`.
  - A proposal opens the inbox item.
  - A delay filters the in-building table.
- **In the building tab:** the 4 live journeys link to full records. The roughly 208 background rows open a light drawer with station history only. They never claim agent runs.
- **Primary action:** review the proposed change.
- **Empty proposals:** "No changes proposed. Ops planner checks queues every 5 minutes."

### 4.7 `/agents`: the roster (with drawer)

The page opens with a header sentence that is computed, never hardcoded: "Today 13 agents ran 1,104 steps for 36 patients. 962 finished on their own, 27 waited for staff, 3 were handed to a nurse."

Below it is one table in three groups. See section 5 for the columns. A row opens a right drawer with:

- the job paragraph;
- "What it can do" (capabilities as verbs);
- inputs and outputs (events it listens for and emits);
- the **Guardrails** list with locks;
- recent runs (rows open the same run view);
- model calls for this agent.

The only live switch is "Clinician signs summaries before sending" (`PROVIDER_REVIEW_ON`). It is shown to Dr. Okafor and Sam only.

### 4.8 `/p/[id]`: patient app

Keep `patient-portal.tsx` (Before / Visit day / After / To do / Messages). Changes:

- The provider comes from the appointment.
- Composer chips: **Use a sample reply**.
- **Use a sample voice note** posts the recorded wav to `/voice` and shows the transcript.
- "Lost? Send a photo of the nearest sign" has **Use a sample photo**.
- When the cookie is staff, the header shows "Back to staff view".

---

## 5. Agents in the product

### Names, glyphs, models, gates

Agent glyphs are 22px teal rounded squares (6px radius) with a white two-letter monogram. People are circles. The names below are used on every surface.

| Agent (code id) | On screen            | Glyph | Runs on (chip)                                                                       | Gate                                   |
| --------------- | -------------------- | ----- | ------------------------------------------------------------------------------------ | -------------------------------------- |
| referral_intake | Intake               | IN    | Muse Spark 1.3 vision                                                                | none (asks staff questions)            |
| eligibility     | Coverage             | CV    | Payer rules                                                                          | none                                   |
| authorization   | Prior auth           | PA    | Muse Spark 1.3                                                                       | lock: staff approve before submit      |
| scheduler       | Scheduling           | SC    | Rust scheduling engine                                                               | none                                   |
| prep            | Visit prep           | VP    | Rules                                                                                | none                                   |
| messenger       | Patient messaging    | PM    | Muse Spark 1.3; Voice Transcribe for voice notes                                     | lock: clinical replies go to a nurse   |
| itinerary       | Itinerary            | IT    | Rust scheduling engine                                                               | none                                   |
| sensing         | Waiting-room sensing | WS    | SAM 3.1                                                                              | none                                   |
| companion       | Visit companion      | CO    | Muse Spark 1.3 (messages), directions in code, Muse Spark 1.3 vision for sign photos | lock: clinical questions go to a nurse |
| ops             | Ops planner          | OP    | Muse Spark Open, open weights on Baseten (switchable to Muse Spark 1.3)              | lock: ops lead approves before apply   |
| results_watcher | Results watch        | RW    | Rules                                                                                | opens clinician task                   |
| discharge       | Discharge            | DS    | Muse Spark 1.3 (summary and teach-back grading)                                      | lock: clinician signs before send      |
| followup        | Follow-up            | FU    | Rust scheduling engine                                                               | can open "book by hand" task           |

### Where each agent appears (beyond the roster)

| Agent                | Surfaces                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Intake               | Landing feed; fax-read shimmer and run view (fax next to fields) on the record; Question items in the inbox; "Waiting on" in Referrals for Intake rows |
| Coverage             | Feed; timeline ("verified Lonestar, $40 copay, auth needed"); Plan tab coverage block                                                                  |
| Prior auth           | Inbox Insurance items (drafting agent plus model chip); lock marker on the stage strip; feed                                                           |
| Scheduling           | Timeline with the engine `explanation`; Plan tab alternative plan and no-show score with drivers; "Waiting on"                                         |
| Visit prep           | Timeline; Documents tab prep plan; Messages thread                                                                                                     |
| Patient messaging    | Messages tab (each outbound message tagged); handoff items in the inbox; voice note transcript chip "Voice Transcribe"                                 |
| Itinerary            | Today tab on the record with replan diff; feed entry after an ops change ("moved Imaging before Labs"); patient app stops                              |
| Waiting-room sensing | Today waiting-room tile (SAM frame with count); Source pane of every ops change                                                                        |
| Visit companion      | Messages (directions in Spanish); handoff items; patient app directions; sign-photo locate in the timeline                                             |
| Ops planner          | Today proposals; inbox Ops change items with the open-weights chip and Rust forecast                                                                   |
| Results watch        | Overdue-ack tasks for Dr. Okafor; timeline status messages                                                                                             |
| Discharge            | Inbox Summary items (verbatim next to plain); teach-back results in the timeline; failed teach-back tasks                                              |
| Follow-up            | Timeline follow-up bookings and closure report; Closed stage; "book by hand" tasks                                                                     |

Across all of them, the agent glyph appears in Referrals "Waiting on", every timeline row, every inbox row, the landing feed, the "agents working" drawer and the record's agent rail. That follows B's rule: **an agent appears only where it touched real work.**

### Roster columns and metric definitions (computed server-side in `GET /api/agents`)

| Column                 | Definition                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Status                 | Working (pulsing ring) if a run is open; Waiting on staff (n) if it has pending reviews; otherwise Idle |
| Runs today             | count of `agent_runs`, plus a 24h sparkline                                                             |
| Finished on its own    | runs with outcome `applied` and `used_template = false`, divided by runs                                |
| Waited for staff       | runs with outcome `parked`                                                                              |
| Handed to nurse        | runs with outcome `handoff`. Shown neutrally, never as failure                                          |
| Staff changed it       | reviews resolved `sent_back`, divided by resolved reviews. Shows "n/a" if the agent has no gate         |
| Used approved template | runs with `used_template = true`, divided by runs                                                       |
| Median time            | p50 of `finished_at - started_at`                                                                       |

- Rules and engine agents show "n/a" in model-only columns, never 0.
- Replay cache misses are recorded as `used_template` on the run. They are excluded from the model-calls table and from every success rate, so the two `success:false` retry rows that `agent-runner.ts:107-119` writes never show up as errors.
- The word "replayed" never appears on screen.

### Human gates

There are four gates and all four stay:

- insurance submit (coordinator);
- ops apply (ops lead);
- summary send (clinician);
- nurse handoff (nurse, BLOCKING).

They appear in four places:

1. as inbox kinds with colored bars;
2. as lock markers on the record strip, labelled with who cleared them;
3. as lock rows in each agent's Guardrails ("Submitting to the payer always needs coordinator approval"; "Clinical questions always go to a nurse"; "Patient messages are screened, and anything clinical uses an approved template"; "Ops changes apply only after the operations lead approves"; "Summaries are signed by the clinician before sending");
4. as "Approved by …" lines in the timeline.

### Meta model credit

- Every model step carries a chip with model, mode and latency, for example "Muse Spark 1.3 vision, 2.1 s".
- Ops planner's chip reads "Muse Spark Open, open weights on Baseten" on the roster, on proposals and in the inbox.
- SAM 3.1 is credited on the waiting-room frame. Voice Transcribe is credited on the voice-note transcript.
- **Muse Image is not credited on screen**, because the runtime has no visible use of it (it only built the offline camera frame bank). Its credit goes in the README and Devpost only.

---

## 6. Data

### Population: a baseline snapshot, built locally and loaded at boot

The hospital clock is set to Tue Nov 17 2026, 9:30 AM (the fixture visit day). Referral receipt times are staggered over the previous 14 days.

| Stage                 | n                                 | States and the inbox items they create                                                                                                                                                 |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake                | 3                                 | 1 `CLARIFICATION_NEEDED` (Question, Jordan); 1 received 9:20 and extracted; 1 coverage done                                                                                            |
| Coverage / Prior auth | 6                                 | 2 drafts parked (Insurance, Jordan); 2 submitted, awaiting payer; 1 denied (Task, Jordan); 1 approved and being scheduled                                                              |
| Scheduled             | 8                                 | Visits Nov 18 to Dec 2; 2 high no-show risk; 1 reschedule handled; **1 clinical reply, open BLOCKING handoff (Renee)**; 2 with wheelchair or companion memory                          |
| Visit day             | 4 live, plus about 208 background | **Maria** on the full visit-day autopilot; 3 others arrived with itineraries, with arrive, start and done timers driven from background `SimResult` timings; 1 ops change parked (Sam) |
| After visit           | 10                                | 2 summaries parked (Dr. Okafor); 3 teach-backs pending; 1 failed teach-back (Task, Renee); 1 overdue result ack (Task, Dr. Okafor); 3 check-ins pending                                |
| Closed                | 5                                 | Closure reports                                                                                                                                                                        |

- **Total: 36 journeys. The inbox holds 10 items at boot:** Jordan 4, Renee 2, Dr. Okafor 3, Sam 1. Every persona has at least one item; the ops proposal keeps refiring when the queue grows.
- **Resolved history** is seeded so the metrics are not all 100%. It includes 2–3 send-backs with notes (one auth draft, one summary). Each resolution carries a named reviewer and a time.

### Runtime changes (all in `apps/runtime` and `packages`)

1. **`agent_runs` table.** Fields: `id, agent, capability, journey_id?, station_id?, trigger_event_id, trigger_type, started_at, finished_at, outcome (applied|parked|handoff|blocked), used_template, summary, emitted_event_ids, model_call_ids, review_id?`.
   - Written in `core/runtime.ts` `invoke`, `apply` and `park` (around lines 208–330), and in `screenOutbound` (outcome `blocked`).
   - `run_id` and `agent` are passed via `HandlerContext`, so `AgentRunner.baseRecord` stamps model calls.
   - Every stored event gets `actor` (`agent:<name>`, `staff:<name>`, `patient`, `payer`, `system`).
   - `AgentRunStarted` and `AgentRunFinished` go out on SSE as telemetry, not as domain events.
2. **Endpoints:**
   - `GET /api/overview` (stage counts, in building, waiting on staff, runs today)
   - `GET /api/inbox?role=&status=`
   - `GET /api/agents` (descriptors, runs-on map, gates, aggregates)
   - `GET /api/agents/:name/runs`
   - `GET /api/journeys/:id/timeline`
   - `GET /api/runs/:id`
   - `POST /api/referrals {sample}`
   - `/api/journeys?stage=` filters
3. **Reviews.** `HumanReview` (`packages/shared/src/ops.ts:45`) gets `decision: approved|sent_back`, `note` and `resolved_by`. `POST /api/reviews/:id/resolve` accepts them, and `sent_back` requires a note.
4. **De-Maria the agents:**
   - Generic intake question built from `field`.
   - Order template chosen from the referral's services.
   - 3 visit-note templates (Okafor, Brooks, Patel) replacing `MARIA_VISIT_NOTES`.
   - Parameterized `referralSvg(patient, services, memberIdVisible)` and `cardSvg(patient)`, plus Chen, Ndiaye and Moreau faxes and `-truth.json` manifests.
   - Scheduler booked-count overlay from existing appointments (no double booking).
   - Auth-denied task.
5. **`demo/population.ts`.**
   - Runs locally and drives the 36 journeys through real events: ReferralReceived, clarify, resolve, clock advance, replies, checkout.
   - It never calls `store.reset()` between journeys.
   - It writes `fixtures/baseline.sqlite` and `apps/web/lib/baseline-summary.json`.
   - Modal loads the snapshot at boot.
6. **Keeping the inbox alive for multiple judges:**
   - **Auto-restore:** the runtime restores the baseline when no request has arrived for 10 minutes, or when fewer than 4 inbox items are pending and the last visitor action was more than 2 minutes ago.
   - **Fax line refill:** one new unprocessed fax appears every 20 hospital minutes, up to 3.
   - Visitor referrals are capped at 20 per container, oldest dropped first.
   - `POST /api/admin/restore` and `POST /api/admin/clock` (jump) require `ADMIN_TOKEN` and have no UI.
7. **Clock.** It runs server-side at a fixed 2x. There is no speed UI. Jump is admin-token only, for recording.
8. **Public routes removed.** `/api/story*` and `/api/demo/*` are taken off the public router (kept behind `ADMIN_TOKEN` for development). No route the UI can reach resets state.
9. **Replay normalization.** Done at prompt build, not in the cache, so Maria's recorded keys stay valid.
   - Fix any prompt that embeds a journey id, an absolute `now`, or the auth packet id.
   - Patient names and appointment times differ for new patients and are expected to miss unless recorded.

### "Use sample data" buttons (complete list)

| Input                                                 | Button                                                                                                                                                            | Calls                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| New referral fax                                      | Fax line list with **Use**                                                                                                                                        | `POST /api/referrals {sample: "chen"\|"ndiaye"\|"moreau"}` |
| Intake question                                       | **Fill from insurance card**                                                                                                                                      | `POST /api/journeys/:id/clarify`                           |
| Nurse handoff reply                                   | **Insert protocol reply** (fixed triage script)                                                                                                                   | resolve review plus message                                |
| Send back note                                        | none (the note is free text, required)                                                                                                                            | resolve with `sent_back`                                   |
| Log patient reply (record) and composer (patient app) | Example chips: "Can my son come with me?", "I need to move my appointment", "I've had a fever since last night" (the last one triggers the live BLOCKING handoff) | `POST /api/journeys/:id/reply`                             |
| Voice note                                            | **Use a sample voice note**                                                                                                                                       | `POST /api/journeys/:id/voice` with the recorded wav       |
| Lost-patient sign photo                               | **Use a sample photo**                                                                                                                                            | `POST /api/journeys/:id/locate`                            |
| Patient visit code                                    | **Use a sample code**                                                                                                                                             | client lookup, then `/p/[id]`                              |
| Station board                                         | existing Start, Done and Didn't arrive actions                                                                                                                    | `/api/stations/:id/actions`                                |

Words never used on screen: demo, synthetic, mock, simulated, simulation (the Rust forecast says "forecast from 200 runs"), play, replayed, proof.

---

## 7. Visual direction

**Subject:** hospital wayfinding signage meeting a clinical worklist. The design is dense, calm and legible to tired eyes, and uses color only to mean something.

### Color tokens (`app/theme.css`, light only for the staff console)

| Token                      | Hex               | Use                                                             |
| -------------------------- | ----------------- | --------------------------------------------------------------- |
| `--paper`                  | #F4F6F5           | App background (cool grey-green, not cream)                     |
| `--panel`                  | #FFFFFF           | Lists, tables, panes                                            |
| `--rule`                   | #D9DFDC           | 1px dividers and row lines                                      |
| `--ink`                    | #18223A           | Text, active nav                                                |
| `--ink-soft`               | #4B5566           | Secondary text                                                  |
| `--agent`                  | #0F766E           | Agent glyphs, the stage line, primary button, focus ring, links |
| `--agent-tint`             | #E3F1EF           | Working shimmer, selected row                                   |
| `--staff` / `--staff-bg`   | #9A4507 / #FDF1DC | Waiting on staff, approvals, the pending gate node              |
| `--urgent` / `--urgent-bg` | #B42318 / #FDECEA | BLOCKING handoff and overdue only                               |
| `--slate`                  | #64748B           | Task and question bars, template-used entries                   |

The zone colors (blue, gold, green, rose, violet) are used only on `/map`, station boards and the patient app, where they mean physical zones. They are never used on agents (B's lifecycle hues are dropped). Station boards keep their dark style.

### Type

- **Atkinson Hyperlegible** (UI text) and **Barlow Semi Condensed** 500/600 (figures, page titles, stage names, patient names, clock), both already loaded. All figures use `tabular-nums`.
- Scale (px): 12 meta, 13 table, 14 body (line height 1.45), 16 section title, 20 patient name (Barlow 600), 22 page title (Barlow 600), 28 stat figure (Barlow 500).
- The patient app keeps a 17px base.
- Copy rules:
  - Sentence case everywhere.
  - No all-caps labels or eyebrows.
  - No middle-dot meta strings (use cells or commas).
  - No monospace.
  - No trailing arrows on buttons.
  - No single accented word in a headline.

### Density and shape

- Table rows are 40px, on an 8px grid.
- Sidebar 232px, inbox list 360px, record rail 300px.
- Radius: 4px chips and inputs, 6px agent glyphs and panels, 8px dialogs and drawers, 0 on table rows. People avatars are full circles.
- Shadows only on drawers, dialogs, popovers and toasts. No gradients and no card grids; lists are tables.
- Status is always a left bar or a chip, never a whole-card wash.

### The one bold element: the stage rail, with shape-coded actors on it

- `StageRail` is one component at three sizes:
  - hospital (landing and the top of Referrals: counts, clickable);
  - record (labelled stops, agent tags, lock markers with initials);
  - row (64px micro rail in tables).
- It is drawn as a 2px teal line. Done nodes are filled teal and the current node has a ring. The node turns amber when a person must act and red when blocked.
- It is the same line as the wayfinding route on `/map`, so staff and patient surfaces share one mark.
- **Ambient motion is used once:** a slow shimmer on the node or timeline entry of an agent that is working. All other motion answers an action: a timeline row slides in on an SSE event, a resolved inbox item collapses, a drawer slides in, and a rail dot advances once with the count ticking. `prefers-reduced-motion` is respected.

### What keeps it from looking generic

- The signage typeface on figures.
- Squares for agents and circles for people, readable without color.
- A teal line that literally threads every surface.
- Source | Draft as one bordered panel.
- Real hospital nouns throughout (fax line, member ID, payer rule, lab chair).
- No KPI tile rows; computed sentences instead.

### Component list (new, in `apps/web/components/`)

`AppShell`, `Sidebar`, `TopBar`, `WorkspaceSwitcher`, `GettingStarted`, `AgentGlyph`, `Avatar`, `ActorMark`, `ModelChip`, `StatusChip`, `StageRail` (three sizes), `DataTable`, `Drawer`, `Dialog`, `Toast`, `InboxList`, `SourceDraftPane` (plus 6 kind renderers), `Timeline`, `RunView`, `FaxFieldsView`, `AgentRow`, `GuardrailList`, `LiveActivityDrawer`, `SampleButton`, `ExampleChips`.

New hooks: `useRuntimeStream()` (one EventSource in context) and `useUser()`.

---

## 8. Reuse and delete

### Reuse

- `apps/web/app/p/[journeyId]/patient-portal.tsx`: remove the Okafor strings (~598, 611, 631), read the provider from appointments, add sample chips, voice and photo buttons.
- `apps/web/lib/visit-guide.ts`: remove Okafor (lines 52–74).
- `apps/web/app/board/[stationId]/station-board.tsx`: unchanged.
- `apps/web/app/ops/command-center.tsx`: becomes the body of `app/(staff)/today/page.tsx`. Speed buttons removed, plus the In the building tab.
- `apps/web/components/Proposal.tsx`: becomes the Ops-change Draft pane.
- `apps/web/components/Throughline.tsx`: reworked into `StageRail`.
- `IsoMap.tsx`, `FloorMap.tsx`, `Wayfinding.tsx`, `DirectionsSheet.tsx`, `MapSnippet.tsx`, `QueueSpark.tsx`, `WaitCurve.tsx`, `MessageBlock.tsx`, `ZoneChip.tsx`, `Stop.tsx`, `CurrentStop.tsx`, `DeviceFrame.tsx` (the "Open patient app" side panel).
- `apps/web/app/theme.css`: extend it with the tokens above.
- `apps/web/lib/runtime.ts`. Add:
  - `fetchOverview`, `fetchInbox`, `fetchJourneys`, `fetchTimeline`, `fetchAgents`, `fetchAgentRuns`, `fetchRun`
  - `resolveReview(id, {decision, note, by})`
  - `postReferral`, `postClarify`, `postReply`, `postVoice`, `postLocate`
  - Replace the per-widget `subscribe*` calls with `useRuntimeStream`.
- `apps/runtime/src/demo/referral.ts`: keep the single-referral logic, without `store.reset()`, as the body of `POST /api/referrals`.

### Delete

- `apps/web/app/story/` (`story.tsx`, `steps.ts`)
- `apps/web/app/journey/[id]/`
- the current `apps/web/app/page.tsx` pitch
- `apps/web/components/SiteHeader.tsx`
- `apps/web/components/BigNumber.tsx`
- the story and scenario fetchers in `lib/runtime.ts`

### Runtime

- Unmount `/api/story*`, `/api/demo/referral`, `/api/demo/scenario` and `/api/demo/visit-day` from the public router in `apps/runtime/src/app.ts`, and keep them behind `ADMIN_TOKEN`.
- `apps/runtime/src/demo/story.ts` stays for development only, unused by the UI.

---

## 9. Build plan (one agent, Sun Nov 1 to Tue Nov 3; Wed Nov 4 is video and buffer only)

### Day 1 (Sun): runtime

| #   | Milestone                                                                                                                                                                                                                                                                                      | Hours | Acceptance check                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| M0  | **Replay spike and safety net.** Write a test that runs Maria's full chain and asserts its terminal state and replayed counts. Then create a second journey from Maria's fax at another clock time and check which prompts hit the cache. Normalize ids and `now` out of prompts at build time | 1.5   | Maria's test is green. The report lists per-capability hit or miss for a new journey                                      |
| M1  | `agent_runs`, `actor` on events, run telemetry on SSE, `/api/agents`, `/api/agents/:name/runs`, `/api/journeys/:id/timeline`, `/api/runs/:id`; cache misses recorded as `used_template`                                                                                                        | 3     | Maria's test is still green. `/api/agents` returns 13 rows with nonzero runs. Every timeline event has an actor           |
| M2  | Review `decision`, `note` and `resolved_by`; `/api/inbox` merging reviews, clarifications and the auth-denied task                                                                                                                                                                             | 1     | Resolving with `sent_back` and no note returns 400. The inbox lists questions and tasks with patient names                |
| M3  | De-Maria: intake question, order template, 3 note templates, parameterized fax and card plus the Chen, Ndiaye and Moreau faxes, slot overlay                                                                                                                                                   | 2     | Two journeys booked on the same day get different slots. A Ndiaye referral raises a member ID question with generic text  |
| M4  | `POST /api/referrals`, public reset routes removed, fixed 2x clock, admin restore and jump, payer delay of 2 hospital minutes for visitor referrals                                                                                                                                            | 1     | No UI-reachable route calls `store.reset()` (grep). A visitor referral reaches the parked auth in under 15 s of wall time |
| M5  | `population.ts`, then `baseline.sqlite` and `baseline-summary.json`, loaded at boot; auto-restore and fax-line refill; seeded send-backs                                                                                                                                                       | 3.5   | Cold boot shows 36 journeys and 10 inbox items split as 4/2/3/1. Emptying the inbox and idling triggers a restore         |
| M6  | Ask the owner the recording question (section 11) with an exact count. If yes, run `MODEL_CACHE=record` for the approved scope and commit the cache                                                                                                                                            | 0.5   | `/api/proof` shows replayed hits for those journeys                                                                       |

### Day 2 (Mon): shell and the core loop

| #   | Milestone                                                                                                                                               | Hours | Acceptance check                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------- |
| M7  | Tokens, `AppShell`, sidebar, top bar (search, clock, agents-working drawer, bell, New referral), `useRuntimeStream`, `useUser`, switcher, primitives    | 3     | One EventSource per tab (network panel). Switching role changes the inbox count without a reload                       |
| M8  | `/` sign-in with the hospital rail, feed, staff counts, patient code, baseline fallback                                                                 | 1.5   | With the runtime stopped, `/` still renders the counts. At 390px width nothing scrolls sideways                        |
| M9  | `/inbox`: list, 6 Source and Draft renderers, Send back, protocol reply, Fill from card, auto-advance with the source-loaded guard, toasts, empty state | 4     | All four gates and both task kinds resolve end to end. The timeline then shows "Approved by …"                         |
| M10 | New referral dialog, `/patients/[id]` (header, strip with tags and locks, timeline, RunView with fax fields, Plan, Messages with chips and voice)       | 3.5   | Chen fax to the parked auth banner streams live. The fever chip opens a BLOCKING handoff that appears in Renee's inbox |

### Day 3 (Tue): breadth, polish, deploy

| #   | Milestone                                                                                                                                                                                                                                        | Hours | Acceptance check                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------- |
| M11 | `/referrals` with the hospital rail filter, saved tabs, row rail, "Waiting on", "Next step"                                                                                                                                                      | 1.5   | Every one of the 36 rows has a non-empty Waiting on and Next step                                                |
| M12 | `/agents` roster, computed header sentence, drawer with guardrails, runs and model calls                                                                                                                                                         | 2     | No metric reads 0% or 100% for every agent. Rules agents show n/a. "replayed" and "proof" do not appear anywhere |
| M13 | `/today` in the shell with SAM tile, proposals, In the building tab, light drawer for background rows                                                                                                                                            | 1.5   | Applying the ops change replans Maria's itinerary, and the feed shows it                                         |
| M14 | Patient app cleanup, Getting started card, delete story, pitch and SiteHeader, redirects                                                                                                                                                         | 1     | All 4 Getting started steps tick themselves off in a clean run                                                   |
| M15 | Copy grep for `demo\|synthetic\|mock\|simulat\|play\|replay\|proof\|Okafor` in UI strings (Okafor allowed only as the staff persona); deploy Modal (boot snapshot, `ADMIN_TOKEN`, committed cache) and Vercel; restore; rehearse the video twice | 2     | The deployed site passes the video path twice from a restored baseline                                           |

### Cut list, in order, if behind (decide at the end of Day 2)

1. The third fax (Moreau).
2. The agent drawer's model-calls table. Runs and guardrails stay.
3. The "In the building" tab on Today (stations only).
4. The 3 extra live visit-day journeys (Maria alone on the floor).
5. Sparklines on the roster.
6. Hover source highlighting on the Summary pane (show the two columns only).

**Never cut:** sign-in with the live rail; inbox with the 4 gates and Source | Draft; New referral to the live chain; patient record with run view; agent roster; sample buttons; auto-restore.

---

## 10. The 3-minute video (all real screens, recorded on a freshly restored baseline)

| Time      | Screen                                          | What happens                                                                                                                                                                                                                                                                                                                                                              |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:12 | `/`                                             | The hospital rail ticks and the feed shows six different patients and agents. Voiceover: about half of specialty referrals never become a completed visit                                                                                                                                                                                                                 |
| 0:12–0:25 | Sign in as Jordan, then `/inbox`                | 4 items for Jordan, 10 across roles. Getting started is visible                                                                                                                                                                                                                                                                                                           |
| 0:25–1:05 | New referral: fax line, Ndiaye, then the record | Intake shimmer, then the fax next to the fields with "Needs check" on the member ID. The Question lands, **Fill from insurance card**, Send answer. Coverage verifies, Prior auth drafts. Review: Source \| Draft with payer rule and Why list. **Approve and submit**, toast "Submitted to Lonestar Health Plan". The scheduler books about 60 s later (cut in the edit) |
| 1:05–1:40 | Switch to Sam, then `/today`                    | SAM 3.1 counted 14. The proposal written by Muse Spark Open (open-weights chip) has the Rust forecast 42 → 18 min. **Apply change**. Maria's itinerary replans live, and the feed shows Itinerary moving Imaging before Labs                                                                                                                                              |
| 1:40–2:05 | Switch to Renee, then `/inbox`                  | BLOCKING handoff "fever since last night". Why the agent stepped back. **Insert protocol reply**, then Send as nurse                                                                                                                                                                                                                                                      |
| 2:05–2:20 | Switch to Dr. Okafor                            | Summary: verbatim next to plain, **Sign and send**                                                                                                                                                                                                                                                                                                                        |
| 2:20–2:40 | `/agents`                                       | Header sentence, 13 rows, Finished on its own and Staff changed it columns, locks on the four gates. Open the Prior auth drawer: guardrails and runs                                                                                                                                                                                                                      |
| 2:40–2:55 | Maria's record, **Open patient app**            | Phone-width app: Spanish message, step-free directions, next stop                                                                                                                                                                                                                                                                                                         |
| 2:55–3:00 | Close                                           | Wordmark, "Every referral, from fax to follow-up."                                                                                                                                                                                                                                                                                                                        |

---

## 11. Open questions for the owner (only these three)

1. **Recording run on your Meta key.** Approve a single `MODEL_CACHE=record` run of about 32 Muse Spark 1.3 calls:
   - about 12 for the Chen and Ndiaye fax chains (intake vision, auth draft, messages);
   - about 20 for the inbox-visible seeded drafts (2 auth drafts, 2 summaries, the handoff conversation, the ops proposal re-run).

   Add about 6 more calls if you want the Moreau fax. If you say no, those runs show "Used approved template", only Maria's chain shows real model output, and the fax line ships Chen plus Ndiaye on the template path.

2. **The word "sample" on buttons** ("Use a sample code", "Use a sample voice note", "Use a sample photo"). Is it acceptable? The fallback wording is "Example …", plus the fax-line framing, which already avoids the word.
3. **Keeping the Modal container warm during the judging window** (min_containers=1 from Nov 4 through judging). It removes the cold-start risk on the first impression, but it may use Modal compute credits. Is that within the free allowance you are willing to spend?
