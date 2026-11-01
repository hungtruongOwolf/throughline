"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Hospital } from "@throughline/shared";
import { RUNTIME_URL } from "../../lib/runtime";

/**
 * Add your hospital: a hospital joins Throughline. Five steps, one screen each, with example
 * answers, ending in a workspace that is set up with the hospital's own name, specialties,
 * referral line, payers, and campus.
 */

const STEPS = ["Your hospital", "Referrals", "Payers", "Your campus", "Contact"] as const;
const SPECIALTIES = [
  "Medical oncology",
  "Cardiology",
  "Orthopedics",
  "Neurology",
  "Gastroenterology",
  "Radiation oncology",
];
const PAYERS = [
  "Medicare",
  "Medicaid",
  "Blue Cross Blue Shield",
  "Aetna",
  "UnitedHealthcare",
  "Cigna",
  "Humana",
];

const input = "h-12 w-full rounded-[6px] border border-rule bg-panel px-3 text-[17px]";

function Example({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-[15px] font-bold text-agent underline">
      {children}
    </button>
  );
}

function Chips({
  all,
  picked,
  toggle,
}: {
  all: string[];
  picked: string[];
  toggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {all.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={picked.includes(v)}
          onClick={() => toggle(v)}
          className={`rounded-full border-2 px-3 py-1.5 text-[15px] ${
            picked.includes(v) ? "border-agent bg-agent-tint font-bold" : "border-rule bg-panel"
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export default function AddHospital() {
  const [at, setAt] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [fax, setFax] = useState("");
  const [phone, setPhone] = useState("");
  const [payers, setPayers] = useState<string[]>([]);
  const [plans, setPlans] = useState<string[]>([]);
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState<Hospital | undefined>();
  const toggle = (set: (f: (v: string[]) => string[]) => void) => (v: string) =>
    set((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));

  const ok = [
    name.trim().length > 2 && city.trim().length > 1 && specialties.length > 0,
    fax.trim().length >= 7 && phone.trim().length >= 7,
    payers.length > 0,
    plans.length > 0,
    contact.trim().length > 1,
  ][at];

  const send = async () => {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`${RUNTIME_URL}/api/hospitals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          specialties,
          phone: phone.trim(),
          payers,
          contact: contact.trim(),
        }),
      });
      if (!res.ok) throw new Error();
      setDone((await res.json()) as Hospital);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-dvh bg-canvas px-6 py-10 text-ink">
        <div className="mx-auto max-w-[720px]">
          <h1 className="font-display text-[44px] leading-tight font-bold">
            {done.name} is being set up
          </h1>
          <p className="mt-2 text-[18px]">
            Your workspace is listed under Hospitals on Throughline as Setting up. Here is what
            happens next, in order:
          </p>
          <ol className="mt-6 space-y-3">
            {[
              [
                "Connect your referral fax line",
                `Faxes to ${fax} arrive in your workspace and Intake reads them.`,
              ],
              [
                "Import your schedules",
                `Clinic, imaging, lab, and infusion calendars for ${done.specialties.join(", ")}, so Scheduling books real slots.`,
              ],
              ["Load payer rules", `Prior authorization rules for ${done.payers.join(", ")}.`],
              [
                "Map your campus",
                `From the ${plans.length} floor plan${plans.length > 1 ? "s" : ""} you sent: rooms, elevators, and step-free routes for wayfinding.`,
              ],
              [
                "Start with every decision approved by staff",
                "Agents draft, your coordinators, nurses, and clinicians approve, until you choose what can run on its own.",
              ],
            ].map(([t, d], i) => (
              <li
                key={t}
                className="flex gap-3 rounded-[6px] bg-panel p-4 shadow-[0_12px_30px_-24px_rgba(24,34,58,0.5)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-[16px] font-bold">{t}</span>
                  <span className="block text-[15px] text-ink-soft">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[15px] text-ink-soft">
            We contact {contact} at {phone} to schedule each step.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex min-h-12 items-center rounded-[6px] bg-agent px-5 text-[17px] font-bold text-white"
          >
            Back to the front page
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex max-w-[860px] items-center gap-3 px-6 pt-6">
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden className="block h-[6px] w-7 bg-agent" />
          <span className="font-display text-[24px] font-bold">Throughline</span>
        </Link>
      </header>
      <main className="mx-auto max-w-[860px] px-6 pt-8 pb-16">
        <h1 className="font-display text-[40px] leading-tight font-bold">Add your hospital</h1>
        <p className="mt-2 max-w-[60ch] text-[17px] text-ink-soft">
          Five questions to set up a workspace for your referrals, visit days, and follow-up.
        </p>
        <ol className="mt-6 flex flex-wrap gap-x-6 gap-y-2" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === at ? "step" : undefined}
              className="flex items-center gap-2 text-[14px]"
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
                  i < at
                    ? "bg-agent text-white"
                    : i === at
                      ? "bg-ink text-white"
                      : "border-2 border-rule text-ink-soft"
                }`}
              >
                {i < at ? "✓" : i + 1}
              </span>
              <span className={i === at ? "font-bold" : "text-ink-soft"}>{s}</span>
            </li>
          ))}
        </ol>

        <form
          className="mt-8 rounded-[8px] bg-panel p-6 shadow-[0_18px_40px_-28px_rgba(24,34,58,0.55)] sm:p-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            if (at < STEPS.length - 1) setAt(at + 1);
            else void send();
          }}
        >
          <h2 className="font-figure text-[28px] font-semibold">
            {
              [
                "About your hospital",
                "How do referrals reach you?",
                "Which payers do you work with?",
                "Your campus",
                "Who should we contact?",
              ][at]
            }
          </h2>
          <div key={at} className="row-in mt-5 space-y-4">
            {at === 0 && (
              <>
                <label className="block">
                  <span className="block text-[15px] font-bold">Hospital name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="block text-[15px] font-bold">City</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={`${input} mt-1`}
                  />
                </label>
                <fieldset>
                  <legend className="text-[15px] font-bold">Specialties to start with</legend>
                  <div className="mt-2">
                    <Chips all={SPECIALTIES} picked={specialties} toggle={toggle(setSpecialties)} />
                  </div>
                </fieldset>
                <Example
                  onClick={() => {
                    setName("Riverbend Regional Hospital");
                    setCity("Riverbend");
                    setSpecialties(["Cardiology", "Medical oncology"]);
                  }}
                >
                  Fill with an example hospital
                </Example>
              </>
            )}
            {at === 1 && (
              <>
                <label className="block">
                  <span className="block text-[15px] font-bold">Referral fax number</span>
                  <span className="block text-[13px] text-ink-soft">
                    Faxes to this number arrive in your workspace.
                  </span>
                  <input
                    value={fax}
                    onChange={(e) => setFax(e.target.value)}
                    inputMode="tel"
                    className={`${input} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="block text-[15px] font-bold">Patient line</span>
                  <span className="block text-[13px] text-ink-soft">
                    Shown to patients as the number to call.
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    className={`${input} mt-1`}
                  />
                </label>
                <Example
                  onClick={() => {
                    setFax("555-0410");
                    setPhone("555-0400");
                  }}
                >
                  Use example numbers
                </Example>
              </>
            )}
            {at === 2 && (
              <>
                <Chips all={PAYERS} picked={payers} toggle={toggle(setPayers)} />
                <Example onClick={() => setPayers(["Medicare", "Blue Cross Blue Shield", "Aetna"])}>
                  Pick example payers
                </Example>
              </>
            )}
            {at === 3 && (
              <>
                <p className="text-[16px] text-ink-soft">
                  Send one floor plan per building and level. We map rooms, elevators, and step-free
                  routes from them; your patients see the way on their phones.
                </p>
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-[6px] px-4 text-[16px] font-bold text-agent ring-2 ring-agent">
                  Choose floor plans
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="sr-only"
                    onChange={(e) => setPlans([...(e.target.files ?? [])].map((f) => f.name))}
                  />
                </label>
                {plans.length > 0 && (
                  <ul className="list-disc pl-5 text-[15px]">
                    {plans.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div>
                  <Example
                    onClick={() =>
                      setPlans([
                        "main-building-level-1.pdf",
                        "main-building-level-2.pdf",
                        "outpatient-center-level-1.pdf",
                      ])
                    }
                  >
                    Use example floor plans
                  </Example>
                </div>
              </>
            )}
            {at === 4 && (
              <>
                <label className="block">
                  <span className="block text-[15px] font-bold">Your name and role</span>
                  <input
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className={`${input} mt-1`}
                  />
                </label>
                <Example onClick={() => setContact("Dana Morales, Director of Patient Access")}>
                  Use an example contact
                </Example>
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-4 text-[15px] text-urgent">
              That didn&apos;t go through. Check your connection and send again.
            </p>
          )}
          <div className="mt-8 flex items-center gap-3 border-t border-rule pt-6">
            {at > 0 && (
              <button
                type="button"
                onClick={() => setAt(at - 1)}
                className="min-h-12 px-3 text-[16px] text-ink-soft underline"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={!ok || busy}
              className="ml-auto min-h-12 rounded-[6px] bg-agent px-6 text-[17px] font-bold text-white disabled:opacity-40"
            >
              {at === STEPS.length - 1 ? (busy ? "Sending…" : "Set up our workspace") : "Continue"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
