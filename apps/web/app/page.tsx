"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { agentProfile, STAFF, type StaffRole } from "@throughline/shared";
import { AgentGlyph, Avatar, hhmm, StageRail } from "../components/ui";
import { fetchHospital, fetchReferrals } from "../lib/platform";
import { useLive, useUser } from "../lib/session";

const ROLE_WORD: Record<StaffRole, string> = {
  coordinator: "waiting",
  nurse: "waiting",
  clinician: "waiting",
  ops: "waiting",
};

function PatientEntry() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [missing, setMissing] = useState(false);
  const router = useRouter();
  const go = async () => {
    const want = code.trim().toLowerCase();
    const rows = await fetchReferrals().catch(() => []);
    const hit = rows.find((r) => r.mrn === want || r.id === want);
    if (hit) router.push(`/p/${hit.id}`);
    else setMissing(true);
  };
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-[8px] border border-dashed border-rule px-4 py-3 text-left text-[14px] text-ink-soft hover:bg-canvas"
      >
        I&apos;m a patient
      </button>
    );
  }
  return (
    <form
      className="mt-3 rounded-[8px] border border-rule bg-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void go();
      }}
    >
      <label className="block text-[14px] font-bold" htmlFor="visit-code">
        Your visit code
      </label>
      <p className="text-[13px] text-ink-soft">It is in the text message with your plan.</p>
      <div className="mt-2 flex gap-2">
        <input
          id="visit-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setMissing(false);
          }}
          inputMode="numeric"
          className="h-10 min-w-0 flex-1 rounded-[6px] border border-rule px-3 text-[15px] tabular-nums"
        />
        <button
          type="submit"
          className="h-10 rounded-[6px] bg-agent px-4 text-[14px] font-bold text-white"
        >
          Open my visit
        </button>
      </div>
      <button
        type="button"
        onClick={() => setCode("000001")}
        className="mt-2 text-[13px] text-agent underline"
      >
        Use an example code
      </button>
      {missing && <p className="mt-2 text-[13px] text-urgent">We could not find that code.</p>}
    </form>
  );
}

/**
 * The front door (section 4.1): the hospital as it is right now on the left, and who you are
 * on the right. Staff sign in by picking themselves; patients use their visit code.
 */
export default function SignIn() {
  const { signIn } = useUser();
  const router = useRouter();
  const { data } = useLive(fetchHospital);
  const counts = Object.fromEntries((data?.stages ?? []).map((s) => [s.stage, s.count]));
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto grid max-w-[1320px] gap-10 px-6 py-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:py-16">
        <section
          aria-label="The hospital right now"
          className="min-w-0 rounded-[8px] border border-rule bg-panel p-6"
        >
          <div className="flex items-baseline justify-between">
            <h2 className="font-figure text-[20px] font-semibold">Referrals in progress</h2>
            <span className="font-figure text-[14px] text-ink-soft tabular-nums">
              {data?.now ? `Tue, Nov 17, ${hhmm(data.now)}` : ""}
            </span>
          </div>
          <div className="mt-6 overflow-x-auto">
            <div className="min-w-[560px]">
              <StageRail counts={counts} size="hospital" />
            </div>
          </div>
          <h3 className="mt-8 text-[13px] font-bold text-ink-soft">What the agents just did</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {(data?.feed ?? []).slice(0, 6).map((f) => (
              <li key={f.run_id} className="row-in flex items-center gap-3 py-2.5 text-[14px]">
                <span className="w-16 shrink-0 font-figure text-ink-soft tabular-nums">
                  {hhmm(f.at)}
                </span>
                <AgentGlyph name={f.agent} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-bold">{agentProfile(f.agent)?.label}</span> {f.summary}
                  {f.patient ? `, ${f.patient}` : ""}
                </span>
              </li>
            ))}
            {!data && (
              <li className="py-2.5 text-[14px] text-ink-soft">Connecting to the hospital.</li>
            )}
          </ul>
          {data && (
            <p className="mt-5 text-[15px]">
              {data.in_building} people in the building today, {data.referrals_in_progress}{" "}
              referrals in progress, {data.waiting_on_staff} waiting on staff.
            </p>
          )}
        </section>

        <section aria-label="Sign in" className="min-w-0">
          <p className="flex items-center gap-2">
            <span aria-hidden className="block h-[6px] w-7 bg-agent" />
            <span className="font-display text-[30px] font-bold">Throughline</span>
          </p>
          <p className="mt-1 text-[15px] text-ink-soft">Halden Medical Center</p>
          <h1 className="mt-6 max-w-[30ch] text-[22px] leading-snug">
            Referrals, visit days and follow-up, run by 13 agents and approved by your staff.
          </h1>
          <h2 className="mt-8 text-[13px] font-bold text-ink-soft">Sign in as</h2>
          <ul className="mt-2 space-y-2">
            {STAFF.map((s) => {
              const waiting = data?.waiting_by_role[s.role];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      signIn(s.id);
                      router.push(s.home);
                    }}
                    className="flex w-full items-center gap-3 rounded-[8px] border border-rule bg-panel px-4 py-3 text-left hover:border-agent"
                  >
                    <Avatar initials={s.initials} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{s.name}</span>
                      <span className="block text-[13px] text-ink-soft">{s.title}</span>
                    </span>
                    {waiting !== undefined && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[13px] tabular-nums ${
                          waiting > 0 ? "bg-staff-bg text-staff" : "text-ink-soft"
                        }`}
                      >
                        {waiting} {ROLE_WORD[s.role]}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <PatientEntry />
        </section>
      </div>

      <section className="border-t border-rule bg-panel">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-6 py-10 md:grid-cols-3">
          <div>
            <h2 className="font-figure text-[18px] font-semibold">Agents do the routine work</h2>
            <p className="mt-2 text-[14px] text-ink-soft">
              Reading faxes, checking coverage, drafting prior auths, booking every test in the
              right order, guiding patients through the building, and closing the loop with the
              referring doctor.
            </p>
          </div>
          <div>
            <h2 className="font-figure text-[18px] font-semibold">People approve what matters</h2>
            <p className="mt-2 text-[14px] text-ink-soft">
              Nothing goes to a payer, changes the floor, or reaches a patient as a summary without
              a person. Every decision shows the agent&apos;s draft beside its source.
            </p>
          </div>
          <div>
            <h2 className="font-figure text-[18px] font-semibold">Patients get one plan</h2>
            <p className="mt-2 text-[14px] text-ink-soft">
              One page with the next step, how long the wait is, and the way there. Medical
              questions always go to a nurse.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
