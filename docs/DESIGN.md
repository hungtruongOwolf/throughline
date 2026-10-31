# Design

Copy of SPEC.md section 9. This file and `apps/web/app/theme.css` are the only places tokens are defined. Per-surface wireframes (process step 9.9.1) are appended below as surfaces are built.

Read this section with the `frontend-design` skill loaded. The brief below is the design plan that skill asks for (tokens, type, layout, principles), already reviewed against the "generic default" and corrected; `docs/DESIGN.md` in the repo is a copy of it and is the only place tokens are defined. Each surface answers one question. Nothing goes on a screen because it exists in the data model.

## 9.1 Brief

- Subject: hospital wayfinding and logistics. The visual world is painted floor lines ("follow the blue line to Imaging"), color-coded zone signage, departures boards, printed itinerary tickets. Not a SaaS dashboard, not a chat app.
- Audiences: a patient (often older, stressed, on a phone, maybe reading Spanish; Maria is 71); staff reading a board from two meters; an ops manager who needs calm density; judges who have 3 minutes.
- The one memorable element: **the line.** A single continuous route line runs through every surface and changes color as it passes through zones, exactly like a floor line. On the phone it is vertical and the stops hang off it; on the station board it is the arrivals timeline; in the command center it is drawn through the isometric map; on the Journey Control page it is the three-phase thread. Everything else is quiet: paper background, ink text, almost no borders, no shadows.
- Review against the default (what changed and why): the first sketch had a KPI tile row on the patient screen → removed, the patient needs one answer (where next, how long). Messages were chat bubbles → now plain text blocks attached to the line, because this is a route, not a conversation. The station board was a light table → now a dark departures board, which is what staff already read and which gives the product one deliberate dark surface. Cards everywhere → only ops proposals are card-like, and they carry an evidence bar instead of a shadow.

## 9.2 Tokens (`apps/web/app/theme.css`, Tailwind v4 `@theme`)

| Token                                                                            | Value                                                     | Use                                                                                 |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `--paper`                                                                        | `#F6F7F4`                                                 | page background on patient, kiosk, ops, journey control (cool off-white, not cream) |
| `--ink`                                                                          | `#18223A`                                                 | text; station board background                                                      |
| `--ink-soft`                                                                     | `#4B5566`                                                 | secondary text                                                                      |
| `--line`                                                                         | `#0F766E`                                                 | the Throughline when not inside a zone; primary actions; focus ring                 |
| `--wait-low` / `--wait-mid` / `--wait-high`                                      | `#CFE8E3` / `#D97706` / `#C2410C`                         | queue intensity on the map and boards; always paired with the number                |
| `--zone-blue` / `--zone-gold` / `--zone-green` / `--zone-rose` / `--zone-violet` | `#3B6FD6` / `#C9971A` / `#3C8C5A` / `#C2506A` / `#7C5CBF` | zone chips, line segments, sign renderer; the only decorative color                 |
| `--held`                                                                         | `#B45309` on `#FDF1DC`                                    | HELD markers on approvals (the human gate)                                          |
| `--board-text`                                                                   | `#F4F6F2`                                                 | text on the dark station board                                                      |

Type: **Atkinson Hyperlegible** (Google Fonts) for everything read as text, chosen because it was designed for low-vision readers and the first user is 71; **Barlow Condensed** (600/700) for display: station names, floor levels, big numbers, board rows, the sign renderer, because it reads like directional signage. Scale: body 17 on the patient surface (19 for the current stop line), 15 elsewhere, 13 for secondary; display 28 / 40 / 64 / 96 in Barlow Condensed; line length under 70 characters; sentence case everywhere; no letter-spaced capitals.

Spacing: 4-pt grid, generous (24/32/48) on the patient surface; the line is 6 px wide; stops are 16 px dots (done = filled ink, current = 24 px filled line color, future = 16 px outline). Corners: 12 px on buttons, 0 on the line and stops, 6 px on zone chips. Borders only where a boundary carries meaning (the kiosk ticket, device frames).

## 9.3 Surfaces and layouts

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

## 9.4 Components (`apps/web/components/`)

`Throughline` (vertical | horizontal; segments colored by zone; stops with status), `Stop`, `CurrentStop` (the large block), `BigNumber`, `ZoneChip`, `WaitTint` (maps minutes to the three wait tokens and always renders the number next to the color), `IsoMap` (SVG, data from `campus.json`, layers per floor, `selectedJourneyId`, hover sparkline, click details), `QueueSpark`, `Proposal` (title in words, predicted effect as a before/after bar, evidence link to the sim run, Approve/Reject), `HeldMarker`, `EventCascade`, `ProofDrawer`, `SimClock`, `Message` (with disclosure variant), `TeachbackQuestion`, `SignCard` and `Ticket` (from `packages/hospital` renderer), `DeviceFrame`, `LanguageToggle`, `VoiceButton` (AudioWorklet + WebSocket, shows partial transcript inline).

## 9.5 Motion

Motion only answers an action or a real event, and shows what changed: when a stop completes, the line grows and the next stop moves into the large slot (280 ms, ease-out); when a replan arrives, the affected stops swap with a two-second amber wash and a one-line reason; on the map the patient dot travels along the edge when a stop starts; a proposal slides in from the right rail; an approval turns HELD into a check. No page-load fades, no hover lifts, no parallax, no looping ambient animation. `prefers-reduced-motion` switches every transition to an instant state change.

## 9.6 Copy

All strings live in `packages/shared/src/copy/en.ts` and `es.ts`; a test fails if a key is missing in either. Sentence case, plain verbs, numbers as numerals, times as "about 12 minutes". Buttons say what happens: "Show me the way", "I'm here", "Talk to a person", "Approve and open CT 2", "Send to payer". Errors say what happened and what to do next ("We couldn't read the sign. Try the sign with the floor number, or tap 'Talk to a person'."). Empty states invite action ("No one is waiting here right now."). Disclosure line on first patient contact and after 24 h: "You're texting with Throughline, an AI assistant at Halden Medical Center. For medical questions reply NURSE and a person will call you." No exclamation marks on the patient surface. No "please be advised", no "kindly", no "seamless".

## 9.7 Accessibility floor

Contrast AA on every pair (ink on paper 13:1, line on paper 5.5:1, board text on ink 14:1, wait colors never carry meaning alone); patient body text at least 17 px; touch targets at least 48 px; visible focus ring (2 px `--line`, 2 px offset) on every control; the itinerary is a real list for screen readers and the map is `aria-hidden` with the step list as its text alternative; `lang` switches with the language toggle; the board is readable at 2 m (minimum 28 px rows); everything works with keyboard only; reduced motion respected.

## 9.8 Anti-patterns (reject in review)

Cream background with terracotta accent; near-black with acid green; hairline-rule broadsheet grids; identical rounded cards with the same soft shadow; gradient washes; letter-spaced all-caps eyebrows above headings; middle dots between meta items; "→" appended to buttons or links; monospace for data labels; one word of a headline in a different color; numbered markers on content that isn't a sequence; KPI tile rows on any patient or staff surface; chat bubbles and avatar circles; stock illustration; dashboards that show everything at once; any text that explains the system instead of the next step. A screen that fails any of these is redone before it is committed.

## 9.9 Process for every surface

1. Write the one-screen wireframe and the question it answers in `docs/DESIGN.md` (10 lines).
2. Compare with the generic default for that kind of page; change at least the part that reads as default and note why.
3. Build with the tokens only (no ad-hoc hex), with real copy from `copy/*.ts` and real data from the synthetic journey.
4. Screenshot with Playwright at 390×844 (phone), 1280×800 (kiosk and board), 1536×960 (ops and journey control); look at it; remove one element; check the anti-pattern list and the accessibility floor.
5. Commit the screenshot to `docs/screens/` so the video and the README use the same images.

## Surface notes

_Added per surface during the build._
