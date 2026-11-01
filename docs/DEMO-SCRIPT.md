# Demo video script

Read at a natural pace. Each numbered line is one recording: save it as `video/public/audio/vo3/vNN.wav` (NN = the line number) and the film re-times itself to your voice (`python scripts/build-timeline3.py`, then render `Throughline3`).

## 1. The problem (motion graphics)

1. Every year, Americans make about a hundred and fifty-five million emergency visits, and hundreds of millions more to clinics.
2. Behind each visit is a chain of work. Someone reads the referral, someone checks the insurance, and the insurer often has to approve the tests in advance. That's called prior authorization.
3. Then someone books the visit, and afterwards someone explains the results and books the follow-up.
4. Each step belongs to a different person in a different system, and the first step often still arrives by fax.
5. So things slip through the gaps. About a quarter of US health spending is estimated to be waste, and doctors and their staff spend around thirteen hours a week on prior authorization alone.
6. Worst of all, one abnormal test result in fourteen never reaches the patient.

## 2. What we built (motion graphics)

7. We built Throughline to be the thread that holds this whole chain together.
8. It's thirteen AI agents, each owning one job in the patient's journey, from the faxed referral to the follow-up.
9. The agents pass the work to each other on their own. A person steps in when an agent isn't sure, or when a decision needs a human, like approving an insurance request or a schedule change.
10. Let me show you how it works, before, during, and after a visit.

## 3. Demo: before the visit (real product footage)

11. This is Jordan's screen. Jordan is the referral coordinator at Halden Medical Center, and a referral from another clinic is waiting on the fax line.
12. The Intake agent reads it right away, but the end of the patient's insurance ID is smudged, so instead of guessing, it asks Jordan.
13. Jordan answers from the insurance card, and the work carries on.
14. With the ID confirmed, the Coverage agent finds that the CT scan needs prior authorization, so the Prior auth agent drafts the request.
15. The draft waits for Jordan's approval, right beside the original fax, so every line can be checked. By hand, a request like this takes about twenty-four minutes.

## 4. Demo: the visit day (real product footage)

16. Now, the day of a visit, with a different patient. Maria is seventy-one, uses a wheelchair, and Throughline puts her whole day on her phone.
17. She sees where she is, how long her wait is, and what's next. If she gets lost, she can send a photo of the nearest sign and get step-free directions.
18. Meanwhile, here's the operations view of the same hospital. One of its two CT scanners went down this morning, and the line Maria is waiting in is growing.
19. A waiting-room agent counts people on the cameras and alerts the Ops planner, the agent that watches the day's schedule.
20. The planner simulates the next ninety minutes with each possible fix and recommends one: an extra slot on the second scanner.
21. In the simulation, the average CT wait drops from about seventeen minutes to five.
22. Sam, the operations lead, approves it, and Maria's plan updates right away: her scan moves to the second scanner.

## 5. Demo: after the visit (real product footage)

23. The work doesn't stop when the visit ends. This is Dr. Okafor's inbox, and Lucille Barros was seen a few days ago.
24. The Discharge agent rewrites the visit notes in plain language next to the original, and Dr. Okafor signs the summary before it goes to the patient.
25. If a patient's answers at the next-day check-in show they're unsure, a nurse, Renee, gets a task to call them.
26. Across all patients, the Results watch agent tracks every test until a doctor acknowledges it. And the Follow-up agent books the next visit and reports back to the referring doctor.
27. The Agents page shows what each of the thirteen has done, and what it runs on.

## 6. Under the hood (motion graphics)

28. Under the hood, the agents that read, write, and listen run on Meta's Muse Spark and Muse Voice Transcribe, and Meta's Segment Anything Model counts people in the waiting rooms.
29. The Ops planner runs on Muse Spark Open, hosted on Baseten. Its weights are open, so a hospital could also run it on its own hardware.
30. Scheduling, routing, and the planner's simulations run on our own Rust engine, because those need exact answers.
31. And Throughline isn't tied to one hospital. Here's Northgate University Hospital, with five buildings and a fourteen-floor tower, and you can add your own.

## 7. Close (motion graphics)

32. So the fax gets read, the prior authorization gets drafted, and no test result goes untracked, with a person at every decision that matters.
33. Thirteen agents, one thread, and nobody holding it together by hand. That's Throughline.

727 words, about 4.7 minutes of speech at a natural pace.
