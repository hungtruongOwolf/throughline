# Demo video script (3:00)

Read it out loud once before you record. It is written to be spoken, not read: short sentences, a few places where you correct yourself, one place where you admit something is not finished. Keep those. A flawless read sounds like an ad; a judge trusts the person who says "this part is rough".

Rough pace: 140 words a minute, so about 400 words of speech. Leave the pauses in. If a take goes wrong halfway, keep going and say the line again. That is how people talk.

Record at 1080p on https://throughline-zeta-ten.vercel.app. Browser zoom 110%. Close other tabs. Open the front page first.

## Numbers you may say, and where they come from

Say "reported" or "about" where marked. Do not round them up.

| What you say                                                         | Source                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| About half of specialty referrals are never completed                | Weiner et al., J Eval Clin Pract, 2010. Adults 65+, one US academic setting. Old and narrow |
| Physicians and their staff spend about 13 hours a week on prior auth | AMA physician survey, 2024                                                                  |
| 39 prior auth requests per physician per week                        | Same AMA survey                                                                             |
| A manual prior auth takes about 24 minutes (16 through a portal)     | CAQH Index, 2024                                                                            |
| A new-patient appointment takes 31 days on average in big US cities  | AMN Healthcare wait-time survey, 2025                                                       |
| Montage Health reported referral turnaround of 23 days down to 1.5   | Vendor case study (Notable), 2025. Say "reported"                                           |
| Mayo reviews complex referrals in under 24 hours with AI triage      | Mayo news and Becker's, seen in summaries only. Say "reported", or leave it out             |

Do not say: a fax percentage (no reliable US number), a national no-show cost, or a wayfinding dollar cost. We could not find a source we trust.

Our own numbers, all checkable in the repo: 13 agents, 30 referrals in the book, 3 hospitals, 215 runtime tests, intake read 10 of 10 faxes correctly, the classifier handled 60 of 60 messages with no false alarms, and 156 live model calls were recorded.

## The script

**0:00 to 0:25. The problem. Screen: the front page, 3D hospital turning slowly.**

> Okay. So, a referral. A doctor sends a patient to a specialist, and in a lot of hospitals that referral is still a fax.
>
> There's an old study of older adults where about half of specialty referrals just never got completed. It's old, one hospital, so take it as a hint, not a law. But anyone who works in a clinic nods when you say it.
>
> And the work around it is heavy. The AMA says doctors and their staff spend around thirteen hours a week on prior authorization alone.

**0:25 to 1:05. The solution, staff side. Screen: click Jordan Park, Inbox.**

> This is Throughline. I'm signed in as the referral coordinator, Jordan.
>
> Thirteen agents do the routine part. This one, intake, read a faxed referral and pulled out the patient, the doctor, the reason. And, uh, here, it couldn't read the member ID on the card. So it didn't guess. It asked Jordan.
>
> That's the rule everywhere. The agent drafts, a person signs off at the steps that matter. Insurance submission, a change to the day's schedule. Nothing goes out without a person.
>
> _(click Approve on the prior-auth item)_
>
> A manual prior auth is about twenty-four minutes of someone's time, that's the CAQH number. Here the packet is already built. Jordan checks it and approves it.

**1:05 to 1:40. The models. Screen: Agents page, then one agent's run.**

> It runs on Meta's models. Muse Spark reads the fax and writes the drafts. The operations agent runs on Spark Open, the open-weights one, hosted on Baseten. I picked that on purpose, because a hospital might want its own model on its own hardware.
>
> Voice notes go through Muse Voice Transcribe. And SAM counts the people in the waiting-room frames, so the wait times on the map aren't just guesses.
>
> Every run is written down. What the agent saw, what it did, which model. So when someone asks "why did it do that", you can open it.

**1:40 to 2:15. The day of the visit. Screen: Today, then click the CT scanner.**

> Now the day of the visit. This is the hospital right now. CT one is down.
>
> The ops agent noticed the wait climbing and proposed moving three patients to CT two. It tested that in a simulation first. The engine for that is written in Rust, running in the browser.
>
> I'm... honestly I'm still not happy with how the forecast chart looks. It's accurate, it's just not pretty. I ran out of time on that.
>
> _(approve)_
>
> And the patient's phone updates, with the reason.

**2:15 to 2:40. The patient. Screen: patient app on a phone-sized window, then the map.**

> This is what the patient sees. One plan. One next step. No login to remember.
>
> If she gets lost, she sends a photo of a sign, and gets directions from where she's standing. Step-free if she needs it.
>
> And it's not one hospital. _(open the hospital picker, choose Northgate)_ This one has five buildings, a fourteen-floor tower. Same platform. A new hospital can add itself.

**2:40 to 3:00. Impact and honesty. Screen: Today, Northgate, 3D.**

> So what would this change? Here's my back-of-the-envelope, and it's an assumption, not a measurement. If a clinic handles thirty referrals a week and the agent saves just ten minutes on each, that's five hours a week back. For one clinic.
>
> What it is not: everything you saw is fictional. The hospitals, the patients, the insurers. The model answers on the live site are replayed from a real recorded run, so it works without keys. Nothing here diagnoses anyone.
>
> The fax is a boring problem. Boring problems are where people fall through. That's Throughline. Thanks for watching.

## Where it is deliberately imperfect

Keep at least two. They are the point.

- "uh, here, it couldn't read the member ID" at 0:25.
- "honestly I'm still not happy with how the forecast chart looks" at 1:40.
- "take it as a hint, not a law" at 0:00. It is a caveat a careful person would say.

## Before you record

- Reload the site so the hospital is at its starting state (it restores itself after 10 idle minutes).
- Sign in as Jordan. Make sure the prior-auth item is still in the Inbox. If you approved it in an earlier take, use New referral to bring in another fax.
- Choose Halden for the first two minutes, then switch to Northgate at the end.
- Upload to YouTube as unlisted or public, put the link in `docs/DEVPOST.md` (the Video line), and check it is under 3:00.
