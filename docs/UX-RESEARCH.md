# Throughline UX Research

What hospital wayfinding, patient portals, consumer trackers and command centers do, and what that means for Throughline. The goal is to stop the UI reading like a debug view and make it read like a product people use. Sources are numbered in brackets and listed at the end.

## 1. Roles and jobs-to-be-done

| Role                                           | Device                | Job-to-be-done                                                                           | Shown first                                        |
| ---------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Patient (older, may use a wheelchair, anxious) | Phone                 | "Tell me what's next, where it is, and how long it takes. Tell me if something changes." | The next stop card                                 |
| Intake coordinator                             | Desktop               | "Clear the referrals that need a human. Approve or fix the prior auth."                  | A queue of cases waiting on them                   |
| Station staff (lab or CT desk)                 | Desk screen or tablet | "Who's arriving, who's waiting, who's late?"                                             | An arrivals and queue board                        |
| Operations manager                             | Large desktop         | "Where are we over capacity, and should I approve this fix?"                             | KPI tiles, alerts, and pending approvals           |
| Judge                                          | Laptop, 2–3 minutes   | "What is this, who is it for, and does it work end to end?"                              | A homepage with a one-line pitch and a guided tour |

## 2. Patterns per surface

### Homepage (missing today)

- **Above the fold:** a one-sentence value line, e.g. "Throughline guides a cancer patient from referral fax to follow-up, and helps the hospital keep the day on track." Under it, a 5-step journey strip (Referral → Insurance → Scheduled → Visit day → After visit) that shows the whole story at a glance.
- **Primary CTA:** "Follow Maria's journey" (guided tour). Under it, four role cards: "For patients", "For intake coordinators", "For station staff", "For operations". GOV.UK found plain audience labels confusing, and adding "for"/"Information for" makes them work better. Role entry also works best when each audience gets different content, which is true here [12][13].
- Put a short "Synthetic data, fictional hospital" note in the footer.

### Patient phone, pre-visit

- Use **checklist cards** in the MyChart eCheck-In style: insurance verified ✓, authorization "being reviewed by your care team", appointment confirmed, prep instructions. MyChart sends an eCheck-In reminder the day before, and "On My Way" warns staff the patient is coming but does not hold a place in line. Copy both behaviors and say plainly what each action does [4][5].
- Keep the tone warm and second person ("You're all set for Tuesday"). Don't show internal states such as `PA_HELD`. Say "Your care team is checking with your insurer. You don't need to do anything."
- Show SMS messages as real text-message bubbles. The patient confirms with one tap or by replying "YES".

### Patient phone, visit day (itinerary and wayfinding)

- **Above the fold:** borrow Delta's Today Mode: one "Now / Next" card with the QR or check-in code, place, time and countdown at the top, and shortcuts below [9]. Example: "Next: Blood draw · Lab, Level 1, Building B · ~8 min wait · 6 min walk".
- Under it, a **vertical stop timeline** (Lab → CT → Vitals → Oncology → Infusion) with done, current and upcoming states. NN/g says to pair a tracker (pull) with proactive updates (push), because a tracker alone makes people keep re-checking [10].
- **Replanning:** use a banner in airline gate-change style: "Change: CT moved to Scanner 2 (Building A). Your new order is: CT → Lab. Nothing else changes." Notifications and gate changes get their own log in Fly Delta [9].
- **Directions:** a "Get directions" button opens the wayfinding view (section 4). It defaults to the accessible route, as St. Joseph's/Mappedin does [3].
- Use large type and high contrast, with one primary action per screen.

### Journey tracker (end-to-end view, judge-facing)

- Use a Domino's-style stage bar with a few stages. Domino's reduced its tracker to 4 stages, and the original was built to ease the "anxiety in between" [11]. Throughline's stages: **Referral received → Cleared to schedule → Confirmed → Visit day → Follow-up**.
- Under the bar, show a **chronological event feed, newest first** (NN/g [10]). Each event names who acted (system, coordinator, patient) in plain words. Each event can expand to show the Rust engine or agent detail. Debug data stays one click deep and is never the default view.
- Add a role switcher at the top ("See this as: Patient | Coordinator | Station | Ops") so judges can see one patient through every lens.

### Coordinator intake and review

- Make it an **inbox**: cases sorted by "needs you" first, each with a reason chip ("Prior auth held: missing pathology report"). A detail pane shows the faxed referral next to the extracted fields, with low-confidence fields highlighted. Actions are Approve, Edit, or Request info.
- Command-center practice puts KPI transparency and continuous metrics ahead of end-of-day reports [8][14]. Show a small header count: "4 need review · 12 auto-cleared today".

### Station board (lab or CT front desk)

- Show **three columns: Arriving soon / Waiting / In progress**. Each patient card has first name and initial, appointment time, and minutes waiting, plus a mobility icon (wheelchair) so staff can prepare. Capacity tools show each status as a color plus a count [15]. Never rely on color alone: always add text.
- When a scanner is down, the board shows a red status strip ("Scanner 1 offline since 10:42 · 3 patients rerouted").

### Ops command center

- Johns Hopkins' center (built with GE) uses a wall of tiles. Hopkins says the information is kept under 3 minutes old, and GE says most tiles update every 30 seconds. Predictive tiles raise alerts before problems happen [6][7].
- **Above the fold:** a row of 4–6 KPI tiles (patients on campus, average wait by station, stations at risk, rerouted today). Next to them, an **"Needs your decision" panel**. Each card states the problem, the simulated effect of the fix, and Approve or Dismiss: "Open CT Scanner 3 for 2 h → predicted max wait 48 → 19 min. Approve / Dismiss". Put the campus heat map below the tiles. It is context, not the hero.

## 3. Information architecture and judge flow

```
/                      Home: pitch, journey strip, "Follow Maria's journey", role cards
/journey/:patientId    End-to-end tracker (stage bar + event feed + role switcher)
/patient               Phone frame: Pre-visit | Today | After visit tabs
/patient/directions    Wayfinding (floor map + step list)
/coordinator           Intake inbox + case detail
/station/:id           Station board (Lab, CT)
/ops                   Command center (KPIs, approvals, campus map)
/about                 How it works (architecture, synthetic-data disclosure)
```

**2–3 minute judge flow** (guided tour with a "Next" button that persists across pages):

1. Home (15 s): read the pitch, click "Follow Maria's journey".
2. Coordinator (30 s): the fax arrives, fields are extracted, prior auth is held, the coordinator approves.
3. Patient phone, pre-visit (20 s): a confirmation text arrives and the patient replies YES.
4. Patient phone, Today (40 s): the Now/Next card and directions to the Lab. The CT scanner goes down and the gate-change banner shows the new order.
5. Station board, CT (15 s): the rerouted patients appear.
6. Ops (30 s): the approval card. Approve it and watch the predicted wait drop.
7. Journey tracker (15 s): the whole story appears as one timeline, ending at the after-visit summary.

## 4. Wayfinding map recommendation

**What credible hospital wayfinding apps have:**

- **Blue dot plus turn-by-turn text and voice.** Gozio offers parking-to-door guidance and saves where you parked [1]. Pointr reports ~1 m accuracy at UCHealth and in a Cisco case study, and is now integrated with MyChart [2].
- **Accessibility routing** that prefers elevators and ramps over stairs. St. Joseph's turns it on by default [3].
- **Multi-floor handling.** At a floor change, the map switches to the destination floor or stacks the floors to show where to exit one level and enter the next [3].
- **Photo and landmark steps.** Cambridge's CUH Directions uses step-by-step photos, enlargeable text, screen-reader support, and offline use [16]. Other apps add visual landmarks to routes [17]. Older adults rely mostly on landmarks, and landmark instructions are cited as lowering cognitive load [18].
- **Visible small destinations.** Small but important departments get distinct colour and larger labels [3].

**Use 2D per level, not 3D isometric.** The current 3D campus view gives an overview, but a patient can't act on it. Real deployments lead with a flat floor plan of the current level plus a step list. 3D or stacked views appear only at floor transitions. Keep the isometric view as the Ops overview.

**Minimal ~1-day SVG build from the 37-node graph:**

1. **Layout data:** give each node `x, y, level, kind` (entrance, elevator, station, corridor, landmark) plus a `label` and an optional `photo` (a stock or generated corridor image, or a colored placeholder card with an icon). Draw building outlines as a few `<rect>`/`<path>` shapes per level. Grey corridors are the graph edges drawn as thick (12–16 px) rounded strokes, so the map looks like hallways and not a network diagram.
2. **Floor switcher:** vertical segmented control (L3 / L2 / L1) on the right edge. Highlight the levels the route uses, and auto-switch when the user taps a step on another level.
3. **Route:** run Dijkstra with `accessible=true` by default. This excludes stair edges, and the toggle reads "Step-free route ✓". Draw the active level's segment as a bold blue line with direction chevrons. Other-level segments become a "Continue on Level 2 →" pill at the elevator node.
4. **"You are here":** a pulsing blue dot at the current step's node with a soft accuracy halo. Show a red destination pin with its label.
5. **Step list (the primary UI on phone)** as a bottom sheet. Each step is a large card: icon, an instruction that leads with a landmark ("Pass the gift shop, then take Elevator B to Level 2"), distance/time, and a thumbnail photo. The "Next step" button advances the dot. Generate landmark phrases from the nearest `landmark` node to each turn.
6. **Header:** "To CT Imaging · 6 min · step-free" with a "Need help? Call the desk" link, because anxious older patients ask people first [19].
7. **Legend and labels:** restrooms, elevators, entrances, info desk icons. Text ≥16 px, contrast ≥4.5:1, never color-only.

## Sources

1. Gozio Health, Healthcare Wayfinding: https://goziohealth.com/platform/healthcare-wayfinding ; TMH Go: https://www.wtxl.com/news/local-news/tmh-launches-new-app-to-improve-wayfinding-for-patients-visitors
2. Pointr, Cisco DNA Spaces hospital case study: https://www.pointr.tech/blog/smart-hospital-wayfinding-cisco-dna-spaces ; UCHealth: https://www.pointr.tech/blog/pointr-expands-uchealth-deployment ; Epic partnership: https://iotm2mcouncil.org/iot-library/news/connected-health-news/pointr-in-epic-partnership-to-find-way-round-hospital/
3. Mappedin, St. Joseph's Health Centre case study: https://www.mappedin.com/resources/case-study/st-josephs-health-centre-designing-a-product-to-fit-patient-needs/ ; Wayfinding SDK guide: https://developer.mappedin.com/web/v6/guides/wayfinding/
4. MyChart scheduling features: https://www.mychart.org/features/schedule/
5. M Health Fairview, MyChart eCheck-In: https://www.mhealthfairview.org/sites/default/files/2026-06/MyChart-eCheck-In.pdf ; Emory self-arrival: https://www.emoryhealthcare.org/lp/self-arrival
6. Johns Hopkins, Judy Reitz Capacity Command Center: https://www.hopkinsmedicine.org/emergency-medicine/c3
7. GE HealthCare Command Center executive brief: https://www.gehealthcare.com.au/-/jssmedia/gehc/us/files/command-center/why-gehc-command-center-executive-brief_rgb-jb29667xx.pdf ; Hospital Pulse tile: https://www.businesswire.com/news/home/20241017581550/en/
8. Becker's, Command centers explained: https://www.beckershospitalreview.com/care-coordination/command-centers-explained-key-challenges-lessons-and-wins-from-5-systems/
9. Fly Delta Today Mode: https://www.frequentbusinesstraveler.com/?p=66855
10. NN/g, Status trackers and progress updates: https://www.nngroup.com/articles/status-tracker-progress-update/
11. Domino's tracker update: https://dominos.gcs-web.com/node/24451 ; The Hustle: https://thehustle.co/originals/how-the-dominos-pizza-tracker-conquered-the-business-world
12. GOV.UK, The trouble with audience-based navigation: https://insidegovuk.blog.gov.uk/2014/07/18/hey-you-there-the-trouble-with-audience-based-navigation/
13. NN/g, Audience-based navigation: https://www.nngroup.com/videos/audience-based-website-navigation/
14. Epic Patient Flow: https://www.epic.com/software/patient-flow/
15. Capacity Management bed status filters (Northern Light): https://hi.northernlighthealth.org/2018Upgrade/CapMgmtPrefs-1.aspx
16. CUH Directions app: https://www.cuh.nhs.uk/visiting-our-hospitals/cuh-directions-mobile-app/
17. RWJ Find Your Way: https://njbiz.com/robert-wood-johnson-university-hospital-launches-rwj-find-way-navigation-app-visitors/ ; VUMC WalkWays: https://news.vumc.org/?p=251742
18. Landmark-based navigation across the lifespan (eLife): https://elifesciences.org/articles/81318
19. Elderly hospital wayfinding (Heliyon 2024): https://doaj.org/article/0dd2d8101c604c85bbdaee62a4ec885e ; NIHR older-people hospital design recommendations: https://www.e-repository.clahrc-yh.nihr.ac.uk/wp-content/uploads/2015/03/Key_Recommendations_final-version.pdf
