# Demo video script (4:00)

Read it out loud once before you record. It is written to be spoken: short sentences, the odd "uh" or self-correction so it sounds like a person. Do not smooth those out.

Pace: about 140 words a minute. The talking parts are about 560 words; the rest of the four minutes is the screen working while you say nothing. Leave the pauses in. If a take goes wrong halfway, keep going and say the line again.

Record at 1080p on https://throughline-zeta-ten.vercel.app. Browser zoom 110%. Close other tabs. Open the front page first.

The thing this video must land: **the agents hand work to each other with nobody pressing a button, and a person only steps in where a person should.** Every demo beat below shows one handoff.

## Numbers you may say, and where they come from

Say "about" where marked. Say "one study" or "older patients" where the study was narrow.

| What you say                                                                                        | Source                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| About 155 million emergency visits a year in the US                                                 | CDC NHAMCS, 2022                                |
| Hospital outpatient visits are in the hundreds of millions a year                                   | CDC Health, United States (832 million in 2015) |
| A typical Medicare patient sees about 2 primary care doctors and 5 specialists, in 4 practices      | Pham et al., NEJM, 2007                         |
| A visit takes about 2 hours of the patient's time; about 20 minutes is with the doctor              | Ray et al., JAMA Intern Med, 2015               |
| Doctors and staff spend about 13 hours a week on prior authorization                                | AMA survey, 2024                                |
| A manual prior authorization takes about 24 minutes                                                 | CAQH Index, 2024                                |
| 1 in 14 abnormal outpatient test results is never communicated to the patient                       | Casalino et al., Arch Intern Med, 2009          |
| 79% of older patients with a medication change at discharge did not understand a change             | J Gen Intern Med, 2012                          |
| About 1 in 5 Medicare patients is back in hospital within 30 days; half had no office visit between | Jencks et al., NEJM, 2009                       |
| Failure of care coordination wastes an estimated $27 to $78 billion a year                          | Shrank et al., JAMA, 2019                       |

Our own numbers, checkable in the repo: 13 agents, 30 referrals in the book, 3 hospitals, intake read 10 of 10 faxes, the classifier handled 60 of 60 messages with no false alarms.

Do not say: a percentage of referrals sent by fax, a national no-show cost, a wayfinding dollar cost. No source we trust.

## The script

**0:00 to 0:55. The problem, wide. Screen: the 3D hospital turning slowly on the front page. Nothing else.**

> Okay. Think about how many people walk into a hospital in a year.
>
> In the US, about a hundred and fifty-five million emergency visits, and hospital outpatient visits in the hundreds of millions on top of that.
>
> And a visit isn't one thing. It's a chain. Before: a referral, often still a fax, then the insurance, then permission from the insurer, then finding a time. Doctors and their staff spend about thirteen hours a week on prior authorization alone.
>
> During: you find the building, the room, you wait. About two hours of your day, about twenty minutes with the doctor.
>
> After: you go home with instructions. Most older patients with a medication change don't understand at least one of the changes. One in fourteen abnormal results never reaches the patient.
>
> And a typical Medicare patient has about two primary doctors and five specialists, in four practices. Nobody runs the whole line. Estimated cost of that, tens of billions a year.

**0:55 to 1:20. The idea. Screen: front page, staff list and the patient door.**

> So, Throughline. One thread per patient, from the referral to the follow-up. And thirteen agents that pick up the thread, one after another, on their own. A person only steps in at the moments that need a person.
>
> Let me show you one patient, start to finish.

**1:20 to 2:15. Before. Screen: sign in as Jordan, Inbox, then the patient record timeline filling in. Let the timeline scroll; don't talk over every line.**

> A fax arrives. Nobody clicks anything.
>
> Intake reads it. Patient, doctor, diagnosis, copied exactly as written. The member ID is smudged, so it doesn't guess, it asks Jordan, the coordinator. Jordan answers from the insurance card.
>
> _(pause, let the timeline move)_
>
> The moment that's answered, Coverage wakes up. Checks the plan, the copay, which services need the insurer's approval. That finds a CT scan needs one. So Prior auth drafts the request, from the payer's rules, with the source of every line beside it.
>
> _(open the draft, click Approve)_
>
> This is one of the places a person signs. A manual one is about twenty-four minutes. Here Jordan checks it and approves it, and it goes. The insurer says yes.
>
> And Scheduling picks it up. Every service the doctor ordered, in the right order, in as few trips as possible, around when the patient can come. That's a Rust engine, not a language model, because a schedule should be exact.
>
> Then Visit prep sends her plan. And when Maria answers by voice note, "I need a wheelchair", Patient messaging understands it, remembers it, and the Itinerary agent redraws her route to use only elevators. Nobody typed that in.

**2:15 to 3:05. During. Screen: Today, then the patient app on a phone-sized window.**

> Now the visit day. This is the hospital, right now.
>
> Waiting-room sensing counts the people in each waiting room from camera frames. It sees the CT line growing, and CT one is down. Sensing tells Ops.
>
> Ops runs the rest of the day with each possible fix, and proposes the best one. Move three patients to the other scanner. It tested that first, in a simulation, before it bothered anybody.
>
> _(click Approve)_
>
> A person signs. And right away, Itinerary re-plans every affected patient, and Visit companion tells Maria, on her phone, with the reason. She never asked.
>
> _(on the phone view)_ If she gets lost, she sends a photo of a sign, and the companion works out where she is and gives her step-free directions.

**3:05 to 3:30. After. Screen: patient record, the after-visit part of the timeline.**

> After. Discharge restates the doctor's notes in plain words, right next to the original, and the doctor approves it. A day later it checks, with a couple of questions, that she understood. If an answer is wrong it doesn't explain, it hands it to a nurse.
>
> Results watch keeps track of the test until the doctor has acknowledged it. And Follow-up books the next labs and visit, checks in on day three, and sends the closing report back to the referring doctor.

**3:30 to 3:50. The models, and more than one hospital. Screen: Agents page, then the hospital picker, Northgate in 3D.**

> It runs on Meta's models. Muse Spark reads and drafts. The Ops planner runs on Spark Open, the open-weights one, on Baseten, because a hospital might want a model it can run itself. Muse Voice Transcribe for voice notes, SAM for counting people. Every run is logged: which agent, which model, what it saw, what it did.
>
> And it isn't one hospital. _(pick Northgate)_ Five buildings, a fourteen-floor tower. A new hospital can add itself, and patients can ask for a visit there too.

**3:50 to 4:00. Close. Screen: Today, Northgate, 3D.**

> Thirty referrals a week, ten minutes saved on each, that's five hours a week back, for one clinic. But the real point is the thread. Nobody has to hold it anymore.
>
> That's Throughline. Thanks for watching.

## Before you record

- Reload the site so the hospital is at its starting state (it restores itself after 10 idle minutes).
- To show the chain from the start, use **New referral** in Referrals: it receives a fax and the agents begin in front of you. Then open that patient's record so the timeline fills in as you talk. Maria's record is already past that point.
- Sign in as Jordan. Make sure the prior-auth item is in the Inbox before the take.
- Use Halden until the models part, then switch to Northgate.
- Before you say which model reads the fax, open the Agents page and check which model the intake agent lists. Say that name.
- Upload to YouTube, put the link in `docs/DEVPOST.md` (the Video line). Check the contest rules for the video length limit. If it is three minutes, cut the "After" section and the "During" patient-phone lines.
