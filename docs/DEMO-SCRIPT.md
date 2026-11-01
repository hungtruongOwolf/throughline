# Demo video script (about 4:00)

This is meant to be spoken, not read. It follows one patient, Maria, from the fax to the follow-up, so every part leads into the next. Read it out loud once; where a sentence is hard to say, change it to how you would say it.

Quay 1080p at https://throughline-zeta-ten.vercel.app, zoom 110%, other tabs closed.

Stage directions are in _italics_. When one says "pause", say nothing and let the screen work.

---

## 1. Maria (0:00 to 0:50)

_Screen: the 3D hospital turning slowly on the front page._

> Let me tell you about Maria. She's seventy-one, and her doctor just found something on a scan. He wants her to see a cancer specialist, so his office does what most offices still do. They fax it.
>
> And a fax isn't a person. It lands in a pile. Somebody has to read it. Somebody calls the insurance. Somebody asks permission for the scan, and doctors and their staff spend about thirteen hours a week on that alone. And somebody has to find her a time.
>
> Then the visit itself. A big building she's never been in. About two hours of her day, and maybe twenty minutes of it with the doctor. And then she goes home, and most older patients don't understand at least one change to their medicine.
>
> Nobody did anything wrong here. It's just that nobody owns the whole thing, from the fax to the follow-up.

## 2. The idea (0:50 to 1:10)

_Screen: front page, staff list and patient door._

> So that's what Throughline does. Maria gets one thread, start to finish, and thirteen agents pass it along, one to the next. People step in only where it actually needs a person. Let me show you.

## 3. Before the visit (1:10 to 2:20)

_Screen: sign in as Jordan, open the new referral's patient record so the timeline fills in. Don't click anything for the first few seconds._

> Maria's fax just arrived. I'm not going to click anything.
>
> _(pause, let the timeline start)_
>
> The first agent, Intake, has read it. And the insurance number's smudged, so it doesn't guess. It asks Jordan, the coordinator. Jordan checks the card, types it in, and that's all Jordan has to do.
>
> Because the second that lands, Coverage wakes up and finds the scan needs the insurer's permission. And that wakes up Prior auth, which writes the whole request, with its sources next to every line.
>
> _(open the draft)_
>
> Now this is a place for a person. Nothing goes to an insurer without one. So Jordan reads it, and approves.
>
> _(click Approve)_
>
> Doing that by hand takes about twenty-four minutes. This one was already written.
>
> Then Scheduling books everything the doctor ordered, in as few trips as it can. That one's not a language model, by the way. It's a Rust engine, because a schedule should be exact.
>
> And when Maria answers her plan with a voice note, saying she's going to need a wheelchair, the messaging agent hears that, and the Itinerary agent redraws her route to use elevators. Nobody typed that in.

## 4. The visit day (2:20 to 3:10)

_Screen: Today, then the patient app in a phone-sized window._

> Now it's the day of the visit. This is the hospital, live. And one of the two CT scanners is down, and nobody's told anyone.
>
> But there's an agent that counts the people in each waiting room, from the camera frames. It sees the CT line growing, and tells the Ops planner. And the planner does something I really like. Before it bothers anybody, it runs the rest of the day with every possible fix, and comes back with one. Move three patients to the other scanner.
>
> _(click Approve)_
>
> Sam, the operations lead, approves it. And right away Maria's phone tells her what changed, and why. She never asked.
>
> _(on the phone view)_
>
> And if she gets lost anyway, she takes a photo of a sign, and it tells her where she is, and the way to the elevator.

## 5. After the visit (3:10 to 3:35)

_Screen: the patient record, the after-visit part of the timeline._

> And when she's gone home, the thread keeps going. Discharge rewrites the doctor's notes in plain words, right next to the original, and checks the next day that she understood. If she didn't, it doesn't try to explain. It hands her to a nurse.
>
> Another agent watches her test result until the doctor has signed off. And Follow-up books her next visit and sends the report back to the doctor who sent the fax.

## 6. What it runs on (3:35 to 3:55)

_Screen: the Agents page, then the hospital picker and Northgate in 3D._

> All of this runs on Meta's models. Muse Spark does the reading and the drafting. The Ops planner runs on Spark Open, the open-weights one, on Baseten, because a hospital might want to run that part on its own hardware. Voice notes go through Muse Voice Transcribe, and SAM does the counting. Every step is logged, so you can always ask why it did something, and open the answer.
>
> And it isn't one hospital. _(pick Northgate)_ This one has five buildings and a fourteen-floor tower, and a new hospital can add itself.

## 7. Close (3:55 to 4:05)

_Screen: Today, Northgate._

> Thirty referrals a week, ten minutes saved on each, that's five hours back. But honestly, the bigger thing is Maria. Nobody had to hold her thread. Throughline did. Thanks for watching.

---

## Numbers, and where they come from

| You say                                                    | Source                           |
| ---------------------------------------------------------- | -------------------------------- |
| Staff spend about 13 hours a week on prior authorization   | AMA survey, 2024                 |
| About 2 hours of the day, about 20 minutes with the doctor | Ray et al., JAMA Intern Med 2015 |
| Most older patients miss at least one medication change    | J Gen Intern Med, 2012           |
| Doing a prior auth by hand takes about 24 minutes          | CAQH Index, 2024                 |

Everything else you say about the product is from the repo: 13 agents, five buildings and a fourteen-floor tower at Northgate. "Thirty referrals, ten minutes each, five hours" is arithmetic, not a measurement.

## Before you record

- Reload the site so the hospital is at its starting state.
- Use **New referral** in Referrals to receive a fax, then open that patient's record so the timeline fills in while you talk. Maria's own record has already passed these steps.
- Sign in as Jordan. For the Ops part, sign in as Sam or use the Today page.
- Before you say which model reads the fax, open the Agents page and check what the intake agent lists. Say that name.
- If the contest limit is three minutes, cut section 5, the phone lines in section 4, and the last paragraph of section 1.
