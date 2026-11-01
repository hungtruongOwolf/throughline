# Demo video script (4:00)

Read it out loud once before you record. It is written to be spoken: short sentences, a few places where you correct yourself, one place where you admit something is not finished. Keep those. A flawless read sounds like an ad.

Pace: about 140 words a minute. The talking parts below are about 520 words; the rest of the four minutes is the screen doing things while you say nothing. Leave the pauses in. If a take goes wrong halfway, keep going and say the line again.

Record at 1080p on https://throughline-zeta-ten.vercel.app. Browser zoom 110%. Close other tabs. Open the front page first.

## Numbers you may say, and where they come from

Say "about" and "reported" where marked. Say "older adults" or "one study" where the study was narrow. Do not round up.

| What you say                                                                                               | Source                                                                              |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| About 155 million emergency visits a year in the US                                                        | CDC NHAMCS, 2022                                                                    |
| Hospital outpatient visits are in the hundreds of millions a year                                          | CDC Health, United States (832 million in 2015). Old, so say "hundreds of millions" |
| A typical Medicare patient sees about 2 primary care doctors and 5 specialists, in 4 practices             | Pham et al., NEJM, 2007. Old data, say "a typical Medicare patient"                 |
| A visit takes about 2 hours of the patient's time; about 20 minutes is with the doctor                     | Ray et al., JAMA Intern Med, 2015                                                   |
| Doctors and staff spend about 13 hours a week on prior authorization                                       | AMA survey, 2024                                                                    |
| A manual prior authorization takes about 24 minutes                                                        | CAQH Index, 2024                                                                    |
| About half of specialty referrals were not completed                                                       | Weiner et al., 2010. Adults 65+, one setting. Say "one study"                       |
| 1 in 14 abnormal outpatient test results is never communicated to the patient                              | Casalino et al., Arch Intern Med, 2009                                              |
| 78% of emergency patients misunderstood part of their discharge instructions                               | Engel et al., Ann Emerg Med, 2009                                                   |
| 79% of older patients with a medication change at discharge did not understand a change                    | J Gen Intern Med, 2012. Say "older patients"                                        |
| About 1 in 5 Medicare patients is back in hospital within 30 days, and half had no office visit in between | Jencks et al., NEJM, 2009 (2003-04 data). Say "one big Medicare study"              |
| Failure of care coordination wastes an estimated $27 to $78 billion a year                                 | Shrank et al., JAMA, 2019. Say "estimated"                                          |

Do not say: a percentage of referrals sent by fax, a national no-show cost, a wayfinding dollar cost. No source we trust. Mayo and Montage figures are vendor or news reports; leave them out of the voice-over.

Our own numbers, checkable in the repo: 13 agents, 30 referrals in the book, 3 hospitals, 215 runtime tests, intake read 10 of 10 faxes, the classifier handled 60 of 60 messages with no false alarms, 156 live model calls recorded.

## The script

**0:00 to 1:10. The problem, wide. Screen: the 3D hospital turning slowly on the front page. Nothing else.**

> Okay. Think about how many people walk into a hospital in a year.
>
> In the US it's about a hundred and fifty-five million emergency visits. And hospital outpatient visits are in the hundreds of millions on top of that.
>
> Now think about what one of those visits actually is. It's not one thing. It's a chain. Before, a doctor sends a referral, often still by fax. Someone checks the insurance, someone asks the insurer for permission, someone finds a time. The AMA says doctors and their staff spend around thirteen hours a week on prior authorization alone.
>
> Then, during, you show up. You find the building, you find the room, you wait. One study put the whole visit at about two hours of your time, and about twenty minutes of it with the doctor.
>
> And after. You go home with instructions. One study found most older patients with a medication change at discharge didn't understand at least one of the changes. One in fourteen abnormal test results never gets back to the patient. And about one in five Medicare patients is back in hospital within a month. In that same study, half of them hadn't seen an outpatient doctor in between.
>
> A typical Medicare patient has about two primary doctors and five specialists, in four different practices. Nobody is in charge of the whole line. People are, uh, improvising. And the cost of that, one estimate, is tens of billions a year.

**1:10 to 1:40. The idea. Screen: front page, staff list and patient door.**

> So this is Throughline. The idea is simple. Give each patient one thread, from the referral to the follow-up, and put agents on the routine work along that thread. A person signs off on the steps that matter.
>
> Let me show you the three parts.

**1:40 to 2:15. Before. Screen: sign in as Jordan, Inbox, open the prior-auth item.**

> Before. I'm Jordan, the referral coordinator. A fax came in, and the intake agent read it. Patient, doctor, reason. And here, it couldn't read the member ID, so it didn't guess, it asked Jordan.
>
> _(open the prior-auth draft, approve it)_
>
> The packet for the insurer is already built, with the sources beside it. A manual one is about twenty-four minutes. Here Jordan checks it and approves. Nothing goes to the insurer without a person.

**2:15 to 3:00. During. Screen: Today, CT scanner, then the patient app and the map.**

> During. This is the hospital right now. The CT scanner is down, and the wait is climbing.
>
> The ops agent proposed moving three patients to the other scanner. It ran a simulation first, in Rust, in the browser. I'm... honestly I'm not happy with how the forecast chart looks. It's accurate. It's just not pretty. I ran out of time.
>
> _(approve)_
>
> And the patient's phone updates, with the reason. This is the patient app. One plan, one next step. If she's lost, she sends a photo of a sign and gets directions from where she's standing, step-free if she needs it.

**3:00 to 3:25. After. Screen: patient record timeline, the follow-up and results.**

> After. The discharge summary is drafted beside the doctor's own words, the doctor approves it, and then the patient gets it in her language. A day later an agent asks a couple of check-in questions. If an answer's wrong, it doesn't explain, it hands it to a nurse. And a result nobody has acknowledged gets flagged to a clinician instead of sitting there.

**3:25 to 3:45. The models, and more than one hospital. Screen: Agents page, then the hospital picker, Northgate in 3D.**

> It runs on Meta's models. Muse Spark reads and drafts. The operations agent runs on Spark Open, the open-weights one, on Baseten, because a hospital might want a model it can host itself. Muse Voice Transcribe for voice notes, SAM for counting people in the waiting room. Every run is logged, which model, what it saw.
>
> And it isn't one hospital. _(pick Northgate)_ Five buildings, a fourteen-floor tower. A new hospital can add itself, and patients can request a visit there too.

**3:45 to 4:00. Impact and honesty. Screen: Today, Northgate.**

> What would it change? My back-of-the-envelope, and it's an assumption: a clinic with thirty referrals a week, ten minutes saved on each, that's five hours a week back. For one clinic.
>
> And to be straight about it, everything here is fictional, the hospitals, the patients, the insurers. The model answers on the live site are replayed from a real recorded run. It never diagnoses anyone. Thanks for watching.

## Where it is deliberately imperfect

Keep at least two. They are the point.

- "People are, uh, improvising" at 1:00.
- "honestly I'm not happy with how the forecast chart looks" at 2:30.
- "it couldn't read the member ID, so it didn't guess" is a real moment of the product failing safely. Say it plainly.

## Before you record

- Reload the site so the hospital is at its starting state (it restores itself after 10 idle minutes).
- Sign in as Jordan. Make sure the prior-auth item is still in the Inbox. If an earlier take approved it, use New referral to bring in another fax.
- Use Halden until the models part, then switch to Northgate.
- Before you say "intake read a faxed referral", open the Agents page and check which model the intake agent shows. Say that name.
- Upload to YouTube, put the link in `docs/DEVPOST.md` (the Video line), and check it is under 4:00 if the hackathon allows four minutes. If the rules say three, cut the "After" section and the first paragraph of the problem.
