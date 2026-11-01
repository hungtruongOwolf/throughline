"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  AGENT_CATALOG,
  stageOf,
  type DomainEvent,
  type Journey,
  type RunView,
  type TimelineEntry,
} from "@throughline/shared";
import { markStep } from "../../../../components/shell";
import {
  AgentGlyph,
  Avatar,
  hhmm,
  ModelChip,
  PrimaryButton,
  ROLE_PERSON,
  shortDate,
  Skeleton,
  StageRail,
  useToast,
  when,
} from "../../../../components/ui";
import {
  documentUrl,
  fetchHospital,
  fetchInbox,
  fetchRun,
  fetchTimeline,
  sendReply,
} from "../../../../lib/platform";
import { fetchJourney } from "../../../../lib/runtime";
import { useLive, useHospital } from "../../../../lib/session";

const OUTCOME: Record<RunView["outcome"], string> = {
  applied: "Done on its own",
  parked: "Sent to staff for approval",
  handoff: "Handed to a nurse",
  blocked: "Message screened; approved template sent",
};

function yearsOld(dob: string, now: string): number {
  return Math.floor((Date.parse(now || "2026-11-17") - Date.parse(dob)) / (365.25 * 86_400_000));
}

// ---- run detail ---------------------------------------------------------------------------

function Fields({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object")) return <span>{value.join(", ")}</span>;
    return (
      <ul className="space-y-1">
        {value.slice(0, 8).map((v, i) => (
          <li key={i} className="rounded-[4px] bg-canvas px-2 py-1">
            <Fields value={v} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5">
      {Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !["id", "synthetic", "approved_by"].includes(k))
        .slice(0, 14)
        .map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-soft">{k.replaceAll("_", " ")}</dt>
            <dd className="min-w-0 break-words">
              <Fields value={v} />
            </dd>
          </div>
        ))}
    </dl>
  );
}

function RunDetail({ runId, journey }: { runId: string; journey: Journey | undefined }) {
  const { data: run } = useLive(() => fetchRun(runId), [runId]);
  if (!run) return <Skeleton rows={2} />;
  const isIntake = run.agent === "referral_intake";
  const extracted = run.emitted_events.find((e) => e.type === "IntakeExtracted") as
    Extract<DomainEvent, { type: "IntakeExtracted" }> | undefined;
  const call = run.model_calls[0];
  return (
    <div className="mt-2 rounded-[6px] border border-rule bg-canvas p-3 text-[13px]">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        <dt className="text-ink-soft">Started by</dt>
        <dd>{run.trigger.type.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()}</dd>
        <dt className="text-ink-soft">Outcome</dt>
        <dd>
          {run.used_template && run.outcome === "applied"
            ? "Used an approved template"
            : OUTCOME[run.outcome]}
        </dd>
        {call && call.model !== "fallback" && (
          <>
            <dt className="text-ink-soft">Model</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <ModelChip model={call.model} ms={call.latency_ms} />
              {call.required_tool && (
                <span className="text-ink-soft">called {call.required_tool}</span>
              )}
              {call.tokens_in !== undefined && (
                <span className="text-ink-soft tabular-nums">
                  {call.tokens_in} tokens in, {call.tokens_out ?? 0} out
                </span>
              )}
            </dd>
          </>
        )}
        {run.approved_by && (
          <>
            <dt className="text-ink-soft">Approved by</dt>
            <dd>{run.approved_by}</dd>
          </>
        )}
      </dl>
      {isIntake && extracted && journey ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <img
            src={documentUrl(journey.referral.documents[0]?.uri ?? "")}
            alt="The faxed referral"
            className="w-full rounded-[4px] border border-rule"
          />
          <div>
            <p className="font-bold">What intake read</p>
            <div className="mt-1">
              <Fields value={extracted.payload.packet} />
            </div>
          </div>
        </div>
      ) : (
        run.emitted_events
          .filter((e) => !["HumanReviewRequested"].includes(e.type))
          .slice(0, 2)
          .map((e) => (
            <div key={e.id} className="mt-3">
              <p className="font-bold">{e.type.replace(/([a-z])([A-Z])/g, "$1 $2")}</p>
              <div className="mt-1">
                <Fields value={e.payload} />
              </div>
            </div>
          ))
      )}
    </div>
  );
}

// ---- timeline -----------------------------------------------------------------------------

function Entry({
  e,
  now,
  journey,
}: {
  e: TimelineEntry;
  now: string;
  journey: Journey | undefined;
}) {
  const [open, setOpen] = useState(false);
  const time = e.at ? when(e.at, now) : "";
  if (e.kind === "agent") {
    return (
      <li className="row-in flex gap-3 py-3">
        <span className="w-24 shrink-0 pt-0.5 text-right text-[12px] text-ink-soft tabular-nums">
          {time}
        </span>
        <AgentGlyph name={e.run.agent} />
        <div className="min-w-0 flex-1 text-[14px]">
          <p>
            <span className="font-bold">{e.run.label}</span> {e.run.summary}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
            {e.run.used_template && e.run.outcome !== "parked" ? (
              <span>Used an approved template</span>
            ) : (
              <ModelChip model={e.run.model} ms={e.run.latency_ms} />
            )}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="text-agent underline"
            >
              {open ? "Hide run" : "Show run"}
            </button>
          </p>
          {open && <RunDetail runId={e.run.run_id} journey={journey} />}
        </div>
      </li>
    );
  }
  if (e.kind === "waiting") {
    const person = ROLE_PERSON[e.role];
    return (
      <li className="flex gap-3 py-3">
        <span className="w-24 shrink-0 pt-0.5 text-right text-[12px] font-bold text-staff">
          Now
        </span>
        <Avatar initials={person.initials} size={22} />
        <p className="flex-1 text-[14px] font-bold text-staff">
          Waiting on {person.name.split(",")[0]}: {e.text.toLowerCase()}{" "}
          <Link href={`/inbox?item=${e.item_id}`} className="font-normal text-agent underline">
            Review
          </Link>
        </p>
      </li>
    );
  }
  const who = e.kind === "staff" ? e.who : e.kind === "patient" ? "Patient" : e.who;
  return (
    <li className="row-in flex gap-3 py-3">
      <span className="w-24 shrink-0 pt-0.5 text-right text-[12px] text-ink-soft tabular-nums">
        {time}
      </span>
      {e.kind === "staff" ? (
        <Avatar
          initials={who
            .replace("Dr. ", "D ")
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
          size={22}
        />
      ) : (
        <span
          aria-hidden
          className="h-[22px] w-[22px] shrink-0 rounded-full border-2 border-ink/40"
        />
      )}
      <p className="flex-1 text-[14px]">
        <span className="font-bold">{who}</span>{" "}
        {e.kind === "patient" ? <span>“{e.text}”</span> : e.text}
        {e.kind === "staff" && e.note && (
          <span className="block text-ink-soft">Note: {e.note}</span>
        )}
      </p>
    </li>
  );
}

// ---- tabs ---------------------------------------------------------------------------------

const EXAMPLES = [
  "Can my son come with me?",
  "I need to move my appointment",
  "I've had a fever since last night",
];

function Messages({ journey, onSent }: { journey: Journey; onSent: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const send = async () => {
    setBusy(true);
    try {
      await sendReply(journey.id, text.trim());
      setText("");
      toast("Reply logged. Patient messaging is reading it.");
      onSent();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <ul className="space-y-2">
        {journey.outreach_log.map((m) => (
          <li
            key={m.id}
            className={`max-w-[75%] rounded-[8px] px-3 py-2 text-[14px] ${
              m.direction === "in" ? "bg-canvas" : "ml-auto bg-agent-tint"
            }`}
          >
            <span className="block text-[11px] text-ink-soft">
              {m.direction === "in" ? journey.patient.display_name : "Throughline"},{" "}
              {shortDate(m.at)} {hhmm(m.at)}
              {m.channel === "voice_sim" ? ", voice note" : ""}
            </span>
            {m.text}
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-[6px] border border-rule p-3">
        <label htmlFor="log-reply" className="text-[13px] font-bold">
          Log a patient reply
        </label>
        <textarea
          id="log-reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-[6px] border border-rule p-2 text-[14px]"
        />
        <div className="mt-1 flex flex-wrap gap-2">
          {EXAMPLES.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setText(x)}
              className="rounded-full border border-rule px-2.5 py-0.5 text-[12px] text-ink-soft hover:bg-canvas"
            >
              {x}
            </button>
          ))}
        </div>
        <div className="mt-2">
          <PrimaryButton onClick={() => void send()} disabled={busy || !text.trim()}>
            Log reply
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function Plan({ journey }: { journey: Journey }) {
  const hospital = useHospital();
  const appts = [...journey.appointments]
    .filter((a) => a.status === "booked")
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="space-y-6 text-[14px]">
      <section>
        <h3 className="font-bold">Appointments</h3>
        {appts.length === 0 ? (
          <p className="text-ink-soft">Not booked yet.</p>
        ) : (
          <table className="mt-1 w-full max-w-[640px] text-[13px]">
            <tbody className="divide-y divide-rule">
              {appts.map((a) => (
                <tr key={a.id}>
                  <td className="py-1.5 pr-3 tabular-nums">
                    {shortDate(a.start)}, {hhmm(a.start)}
                  </td>
                  <td className="py-1.5">
                    {journey.orders.find((o) => o.id === a.order_id)?.code_as_written ?? a.order_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <h3 className="font-bold">Prior authorization</h3>
        {journey.auth_packets.length === 0 ? (
          <p className="text-ink-soft">None needed yet.</p>
        ) : (
          journey.auth_packets.map((p) => (
            <p key={p.id}>
              {hospital.payers[0]}: <span className="font-bold">{p.status}</span>
              {p.submitted_by ? `, submitted by ${p.submitted_by}` : ""}
            </p>
          ))
        )}
      </section>
      <section>
        <h3 className="font-bold">What we know about the visit</h3>
        <p className="text-ink-soft">
          {Object.entries(journey.memory)
            .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
            .join("; ") || "Nothing yet."}
        </p>
      </section>
    </div>
  );
}

function Documents({ journey }: { journey: Journey }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {journey.referral.documents.map((d) => (
        <figure key={d.id}>
          <img
            src={documentUrl(d.uri)}
            alt={d.kind.replace("_", " ")}
            className="w-full rounded-[4px] border border-rule"
          />
          <figcaption className="mt-1 text-[13px] text-ink-soft">
            {d.kind === "referral_fax" ? "Faxed referral" : "Insurance card"}
          </figcaption>
        </figure>
      ))}
      {journey.summary?.sent_at && (
        <section className="md:col-span-2">
          <h3 className="font-bold">Visit summary, sent {shortDate(journey.summary.sent_at)}</h3>
          {journey.summary.draft.map((s) => (
            <p key={s.heading} className="mt-1 text-[14px]">
              <span className="font-bold">{s.heading}.</span> {s.plain}
            </p>
          ))}
        </section>
      )}
    </div>
  );
}

// ---- page ---------------------------------------------------------------------------------

export default function PatientRecord({ params }: { params: Promise<{ id: string }> }) {
  const tenant = useHospital();
  const { id } = use(params);
  const { data: journey, reload: reloadJourney } = useLive(() => fetchJourney(id), [id]);
  const { data: timeline } = useLive(() => fetchTimeline(id), [id]);
  const { data: hospital } = useLive(fetchHospital);
  const { data: items } = useLive(() => fetchInbox(), []);
  const [tab, setTab] = useState<"activity" | "messages" | "plan" | "documents">("activity");
  const now = hospital?.now ?? "";
  const pending = (items ?? []).find((i) => i.journey_id === id);
  const ran = new Set((timeline ?? []).flatMap((e) => (e.kind === "agent" ? [e.run.agent] : [])));
  const waitingAgents = new Set(
    (items ?? []).filter((i) => i.journey_id === id).map((i) => i.agent),
  );

  if (!journey) {
    return (
      <div className="p-6">
        <Skeleton rows={3} height={28} />
      </div>
    );
  }
  const stage = stageOf(journey);
  return (
    <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 border-r border-rule bg-panel">
        <header className="border-b border-rule px-6 pt-5 pb-4">
          <h1 className="font-figure text-[26px] font-semibold">{journey.patient.display_name}</h1>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {yearsOld(journey.patient.dob, now)} years, MRN{" "}
            {journey.patient.id.replace(/\D/g, "").padStart(6, "0")},{" "}
            {journey.patient.language === "es" ? "Spanish" : "English"},{" "}
            {journey.patient.mobility === "wheelchair" ? "uses a wheelchair" : "walks"},{" "}
            {tenant.payers[0]}. Referred by {journey.referral.referring_provider}.
          </p>
          <div className="mt-5 max-w-[760px]">
            <StageRail current={stage} waiting={!!pending} />
          </div>
          {pending && (
            <p className="mt-4 flex items-center justify-between gap-3 rounded-[6px] border-l-4 border-staff bg-staff-bg px-4 py-2.5 text-[14px]">
              <span>
                <span className="font-bold">
                  Waiting on {ROLE_PERSON[pending.role].name.split(",")[0]}
                </span>
                : {pending.title.toLowerCase()}
              </span>
              <Link href={`/inbox?item=${pending.id}`} className="font-bold text-staff underline">
                Review
              </Link>
            </p>
          )}
        </header>
        <div className="flex gap-1 border-b border-rule px-6" role="tablist">
          {(
            [
              ["activity", "Activity"],
              ["messages", "Messages"],
              ["plan", "Plan"],
              ["documents", "Documents"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[14px] ${
                tab === k
                  ? "border-agent font-bold"
                  : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="px-6 py-4">
          {tab === "activity" &&
            (timeline ? (
              <ol className="divide-y divide-rule">
                {timeline.map((e, i) => (
                  <Entry key={`${e.kind}-${i}`} e={e} now={now} journey={journey} />
                ))}
              </ol>
            ) : (
              <Skeleton rows={6} />
            ))}
          {tab === "messages" && <Messages journey={journey} onSent={reloadJourney} />}
          {tab === "plan" && <Plan journey={journey} />}
          {tab === "documents" && <Documents journey={journey} />}
        </div>
      </div>
      <aside className="space-y-6 p-5">
        <section>
          <h2 className="text-[12px] font-bold text-ink-soft">For the patient</h2>
          <Link
            href={`/p/${journey.id}`}
            onClick={() => markStep("patient")}
            className="mt-2 inline-block rounded-[6px] border border-rule bg-panel px-3 py-2 text-[14px] font-bold hover:bg-canvas"
          >
            Open patient app
          </Link>
        </section>
        <section>
          <h2 className="text-[12px] font-bold text-ink-soft">Agents on this patient</h2>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {AGENT_CATALOG.filter((a) => a.name !== "sensing").map((a) => {
              const status = waitingAgents.has(a.name)
                ? "waiting on staff"
                : ran.has(a.name)
                  ? "done"
                  : "later";
              return (
                <li key={a.name} className="flex items-center gap-2">
                  <AgentGlyph name={a.name} size={18} />
                  <span className="flex-1">{a.label}</span>
                  <span
                    className={
                      status === "waiting on staff"
                        ? "font-bold text-staff"
                        : status === "done"
                          ? "text-ink"
                          : "text-ink-soft"
                    }
                  >
                    {status}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </div>
  );
}
