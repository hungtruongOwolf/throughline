# Patient portal: design plan

Written with the `frontend-design` skill (`.claude/skills/frontend-design`) before building, then reviewed against the brief.

## Brief

- **Subject:** a cancer patient's referral, from the fax to the follow-up, at a large hospital (fictional Halden Medical Center).
- **Audience:** Maria Diaz, 71, new to cancer care. She's anxious, uses a wheelchair for this visit, and is reading on a desktop browser at home (a daughter may read along). Judges see the same page.
- **Primary job:** answer _"what happens to me, when, why, and what do I need to do?"_ at every point, before, on, and after the visit days.

## What was wrong (owner feedback, 2026-10-31)

The first redesign listed what the system knows (statuses, checkmarks, stations) instead of telling Maria what will happen to her:

- She couldn't tell what each appointment is.
- She couldn't tell why the CT scan comes before the doctor.
- She couldn't tell what to do the night before.
- The "Before" and "After" tabs were thin.

The layout also used the generic SaaS-card kit: identical rounded white cards for everything, meta strings joined with "·", and a "←" on a link.

## Plan

**Color** (unchanged tokens, grounded in hospital floor lines):

- paper `#F6F7F4`
- ink `#18223A`
- ink-soft `#4B5566`
- line teal `#0F766E`
- held amber `#9A4507`
- zone colors only where a place is named

**Type:**

- Atkinson Hyperlegible for everything read as text (it was designed for low-vision readers).
- Barlow Condensed for the few things that act like signage: the "next for you" sentence, dates on the line, place names.

**Layout:** desktop first, single page with three phases. Left-aligned.

```
Halden Medical Center                         Maria Diaz    Talk to a person
──────────────────────────────────────────────────────────────────────────────
Your care plan
 Before your visits ━━━━━━━━ Visit days ──────── After ────────   (the line is the phase switch)

 Next for you                                         │ Your to-do
 Saturday, November 14, 7:00 am                        │ [ ] Confirm your visits
 Blood tests at the Outpatient Lab, Level 1.          │ [ ] Nothing to eat after 11 pm, Nov 13
 Nothing to eat or drink except water after 11 pm.    │ [ ] Ask for a wheelchair
                                                      │
 How your care is being set up                         │ Questions?
 ┃ Nov 10  We received your referral ...               │ Call 555-0100 or "Talk to a person".
 ┃ Nov 10  We checked your insurance ...               │ Medical questions go to a nurse.
 ┃ Nov 12  Your insurer approved the CT scan ...       │
 ┃ Nov 14  Trip 1: blood tests                         │
 ┃ Nov 17  Trip 2: scan, vitals, doctor, infusion      │
 ┃          each appointment opens to:                 │
 ┃          what it is / why / how long / what to do   │
```

**Visit day:**

- One sentence for today ("4 appointments, about 4½ hours, in two buildings").
- The current stop gets the wait and the directions, with the 2D floor map beside the steps on desktop.
- The rest of the day is the same line, and each stop opens to its explanation.

**After:** a sequence of what happens next, in time order:

1. The visit summary.
2. The check that it made sense (teach-back).
3. The results.
4. The next appointment.
5. Who will call.

**Principles:**

1. **Tell, don't list.** Every item says what happens to Maria, in a sentence, from her side.
2. **One answer at the top.** The "Next for you" sentence is the memorable element. Everything else is quiet.
3. **The line is the only decoration.** It's a dated vertical line, like the floor line she follows in the hospital. No card grid. Boxes only where something is a separate thing she acts on (the to-do list).
4. **Explain the order.** Why the blood test is 3 days early. Why the scan is before the doctor.
5. **Administrative, never clinical.** We describe what a test _is_ and how it goes, never what results mean.

## Review against the default

- Identical cards for each checklist item were the generic kit. They became one dated line with sentences.
- "·" meta strings and the "←" link were generic tells. They became plain sentences and words.
- A KPI-style "2 ahead / 28 min" block was the generic big-number treatment. On the visit day it stays, because it is the one number she needs. It's gone from every other phase.
- A phone frame on desktop had no reason to be there. The page is now a desktop portal that still works at phone width.
