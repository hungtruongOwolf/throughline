"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { STAGES, type JourneyRow, type Stage } from "@throughline/shared";
import {
  age,
  AgentName,
  Avatar,
  ROLE_PERSON,
  Skeleton,
  StageRail,
  shortDate,
} from "../../../components/ui";
import { fetchHospital, fetchReferrals } from "../../../lib/platform";
import { useLive, useUser } from "../../../lib/session";

type Tab = "needs" | "mine" | "open" | "all";

function WaitingOn({ row }: { row: JourneyRow }) {
  const w = row.waiting_on;
  if (w.kind === "agent") return <AgentName name={w.who} />;
  if (w.kind === "staff") {
    const person = ROLE_PERSON[w.who as keyof typeof ROLE_PERSON];
    return (
      <span className="inline-flex items-center gap-1.5 font-bold text-staff">
        <Avatar initials={person?.initials ?? "?"} size={18} />
        {person?.name.split(",")[0] ?? "Staff"}
      </span>
    );
  }
  if (w.kind === "patient") return <span className="text-ink-soft">Patient</span>;
  if (w.kind === "payer") return <span className="text-ink-soft">Payer</span>;
  return <span className="text-ink-soft">No one</span>;
}

/** Every referral in one table, filtered by the stage rail (section 4.4). */
export default function ReferralsPage() {
  const { data: rows } = useLive(fetchReferrals);
  const { data: hospital } = useLive(fetchHospital);
  const { user } = useUser();
  const router = useRouter();
  const [stage, setStage] = useState<Stage | undefined>();
  const [tab, setTab] = useState<Tab>("open");
  const now = hospital?.now ?? "";
  const counts = useMemo(() => {
    const c: Partial<Record<Stage, number>> = {};
    for (const s of STAGES) c[s] = (rows ?? []).filter((r) => r.stage === s).length;
    return c;
  }, [rows]);
  const shown = (rows ?? []).filter((r) => {
    if (stage && r.stage !== stage) return false;
    if (tab === "needs") return r.waiting_on.kind === "staff";
    if (tab === "mine") return r.waiting_on.kind === "staff" && r.waiting_on.who === user?.role;
    if (tab === "open") return r.stage !== "Closed";
    return true;
  });
  return (
    <div className="p-6">
      <h1 className="font-figure text-[22px] font-semibold">Referrals</h1>
      <div className="mt-5 elevated rounded-[6px] border border-rule bg-panel px-4 pt-4 pb-2">
        <StageRail counts={counts} size="hospital" onPick={setStage} picked={stage} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1" role="tablist">
        {(
          [
            ["needs", "Needs staff"],
            ["mine", "Mine"],
            ["open", "In progress"],
            ["all", "All, including closed"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-[4px] px-2.5 py-1 text-[13px] ${
              tab === k ? "bg-ink font-bold text-white" : "text-ink-soft hover:bg-panel"
            }`}
          >
            {label}
          </button>
        ))}
        {stage && (
          <button
            type="button"
            onClick={() => setStage(undefined)}
            className="ml-2 text-[13px] text-agent underline"
          >
            Clear {stage}
          </button>
        )}
      </div>
      <div className="mt-3 overflow-x-auto elevated rounded-[6px] border border-rule bg-panel">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="border-b border-rule text-[12px] text-ink-soft">
            <tr>
              <th className="px-4 py-2 font-bold">Patient</th>
              <th className="px-3 py-2 font-bold">Referred by</th>
              <th className="px-3 py-2 font-bold">Stage</th>
              <th className="px-3 py-2 font-bold">Waiting on</th>
              <th className="px-3 py-2 font-bold">Next step</th>
              <th className="px-3 py-2 font-bold">Received</th>
              <th className="px-3 py-2 font-bold">Flags</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {shown.map((r) => (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => router.push(`/patients/${r.id}`)}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/patients/${r.id}`)}
                className="h-10 cursor-pointer hover:bg-agent-tint/60"
              >
                <td className="px-4 py-2">
                  <span className="font-bold">{r.patient}</span>{" "}
                  <span className="text-ink-soft tabular-nums">{r.mrn}</span>
                </td>
                <td className="px-3 py-2 text-ink-soft">{r.referring_provider}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <StageRail
                      size="row"
                      current={r.stage}
                      waiting={r.waiting_on.kind === "staff"}
                    />
                    <span>{r.stage}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <WaitingOn row={r} />
                </td>
                <td className="px-3 py-2">{r.next_step}</td>
                <td className="px-3 py-2 whitespace-nowrap text-ink-soft tabular-nums">
                  {shortDate(r.received_at)}
                  <span className="block text-[12px]">{age(r.received_at, now)} ago</span>
                </td>
                <td className="px-3 py-2 text-ink-soft">{r.flags.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows && (
          <div className="p-4">
            <Skeleton rows={8} />
          </div>
        )}
        {rows && shown.length === 0 && (
          <p className="p-6 text-[14px] text-ink-soft">
            No referrals here right now.{" "}
            <button
              type="button"
              onClick={() => {
                setStage(undefined);
                setTab("all");
              }}
              className="text-agent underline"
            >
              Show all
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
