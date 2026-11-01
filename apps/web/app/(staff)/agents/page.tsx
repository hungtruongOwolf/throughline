"use client";

import Link from "next/link";
import { useState } from "react";
import type { AgentStats } from "@throughline/shared";
import { AgentGlyph, Drawer, ModelChip, Skeleton, when } from "../../../components/ui";
import { fetchAgentRuns, fetchAgents, fetchHospital } from "../../../lib/platform";
import { useLive } from "../../../lib/session";

const GROUPS = ["Before the visit", "Visit day", "After the visit"] as const;

function pct(n: number, of: number): string {
  if (of === 0) return "n/a";
  return `${Math.round((n / of) * 100)}%`;
}

function AgentDrawer({
  agent,
  onClose,
  now,
}: {
  agent: AgentStats;
  onClose: () => void;
  now: string;
}) {
  const { data: runs } = useLive(() => fetchAgentRuns(agent.name), [agent.name]);
  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <AgentGlyph name={agent.name} size={26} /> {agent.label}
        </span>
      }
      width={620}
    >
      <div className="space-y-6 p-5 text-[14px]">
        <section>
          <p>{agent.job}</p>
          <p className="mt-2 text-[13px] text-ink-soft">Runs on {agent.runs_on}.</p>
        </section>
        <section>
          <h3 className="text-[12px] font-bold text-ink-soft">Guardrails</h3>
          <ul className="mt-2 space-y-1.5">
            {agent.guardrails.map((g) => (
              <li key={g} className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-1 inline-block h-3 w-3 shrink-0 rounded-[3px] border-2 border-staff"
                />
                {g}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-[12px] font-bold text-ink-soft">Recent runs</h3>
          {!runs ? (
            <Skeleton rows={5} />
          ) : (
            <ul className="mt-2 divide-y divide-rule border-y border-rule">
              {runs.slice(0, 25).map((r) => (
                <li key={r.id} className="py-2.5">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0">
                      {r.summary}
                      {r.patient && (
                        <>
                          {", "}
                          <Link href={`/patients/${r.journey_id}`} className="text-agent underline">
                            {r.patient}
                          </Link>
                        </>
                      )}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">
                      {when(r.at, now)}
                    </span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
                    {r.outcome === "parked"
                      ? "Waited for staff"
                      : r.outcome === "handoff"
                        ? "Handed to a nurse"
                        : r.used_template
                          ? "Used an approved template"
                          : "Done on its own"}
                    {r.model_calls[0] && r.model_calls[0].model !== "fallback" && (
                      <ModelChip model={r.model_calls[0].model} ms={r.model_calls[0].latency_ms} />
                    )}
                    {r.approved_by && <span>approved by {r.approved_by}</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Drawer>
  );
}

/** The roster (section 4.7): what each agent does, how much, how well, and its guardrails. */
export default function AgentsPage() {
  const { data: agents } = useLive(fetchAgents);
  const { data: hospital } = useLive(fetchHospital);
  const [open, setOpen] = useState<string | undefined>();
  const now = hospital?.now ?? "";
  const total = (agents ?? []).reduce((n, a) => n + a.runs, 0);
  const alone = (agents ?? []).reduce((n, a) => n + a.finished_alone, 0);
  const waited = (agents ?? []).reduce((n, a) => n + a.waited_for_staff, 0);
  const nurse = (agents ?? []).reduce((n, a) => n + a.handed_to_nurse, 0);
  const chosen = agents?.find((a) => a.name === open);
  return (
    <div className="p-6">
      <h1 className="font-figure text-[22px] font-semibold">Agents</h1>
      {agents && (
        <p className="mt-1 max-w-[80ch] text-[15px]">
          {total.toLocaleString()} steps so far for {hospital?.referrals_in_progress ?? "the"}{" "}
          referrals in progress: {alone.toLocaleString()} finished on their own, {waited} waited for
          a person to approve, and {nurse} {nurse === 1 ? "was" : "were"} handed to a nurse.
        </p>
      )}
      <div className="mt-5 overflow-x-auto elevated rounded-[6px] border border-rule bg-panel">
        <table className="w-full min-w-[1040px] text-left text-[13px]">
          <thead className="border-b border-rule text-[12px] text-ink-soft">
            <tr>
              <th className="px-4 py-2 font-bold">Agent</th>
              <th className="px-3 py-2 font-bold">Runs on</th>
              <th className="px-3 py-2 text-right font-bold">Runs</th>
              <th className="px-3 py-2 text-right font-bold">Finished on its own</th>
              <th className="px-3 py-2 text-right font-bold">Waited for staff</th>
              <th className="px-3 py-2 text-right font-bold">Handed to nurse</th>
              <th className="px-3 py-2 text-right font-bold">Staff changed it</th>
              <th className="px-3 py-2 text-right font-bold">Approved template</th>
              <th className="px-3 py-2 font-bold">Now</th>
            </tr>
          </thead>
          {GROUPS.map((g) => (
            <tbody key={g} className="divide-y divide-rule border-b border-rule">
              <tr>
                <th
                  colSpan={9}
                  className="bg-canvas px-4 py-1.5 text-[12px] font-bold text-ink-soft"
                >
                  {g}
                </th>
              </tr>
              {(agents ?? [])
                .filter((a) => a.group === g)
                .map((a) => (
                  <tr
                    key={a.name}
                    tabIndex={0}
                    onClick={() => setOpen(a.name)}
                    onKeyDown={(e) => e.key === "Enter" && setOpen(a.name)}
                    className="h-11 cursor-pointer hover:bg-agent-tint/60"
                  >
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2 font-bold">
                        <AgentGlyph name={a.name} />
                        {a.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{a.runs_on}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.runs.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {pct(a.finished_alone, a.runs)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.waited_for_staff || "–"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.handed_to_nurse || "–"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.staff_changed === null ? "n/a" : pct(a.staff_changed, a.staff_decided)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.uses_model ? pct(a.used_template, a.runs) : "n/a"}
                    </td>
                    <td className="px-3 py-2">
                      {a.waiting_now > 0 ? (
                        <span className="font-bold text-staff">
                          {a.waiting_now} waiting on staff
                        </span>
                      ) : (
                        <span className="text-ink-soft">Idle</span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
        {!agents && (
          <div className="p-4">
            <Skeleton rows={8} />
          </div>
        )}
      </div>
      {chosen && <AgentDrawer agent={chosen} onClose={() => setOpen(undefined)} now={now} />}
    </div>
  );
}
