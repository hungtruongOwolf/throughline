# Demo video script

Read at a natural pace. Each line is one recording, saved as `video/public/audio/vo5/vNN.wav` (the file name is shown before each line). Put the line lengths in `video/narration5.json`, then run `python scripts/build-timeline4.py` and render `Throughline4`; the film re-times itself to the voice.

## The problem (motion graphics)

1. `v01` Every year, millions of people go to a hospital, for a checkup, a scan, or an emergency.
2. `v02` If you've gone with someone you love, you know the hardest part often isn't the medicine. It's not knowing where to go, who to ask, or what comes next.
3. `v03` My family has lived this. With no one on the inside, we lost track of a referral, waited weeks for an insurance approval, and never knew if anyone would call with the results.
4. `v04` Each of those steps sits with a different person in a different system, and the first one often still arrives by fax.
5. `v05` The cost is real. About a quarter of US health spending is estimated to be waste, and doctors' offices spend around thirteen hours a week getting insurers to approve tests.
6. `v06` Worst of all, one abnormal test result in fourteen never reaches the patient.

## What we built (motion graphics)

7. `v08` So we built Throughline: thirteen AI agents that connect those steps, each owning one part of the patient's journey, from referral to follow-up.
8. `v09` They hand the work to each other on their own, and bring in a person only when they're unsure, or when a human has to decide.
9. `v10` Let me show you, before, during, and after a visit.

## Before the visit (product)

10. `v11` This is Jordan's screen. Jordan is the referral coordinator at Halden Medical Center, and a referral from another clinic is waiting on the fax line.
11. `v12` The Intake agent reads it right away with Muse Spark, but the end of the patient's insurance ID is smudged, so instead of guessing, it asks Jordan.
12. `v13` Jordan answers from the insurance card, and the work carries on.
13. `v14` With the ID confirmed, the Coverage agent finds that the CT scan needs prior authorization, so the Prior auth agent drafts the request.
14. `v15` The draft waits for Jordan's approval, right beside the original fax, so every line can be checked. By hand, a request like this takes about twenty-four minutes.

## The visit day (product)

15. `v16` Now, the day of a visit, with a different patient. Maria is seventy-one, uses a wheelchair, and Throughline puts her whole day on her phone.
16. `v17` She sees where she is, how long her wait is, and what's next. If she gets lost, she can send a photo of the nearest sign and get step-free directions.
17. `v18` Meanwhile, here's the operations view of the same hospital. One of its two CT scanners went down this morning, and the line Maria is waiting in is growing.
18. `v19` A waiting-room agent counts people on the cameras with Meta's Segment Anything Model, and alerts the Ops planner.
19. `v20` The planner runs on Muse Spark Open. It tests each possible fix on our own Rust engine, simulating the next ninety minutes, and picks the best: an extra slot on the second scanner.
20. `v21` In the simulation, the average CT wait drops from about seventeen minutes to five.
21. `v22` The change is small and clearly helps, so the planner applies it on its own, within policy. Sam, the operations lead, sees what changed and why, and bigger changes still wait for Sam. Maria's scan moves to the second scanner right away.

## After the visit (product)

22. `v23` The work doesn't stop when the visit ends. This is Dr. Okafor's inbox, and Lucille Barros was seen a few days ago.
23. `v24` The Discharge agent rewrites the visit notes in plain language next to the original, and Dr. Okafor signs the summary before it goes to the patient.
24. `v25` If a patient's answers at the next-day check-in show they're unsure, a nurse, Renee, gets a task to call them.
25. `v26` Across all patients, the Results watch agent tracks every test until a doctor acknowledges it. And the Follow-up agent books the next visit and reports back to the referring doctor.
26. `v27` The Agents page shows what each agent has done and what it runs on, including Muse Voice Transcribe for patients' voice notes. And because the planner's weights are open, a hospital can run it on its own hardware.

## Any hospital, and the close

27. `v31` And Throughline isn't tied to one hospital. Here's Northgate University Hospital, with five buildings and a fourteen-floor tower, and you can add your own.
28. `v32` In the end, families like mine shouldn't need someone on the inside just to find their way.
29. `v33` When AI agents carry the routine work and the steps connect, care gets easier for patients, lighter for staff, and reaches more people.

706 words, about 4.0 minutes of speech; the film runs about 4.5 minutes.
