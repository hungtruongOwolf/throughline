"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { agentProfile, STAFF } from "@throughline/shared";
import { Hospital3D } from "../components/Hospital3DLazy";
import { HospitalPicker, HospitalSwitcher } from "../components/hospital-switcher";
import { AgentGlyph, hhmm, shortDate, StageRail } from "../components/ui";
import { fetchHospital, fetchReferrals } from "../lib/platform";
import { useHospital, useLive, useUser } from "../lib/session";
import { useFloor } from "../lib/site";

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="sign-arrow h-6 w-6 shrink-0" fill="none">
      <path
        d="M4 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="square"
      />
    </svg>
  );
}

/** A wayfinding sign blade: the hospital's own way of saying "this way". */
function Blade({
  onClick,
  href,
  tone = "ink",
  children,
}: {
  onClick?: () => void;
  href?: string;
  tone?: "ink" | "agent";
  children: ReactNode;
}) {
  const cls = `sign-blade flex w-full items-center gap-4 rounded-[4px] px-5 py-4 text-left text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_20px_-10px_rgba(24,34,58,0.6)] ${
    tone === "agent" ? "bg-agent hover:bg-[#0c645d]" : "bg-ink hover:bg-[#222e4a]"
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

function VisitCode() {
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
  return (
    <form
      className="rounded-[4px] border border-rule bg-panel p-4"
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
          className="h-10 min-w-0 flex-1 rounded-[4px] border border-rule px-3 text-[15px] tabular-nums"
        />
        <button
          type="submit"
          className="h-10 rounded-[4px] bg-agent px-4 text-[14px] font-bold text-white"
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
 * The front door (section 4.1): the hospital as it is right now, in 3D, and the way in for
 * each person. Staff sign in by picking themselves; patients book a visit or open theirs.
 */
export default function FrontDoor() {
  const { signIn } = useUser();
  const hospital = useHospital();
  const router = useRouter();
  const { data } = useLive(fetchHospital);
  const floor = useFloor();
  const inBuilding = hospital.forecasts
    ? data?.in_building
    : floor.reduce((n, s) => n + s.count, 0);
  const [patient, setPatient] = useState<"closed" | "open" | "code">("closed");
  const counts = Object.fromEntries((data?.stages ?? []).map((s) => [s.stage, s.count]));
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex max-w-[1360px] items-center gap-3 px-6 pt-6">
        <span aria-hidden className="block h-[6px] w-7 bg-agent" />
        <span className="font-display text-[28px] font-bold">Throughline</span>
        <span className="hidden sm:block">
          <HospitalSwitcher />
        </span>
        <span className="ml-auto font-figure text-[15px] text-ink-soft tabular-nums">
          {data?.now ? `${shortDate(data.now)}, ${hhmm(data.now)}` : ""}
        </span>
      </header>

      <div className="mx-auto grid max-w-[1360px] gap-8 px-6 py-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <section aria-label="The hospital right now" className="min-w-0">
          <h1 className="max-w-[24ch] font-display text-[44px] leading-[1.02] font-bold sm:text-[56px]">
            Every referral, from the fax to the follow-up.
          </h1>
          <p className="mt-3 max-w-[60ch] text-[17px] text-ink-soft">
            Thirteen agents do the routine work for every patient in flight. Your staff approve what
            matters. This is {hospital.short_name} right now:{" "}
            {data
              ? `${inBuilding ?? 0} people in the building, ${data.referrals_in_progress} referrals in progress, ${data.waiting_on_staff} decisions waiting on staff.`
              : "connecting."}
          </p>
          <HospitalPicker />
          <div className="mt-2 -mb-4">
            <Hospital3D height={500} />
          </div>
          <div className="overflow-x-auto rounded-[4px] border border-rule bg-panel px-4 pt-4 pb-2 shadow-[0_10px_30px_-20px_rgba(24,34,58,0.5)]">
            <div className="min-w-[560px]">
              <StageRail counts={counts} size="hospital" />
            </div>
          </div>
        </section>

        <section aria-label="Sign in" className="min-w-0 lg:pt-4">
          <h2 className="font-figure text-[20px] font-semibold">Staff, this way</h2>
          <ul className="mt-3 space-y-2.5">
            {STAFF.map((s) => {
              const waiting = data?.waiting_by_role[s.role];
              return (
                <li key={s.id}>
                  <Blade
                    onClick={() => {
                      signIn(s.id);
                      router.push(s.home);
                    }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-figure text-[22px] leading-tight font-semibold">
                        {s.name}
                      </span>
                      <span className="block text-[13px] text-white/75">{s.title}</span>
                    </span>
                    {waiting !== undefined && waiting > 0 && (
                      <span className="rounded-[3px] bg-staff-bg px-2 py-0.5 text-[13px] font-bold text-staff tabular-nums">
                        {waiting} waiting
                      </span>
                    )}
                    <Arrow />
                  </Blade>
                </li>
              );
            })}
          </ul>

          <h2 className="mt-8 font-figure text-[20px] font-semibold">Patients, this way</h2>
          <div className="mt-3 space-y-2.5">
            {patient === "closed" ? (
              <Blade tone="agent" onClick={() => setPatient("open")}>
                <span className="min-w-0 flex-1">
                  <span className="block font-figure text-[22px] leading-tight font-semibold">
                    I&apos;m a patient
                  </span>
                  <span className="block text-[13px] text-white">
                    Book a visit, or see the plan for yours
                  </span>
                </span>
                <Arrow />
              </Blade>
            ) : (
              <>
                <Blade tone="agent" href="/visit">
                  <span className="min-w-0 flex-1">
                    <span className="block font-figure text-[22px] leading-tight font-semibold">
                      Book a visit
                    </span>
                    <span className="block text-[13px] text-white">
                      Six short steps, about 3 minutes
                    </span>
                  </span>
                  <Arrow />
                </Blade>
                {patient === "code" ? (
                  <VisitCode />
                ) : (
                  <Blade tone="agent" onClick={() => setPatient("code")}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-figure text-[22px] leading-tight font-semibold">
                        I have a visit code
                      </span>
                      <span className="block text-[13px] text-white">
                        See your times, where to go, and what to bring
                      </span>
                    </span>
                    <Arrow />
                  </Blade>
                )}
              </>
            )}
          </div>

          <h2 className="mt-8 text-[13px] font-bold text-ink-soft">What the agents just did</h2>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {(data?.feed ?? [])
              .filter((f) => f.outcome !== "parked")
              .slice(0, 5)
              .map((f) => (
                <li key={f.run_id} className="flex items-center gap-3 py-2 text-[13px]">
                  <span className="w-14 shrink-0 font-figure text-ink-soft tabular-nums">
                    {hhmm(f.at)}
                  </span>
                  <AgentGlyph name={f.agent} size={20} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-bold">{agentProfile(f.agent)?.label}</span> {f.summary}
                    {f.patient ? `, ${f.patient}` : ""}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
