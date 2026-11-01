"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { agentProfile } from "@throughline/shared";
import { AgentGlyph } from "../../components/ui";
import {
  documentUrl,
  fetchFaxLine,
  fetchTimeline,
  requestVisit,
  type FaxLineItem,
  type VisitRequest,
} from "../../lib/platform";
import { useLive, useHospital } from "../../lib/session";

/**
 * Book a visit (patient-facing): one question per screen, in order, with the way ahead drawn
 * as a route. Every field has an example to fill it, so anyone can walk through it.
 */

const STEPS = [
  "What you need",
  "Your referral",
  "About you",
  "Insurance",
  "When you can come",
  "Check and send",
] as const;

const SERVICES: { id: VisitRequest["service"]; title: string; text: string }[] = [
  {
    id: "new_patient",
    title: "A first visit with a cancer specialist",
    text: "Your doctor found something that needs an oncologist. We book the tests and the visit together.",
  },
  {
    id: "second_opinion",
    title: "A second opinion",
    text: "You already have a diagnosis and want another oncologist to review it.",
  },
  {
    id: "follow_up",
    title: "A follow-up visit",
    text: "You are already a patient here and need your next visit.",
  },
];

/** The next ten weekdays from the hospital's today (Nov 17). */
function nextWeekdays(): string[] {
  const out: string[] = [];
  for (let t = Date.parse("2026-11-18T12:00:00Z"); out.length < 10; t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function RouteSteps({ at }: { at: number }) {
  return (
    <ol
      className="relative grid"
      style={{ gridTemplateColumns: `repeat(${STEPS.length}, minmax(0, 1fr))` }}
    >
      <span aria-hidden className="absolute top-[13px] right-[8%] left-[8%] h-[3px] bg-rule" />
      <span
        aria-hidden
        className="absolute top-[13px] left-[8%] h-[3px] bg-agent transition-[width] duration-500 ease-out"
        style={{ width: `${(at / (STEPS.length - 1)) * 84}%` }}
      />
      {STEPS.map((s, i) => (
        <li
          key={s}
          className="relative flex flex-col items-center text-center"
          aria-current={i === at ? "step" : undefined}
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
              i < at
                ? "bg-agent text-white"
                : i === at
                  ? "bg-ink text-white ring-4 ring-agent-tint"
                  : "border-2 border-rule bg-panel text-ink-soft"
            }`}
          >
            {i < at ? "✓" : i + 1}
          </span>
          <span
            className={`mt-2 hidden text-[13px] sm:block ${i === at ? "font-bold" : "text-ink-soft"}`}
          >
            {s}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Choice({
  selected,
  onClick,
  title,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-[6px] border-2 bg-panel p-4 text-left transition-[border-color,box-shadow] ${
        selected
          ? "border-agent shadow-[0_8px_24px_-14px_rgba(15,118,110,0.7)]"
          : "border-rule hover:border-ink/30"
      }`}
    >
      <span className="block text-[18px] font-bold">{title}</span>
      {children && <span className="mt-1 block text-[15px] text-ink-soft">{children}</span>}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[15px] font-bold">{label}</span>
      {hint && <span className="block text-[13px] text-ink-soft">{hint}</span>}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

const input = "h-12 w-full rounded-[6px] border border-rule bg-panel px-3 text-[17px]";

function Example({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-[15px] font-bold text-agent underline">
      {children}
    </button>
  );
}

/** After sending: the request's progress as the agents work on it. */
function Sent({ id, code }: { id: string; code: string }) {
  const { data: timeline } = useLive(() => fetchTimeline(id), [id]);
  const steps = (timeline ?? []).filter(
    (e) => (e.kind === "agent" && !e.run.summary.startsWith("is waiting")) || e.kind === "waiting",
  );
  return (
    <div className="mx-auto max-w-[720px]">
      <h1 className="font-display text-[44px] leading-tight font-bold">Request sent</h1>
      <p className="mt-2 text-[18px]">
        Your visit code is{" "}
        <span className="rounded-[4px] bg-ink px-2 py-0.5 font-figure text-[22px] font-semibold text-white tabular-nums">
          {code}
        </span>
        . Keep it: it opens your plan. We text you when your times are booked.
      </p>
      <h2 className="mt-8 text-[15px] font-bold text-ink-soft">
        What is happening with your request
      </h2>
      <ol className="mt-3 space-y-3">
        {steps.map((e, i) =>
          e.kind === "agent" ? (
            <li key={i} className="row-in flex items-start gap-3 rounded-[6px] bg-panel p-3">
              <AgentGlyph name={e.run.agent} size={26} />
              <p className="text-[16px]">
                <span className="font-bold">{agentProfile(e.run.agent)?.label}</span>{" "}
                {e.run.summary}
              </p>
            </li>
          ) : e.kind === "waiting" ? (
            <li
              key={i}
              className="row-in rounded-[6px] border-l-4 border-staff bg-staff-bg p-3 text-[16px]"
            >
              A person at the hospital is checking it now: {e.text.toLowerCase()}.
            </li>
          ) : null,
        )}
        {steps.length === 0 && <li className="text-[16px] text-ink-soft">Starting.</li>}
      </ol>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/p/${id}`}
          className="inline-flex min-h-12 items-center rounded-[6px] bg-agent px-5 text-[17px] font-bold text-white"
        >
          Open my visit page
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-12 items-center px-3 text-[16px] text-ink-soft underline"
        >
          Back to the front page
        </Link>
      </div>
    </div>
  );
}

export default function BookVisit() {
  const hospital = useHospital();
  const [at, setAt] = useState(0);
  const [faxes, setFaxes] = useState<FaxLineItem[]>([]);
  const [service, setService] = useState<VisitRequest["service"] | undefined>();
  const [hasReferral, setHasReferral] = useState<boolean | undefined>();
  const [fax, setFax] = useState<string | undefined>();
  const [doctor, setDoctor] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [mobility, setMobility] = useState<"walking" | "wheelchair">("walking");
  const [companion, setCompanion] = useState(true);
  const [member, setMember] = useState("");
  const [days, setDays] = useState<Record<string, "morning" | "afternoon" | "any">>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState<{ id: string; code: string } | undefined>();
  useEffect(() => {
    void fetchFaxLine()
      .then(setFaxes)
      .catch(() => undefined);
  }, []);
  const chosen = faxes.find((f) => f.id === fax) ?? faxes[0];
  const weekdays = nextWeekdays();

  const ok = [
    !!service,
    hasReferral === false ? doctor.trim().length > 1 : hasReferral === true && !!fax,
    name.trim().length > 1 && /^\d{4}-\d{2}-\d{2}$/.test(dob) && phone.trim().length >= 7,
    member.trim().length >= 6,
    Object.keys(days).length > 0,
    true,
  ][at];

  const send = async () => {
    if (!service) return;
    setBusy(true);
    setError(false);
    try {
      const r = await requestVisit({
        service,
        ...(hasReferral && fax ? { referral_fax: fax } : { doctor: doctor.trim() }),
        patient: { name: name.trim(), dob, phone: phone.trim(), mobility, companion },
        member_id: member.trim(),
        days: Object.entries(days).map(([date, part]) => ({ date, part })),
      });
      setSent({ id: r.id, code: r.visit_code });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-dvh bg-canvas px-6 py-10 text-ink">
        <Sent id={sent.id} code={sent.code} />
      </div>
    );
  }

  if (hospital.id && !hospital.forecasts)
    return (
      <div className="min-h-dvh bg-canvas px-6 py-10 text-ink">
        <div className="mx-auto max-w-[640px]">
          <h1 className="font-display text-[36px] leading-tight font-bold">
            Book by phone for now
          </h1>
          <p className="mt-3 text-[18px]">
            Online booking for {hospital.name} opens once its schedules are connected. Call{" "}
            <a className="font-bold text-agent underline" href={`tel:${hospital.phone_href}`}>
              {hospital.phone}
            </a>{" "}
            and the team will set up your visit.
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

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex max-w-[860px] items-center gap-3 px-6 pt-6">
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden className="block h-[6px] w-7 bg-agent" />
          <span className="font-display text-[24px] font-bold">{hospital.name}</span>
        </Link>
        <a href={`tel:${hospital.phone_href}`} className="ml-auto text-[15px] text-agent underline">
          Prefer to call? {hospital.phone}
        </a>
      </header>
      <main className="mx-auto max-w-[860px] px-6 pt-8 pb-16">
        <h1 className="font-display text-[40px] leading-tight font-bold">
          Book a visit with Oncology
        </h1>
        <div className="mt-6">
          <RouteSteps at={at} />
        </div>

        <form
          className="mt-10 rounded-[8px] bg-panel p-6 shadow-[0_18px_40px_-28px_rgba(24,34,58,0.55)] sm:p-8"
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
                "What do you need?",
                "Did your doctor send a referral?",
                "About you",
                "Your insurance",
                "When can you come?",
                "Check and send",
              ][at]
            }
          </h2>

          <div key={at} className="row-in mt-5 space-y-4">
            {at === 0 &&
              SERVICES.map((s) => (
                <Choice
                  key={s.id}
                  selected={service === s.id}
                  onClick={() => setService(s.id)}
                  title={s.title}
                >
                  {s.text}
                </Choice>
              ))}

            {at === 1 && (
              <>
                <Choice
                  selected={hasReferral === true}
                  onClick={() => setHasReferral(true)}
                  title="Yes, my doctor faxed it"
                >
                  We find it on our fax line and read it for you.
                </Choice>
                {hasReferral === true && (
                  <div className="rounded-[6px] bg-canvas p-4">
                    <p className="text-[15px] font-bold">Which one is yours?</p>
                    <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_200px]">
                      <ul className="space-y-2">
                        {faxes.map((f) => (
                          <li key={f.id}>
                            <button
                              type="button"
                              onClick={() => setFax(f.id)}
                              aria-pressed={fax === f.id}
                              className={`w-full rounded-[6px] border-2 bg-panel px-3 py-2 text-left text-[15px] ${
                                fax === f.id ? "border-agent" : "border-rule"
                              }`}
                            >
                              <span className="font-bold">{f.practice}</span>, for {f.patient}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {chosen && (
                        <img
                          src={documentUrl(chosen.fax)}
                          alt={`Referral from ${chosen.practice}`}
                          className="w-full rounded-[4px] ring-1 ring-rule"
                        />
                      )}
                    </div>
                    {!fax && faxes[0] && (
                      <Example onClick={() => setFax(faxes[0]?.id)}>
                        Use an example referral
                      </Example>
                    )}
                  </div>
                )}
                <Choice
                  selected={hasReferral === false}
                  onClick={() => setHasReferral(false)}
                  title="Not yet"
                >
                  Tell us your doctor; we ask them for it.
                </Choice>
                {hasReferral === false && (
                  <div className="space-y-2 rounded-[6px] bg-canvas p-4">
                    <Field label="Your doctor's name">
                      <input
                        value={doctor}
                        onChange={(e) => setDoctor(e.target.value)}
                        className={input}
                      />
                    </Field>
                    <Example onClick={() => setDoctor("Dr. Grace Lin, Lakeview Primary Care")}>
                      Use an example doctor
                    </Example>
                  </div>
                )}
              </>
            )}

            {at === 2 && (
              <>
                <Field label="Full name">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className={input}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Date of birth">
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className={input}
                    />
                  </Field>
                  <Field label="Mobile phone" hint="We text your plan here.">
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      className={input}
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <fieldset>
                    <legend className="text-[15px] font-bold">Getting around</legend>
                    <div className="mt-1 flex gap-2">
                      {(["walking", "wheelchair"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={mobility === m}
                          onClick={() => setMobility(m)}
                          className={`h-11 flex-1 rounded-[6px] border-2 text-[15px] ${mobility === m ? "border-agent font-bold" : "border-rule"}`}
                        >
                          {m === "walking" ? "I walk" : "I use a wheelchair"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend className="text-[15px] font-bold">Someone coming with you?</legend>
                    <div className="mt-1 flex gap-2">
                      {[true, false].map((v) => (
                        <button
                          key={String(v)}
                          type="button"
                          aria-pressed={companion === v}
                          onClick={() => setCompanion(v)}
                          className={`h-11 flex-1 rounded-[6px] border-2 text-[15px] ${companion === v ? "border-agent font-bold" : "border-rule"}`}
                        >
                          {v ? "Yes" : "No, I come alone"}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
                {chosen && (
                  <Example
                    onClick={() => {
                      setName(chosen.patient);
                      setDob(chosen.dob);
                      setPhone(chosen.phone);
                    }}
                  >
                    Fill with example details
                  </Example>
                )}
              </>
            )}

            {at === 3 && (
              <>
                <Field label="Insurance">
                  <select className={input} defaultValue={hospital.payers[0]}>
                    {hospital.payers.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Member ID" hint="On the front of your insurance card.">
                  <input
                    value={member}
                    onChange={(e) => setMember(e.target.value)}
                    className={`${input} tabular-nums`}
                  />
                </Field>
                {chosen && (
                  <div className="flex flex-wrap items-center gap-4">
                    <img
                      src={documentUrl(chosen.card)}
                      alt="Example insurance card"
                      className="w-[220px] rounded-[8px] ring-1 ring-rule"
                    />
                    <Example onClick={() => setMember(chosen.member_id)}>
                      Use this example card
                    </Example>
                  </div>
                )}
              </>
            )}

            {at === 4 && (
              <>
                <p className="text-[16px] text-ink-soft">
                  Pick every day that works. We fit all your tests and the visit into as few trips
                  as we can.
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {weekdays.map((d) => {
                    const part = days[d];
                    return (
                      <li
                        key={d}
                        className={`rounded-[6px] border-2 p-3 ${part ? "border-agent" : "border-rule"}`}
                      >
                        <label className="flex items-center gap-2 text-[16px] font-bold">
                          <input
                            type="checkbox"
                            checked={!!part}
                            onChange={(e) =>
                              setDays((cur) =>
                                e.target.checked
                                  ? { ...cur, [d]: "any" }
                                  : Object.fromEntries(
                                      Object.entries(cur).filter(([k]) => k !== d),
                                    ),
                              )
                            }
                            className="h-5 w-5 accent-[#0f766e]"
                          />
                          {dayLabel(d)}
                        </label>
                        {part && (
                          <div className="mt-2 flex gap-1">
                            {(["morning", "afternoon", "any"] as const).map((p) => (
                              <button
                                key={p}
                                type="button"
                                aria-pressed={part === p}
                                onClick={() => setDays((cur) => ({ ...cur, [d]: p }))}
                                className={`rounded-[4px] px-2 py-1 text-[13px] ${part === p ? "bg-ink text-white" : "bg-canvas"}`}
                              >
                                {p === "any"
                                  ? "Any time"
                                  : p === "morning"
                                    ? "Morning"
                                    : "Afternoon"}
                              </button>
                            ))}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <Example
                  onClick={() =>
                    setDays({
                      [weekdays[1] as string]: "morning",
                      [weekdays[3] as string]: "any",
                      [weekdays[6] as string]: "morning",
                    })
                  }
                >
                  Pick example days
                </Example>
              </>
            )}

            {at === 5 && (
              <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-[16px]">
                <dt className="text-ink-soft">You need</dt>
                <dd>{SERVICES.find((s) => s.id === service)?.title}</dd>
                <dt className="text-ink-soft">Referral</dt>
                <dd>
                  {hasReferral && fax
                    ? `Faxed by ${faxes.find((f) => f.id === fax)?.practice}`
                    : `We ask ${doctor}`}
                </dd>
                <dt className="text-ink-soft">You</dt>
                <dd>
                  {name}, born {dob}, {phone}.{" "}
                  {mobility === "wheelchair" ? "Uses a wheelchair." : "Walks."}{" "}
                  {companion ? "Someone comes along." : "Comes alone."}
                </dd>
                <dt className="text-ink-soft">Insurance</dt>
                <dd>
                  {hospital.payers[0]}, member ID {member}
                </dd>
                <dt className="text-ink-soft">Days</dt>
                <dd>
                  {Object.entries(days)
                    .sort()
                    .map(([d, p]) => `${dayLabel(d)} (${p === "any" ? "any time" : p})`)
                    .join(", ")}
                </dd>
              </dl>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-4 text-[15px] text-urgent">
              The hospital didn&apos;t receive it. Check your connection and send again.
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
              {at === STEPS.length - 1 ? (busy ? "Sending…" : "Send request") : "Continue"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
