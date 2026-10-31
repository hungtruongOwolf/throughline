import Link from "next/link";
import { SiteHeader } from "../components/SiteHeader";

const STAGES = [
  {
    title: "Referral",
    when: "Nov 10",
    text: "A faxed referral is read, the missing member ID is asked for, insurance is checked.",
  },
  {
    title: "Insurance",
    when: "Nov 10–12",
    text: "The prior authorization is drafted and waits for a coordinator before it goes to the payer.",
  },
  {
    title: "Scheduled",
    when: "Nov 12",
    text: "Five services fit into two trips, mornings only, with prep and reminders by text.",
  },
  {
    title: "Visit day",
    when: "Nov 17",
    text: "A live plan on her phone, step-free directions, and a new order when a CT scanner goes down.",
  },
  {
    title: "After the visit",
    when: "Nov 17 on",
    text: "A plain-language summary, a teach-back check, follow-ups booked, results acknowledged.",
  },
];

const ROLES = [
  {
    href: "/p/maria-001",
    who: "For patients",
    what: "What's next, where it is, how long it takes, and how to get there without stairs.",
    cta: "Open Maria's phone",
  },
  {
    href: "/coordinator",
    who: "For intake coordinators",
    what: "Only the referrals that need a person: a missing field, an authorization to approve.",
    cta: "Open the intake inbox",
  },
  {
    href: "/board/imaging_ct",
    who: "For station staff",
    what: "Who is arriving, who is waiting, who needs a wheelchair, at the CT desk.",
    cta: "Open the CT board",
  },
  {
    href: "/ops",
    who: "For operations",
    what: "Where the day is running late, and a simulated fix to approve or reject.",
    cta: "Open the command center",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader current="/" />
      <main className="mx-auto max-w-6xl px-6">
        <section className="grid gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:items-end">
          <div>
            <h1 className="font-display text-[56px] leading-[1.02] font-bold md:text-[72px]">
              One thread through the whole hospital visit.
            </h1>
            <p className="mt-6 max-w-[60ch] text-[19px] text-ink-soft">
              Throughline guides a cancer patient from the referral fax to the follow-up, and helps
              the hospital keep the day on track. AI agents do the paperwork and the planning; a
              person approves anything that matters.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/journey/maria-001"
                className="inline-flex min-h-12 items-center rounded-[12px] bg-line px-6 text-[17px] font-bold text-white"
              >
                Follow Maria&apos;s journey
              </Link>
              <span className="text-[15px] text-ink-soft">About 3 minutes, plays by itself.</span>
            </div>
          </div>
          <aside className="border-l-[6px] border-line pl-6 text-[15px] text-ink-soft">
            <p className="font-display text-[28px] font-bold text-ink">Maria Diaz, 71</p>
            <p className="mt-2">
              Referred to medical oncology for labs, a CT scan, a new-patient visit, and an
              infusion. Her husband can&apos;t come with her, and she will need a wheelchair.
            </p>
            <p className="mt-2">Every person and place here is fictional.</p>
          </aside>
        </section>

        <section aria-labelledby="journey-heading" className="py-6">
          <h2 id="journey-heading" className="font-display text-[28px] font-bold">
            Her journey, end to end
          </h2>
          <ol className="relative mt-6 grid gap-6 md:grid-cols-5">
            <span
              aria-hidden
              className="absolute top-[11px] right-0 left-0 hidden h-[6px] bg-line md:block"
            />
            {STAGES.map((s, i) => (
              <li key={s.title} className="relative">
                <span
                  aria-hidden
                  className="relative z-10 block h-7 w-7 border-[6px] border-line bg-paper"
                />
                <p className="mt-3 text-[13px] text-ink-soft">
                  {i + 1}. {s.when}
                </p>
                <p className="font-display text-[24px] font-bold">{s.title}</p>
                <p className="mt-1 text-[15px] text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="roles-heading" className="py-12">
          <h2 id="roles-heading" className="font-display text-[28px] font-bold">
            See it as the people who use it
          </h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="flex h-full flex-col rounded-[12px] bg-white p-6 ring-1 ring-ink/10 hover:ring-line"
                >
                  <span className="font-display text-[24px] font-bold">{r.who}</span>
                  <span className="mt-2 flex-1 text-[15px] text-ink-soft">{r.what}</span>
                  <span className="mt-4 font-bold text-line">{r.cta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="how-heading"
          className="grid gap-8 border-t border-ink/10 py-12 md:grid-cols-3"
        >
          <h2 id="how-heading" className="sr-only">
            How it works
          </h2>
          <div>
            <p className="font-display text-[22px] font-bold">Agents with a human gate</p>
            <p className="mt-2 text-[15px] text-ink-soft">
              Each step is an agent with a narrow permission. Sending an authorization or changing
              capacity waits for a person. Medical questions always go to a nurse.
            </p>
          </div>
          <div>
            <p className="font-display text-[22px] font-bold">A planning engine in Rust</p>
            <p className="mt-2 text-[15px] text-ink-soft">
              Scheduling, the visit-day route, walking times, queue waits, and the what-if
              simulation run in a Rust engine, in the browser and on the server.
            </p>
          </div>
          <div>
            <p className="font-display text-[22px] font-bold">Built on Meta models</p>
            <p className="mt-2 text-[15px] text-ink-soft">
              Muse Spark reads faxes and signs and writes messages, SAM counts waiting rooms. Every
              model step has a fallback that works without it.
            </p>
          </div>
        </section>
      </main>
      <footer className="border-t border-ink/10 py-6 text-center text-[13px] text-ink-soft">
        Synthetic demo data. Not a real patient, hospital, or insurer.
      </footer>
    </>
  );
}
