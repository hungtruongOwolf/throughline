# Demo video script

Read at a natural pace. Each line is one recording, saved as `video/public/audio/vo7/vNN.wav` (the file name is shown before each line). Put the line lengths in `video/narration7.json`, then run `python scripts/build-timeline5.py` and render `Throughline5`; the film re-times itself to the voice.

## The problem (motion graphics)

1. `v01` Every year, millions of people go to a hospital. But hospitals are organized around departments, not patients. Without someone on the inside, the medical terms, or the language, the hardest part is knowing where to go, who to ask, and what comes next.
2. `v03` My family has lived this: a lost referral, weeks waiting on insurance, and results no one called about. Each step sat with a different person in a different system, and the first one arrived by fax.
3. `v05` Administrative costs are an estimated quarter to a third of US health spending. Doctors' offices spend thirteen hours a week getting insurers to approve tests. And in one recent study, only fifty-eight percent of tests and referrals were completed on time.

## What we built (motion graphics)

4. `v08` So we built Throughline: thirteen AI agents, each owning one step of the patient's journey, from referral to follow-up.
5. `v09` They pass the work along on their own, and bring in a person when a human has to decide. Let me show you.

## Before the visit (product)

6. `v11` Jordan coordinates referrals at Halden Medical Center. One just arrived by fax.
7. `v12` The Intake agent reads it, but the insurance ID is smudged, so instead of guessing, it asks Jordan. Jordan answers from the card, and the work carries on.
8. `v14` The Coverage agent finds the CT needs prior authorization, and the Prior auth agent drafts the request beside the original fax, for Jordan to approve. By hand, that takes about twenty-four minutes.

## The visit day (product)

9. `v16` On the day of the visit, Maria, seventy-one and in a wheelchair, has her whole day on her phone: where she is, her wait, what's next, and step-free directions from a photo of any sign.
10. `v18` Meanwhile, one of the hospital's two CT scanners is down, and Maria's line is growing.
11. `v19` A waiting-room agent sees it on the cameras and alerts the Ops planner.
12. `v20` The planner simulates every possible fix and picks the best: an extra slot on the second scanner, cutting the average CT wait from seventeen minutes to five.
13. `v22` The change is small, so the planner applies it within policy. Sam, the operations lead, sees why, and bigger changes still wait for Sam. Maria's scan moves right away.

## After the visit (product)

14. `v24` After the visit, the Discharge agent rewrites Lucille's notes in plain language, and Dr. Okafor signs them before they go to her.
15. `v25` The next day, the Follow-up agent checks in with each patient. If someone is unsure about their care, a nurse, Renee, gets a task to call them.
16. `v26` Results watch tracks every test until a doctor acknowledges it, and the Follow-up agent books the next visit.

## Under the hood (motion graphics)

17. `v28` Under the hood, Muse Spark reads, writes, and sees. Muse Voice Transcribe hears voice notes, Segment Anything counts waiting rooms, and the Ops planner runs on open-weight Muse Spark Open. Scheduling and simulations run on our own Rust engine.

## Any hospital, and the close

18. `v31` And Throughline isn't tied to one hospital: here's Northgate, with five buildings and a fourteen-floor tower.
19. `v32` In the end, families like mine shouldn't need someone on the inside just to find their way.
20. `v33` When AI agents carry the routine work and the steps connect, care gets easier for patients, lighter for staff, and reaches more people.

515 words, about 3.1 minutes of speech; the film runs about 3.6 minutes.
