"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  agentProfile,
  type InboxItem,
  type Journey,
  type OpsAction,
  type StaffRole,
} from "@throughline/shared";
import { Proposal } from "../../../components/Proposal";
import { markStep } from "../../../components/shell";
import {
  age,
  AgentGlyph,
  ModelChip,
  PrimaryButton,
  QuietButton,
  ROLE_PERSON,
  Skeleton,
  useToast,
  when,
} from "../../../components/ui";
import {
  answerQuestion,
  documentUrl,
  fetchHospital,
  fetchInbox,
  fetchTimeline,
  resolveItem,
} from "../../../lib/platform";
import { fetchJourney, RUNTIME_URL } from "../../../lib/runtime";
import { useLive, useUser } from "../../../lib/session";

const BAR: Record<InboxItem["kind"], string> = {
  handoff: "bg-urgent",
  approval: "bg-staff",
  question: "bg-slate",
  task: "bg-slate",
};
const KIND_WORD: Record<InboxItem["kind"], string> = {
  handoff: "Nurse handoff",
  approval: "Approval",
  question: "Question",
  task: "Task",
};

/** Protocol replies a nurse can insert (fixed scripts, never model text). */
const PROTOCOL: Record<string, string> = {
  symptom:
    "This is Renee, your nurse navigator. Thank you for telling us. I'm calling you now to ask a few questions. If you have trouble breathing or chest pain, call 911.",
  default:
    "This is Renee, your nurse navigator. I saw your message and I'm calling you now to talk it through.",
};

// ---- the list -----------------------------------------------------------------------------

function ItemRow({
  item,
  now,
  selected,
  onSelect,
}: {
  item: InboxItem;
  now: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={`row-in flex w-full gap-3 border-b border-rule py-3 pr-3 text-left ${
          selected ? "bg-agent-tint" : "bg-panel hover:bg-canvas"
        }`}
      >
        <span aria-hidden className={`w-1 shrink-0 self-stretch ${BAR[item.kind]}`} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[14px] font-bold">{item.title}</span>
            <span className="shrink-0 text-[12px] text-ink-soft tabular-nums">
              {age(item.opened_at, now)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[13px] text-ink-soft">
            <AgentGlyph name={item.agent} size={18} />
            <span className="truncate">
              {item.patient ?? (item.station_id ? "CT, Level 2" : "")}
              {item.kind === "task" ? `: ${item.reason}` : ""}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

// ---- the detail ---------------------------------------------------------------------------

function Pane({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 p-5">
      <h3 className="text-[12px] font-bold text-ink-soft">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function FaxImage({ journey }: { journey: Journey }) {
  const fax = journey.referral.documents.find((d) => d.kind === "referral_fax");
  if (!fax) return <p className="text-[14px] text-ink-soft">No document on file.</p>;
  return (
    <img
      src={documentUrl(fax.uri)}
      alt={`Faxed referral for ${journey.patient.display_name}`}
      className="w-full rounded-[4px] border border-rule"
    />
  );
}

function useDrafter(journeyId: string | undefined, agent: string) {
  const [model, setModel] = useState<{ model?: string; ms?: number; at?: string }>({});
  useEffect(() => {
    if (!journeyId) return;
    void fetchTimeline(journeyId)
      .then((entries) => {
        const run = [...entries]
          .reverse()
          .find((e) => e.kind === "agent" && e.run.agent === agent && !!e.run.model);
        if (run && run.kind === "agent")
          setModel({ model: run.run.model, ms: run.run.latency_ms, at: run.at });
      })
      .catch(() => undefined);
  }, [journeyId, agent]);
  return model;
}

function Detail({
  item,
  now,
  onDone,
}: {
  item: InboxItem;
  now: string;
  onDone: (verb: string) => void;
}) {
  const { user } = useUser();
  const toast = useToast();
  const [journey, setJourney] = useState<Journey | undefined>();
  const [note, setNote] = useState("");
  const [sendBack, setSendBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<{ image: string; member_id: string } | undefined>();
  const [answer, setAnswer] = useState("");
  const drafter = useDrafter(item.journey_id, item.agent);
  useEffect(() => {
    setJourney(undefined);
    setNote("");
    setSendBack(false);
    setAnswer("");
    setCard(undefined);
    if (item.journey_id)
      void fetchJourney(item.journey_id)
        .then(setJourney)
        .catch(() => undefined);
    if (item.kind === "question" && item.journey_id) {
      void fetch(`${RUNTIME_URL}/api/journeys/${item.journey_id}/insurance-card`)
        .then((r) => (r.ok ? r.json() : undefined))
        .then(setCard)
        .catch(() => undefined);
    }
  }, [item.id, item.journey_id, item.kind]);

  const by = user?.name ?? "Staff";
  const act = async (decision: "approved" | "rejected", verb: string, withNote?: string) => {
    setBusy(true);
    try {
      await resolveItem(item.id, { decision, by, ...(withNote ? { note: withNote } : {}) });
      if (decision === "approved" && item.capability === "prior_auth.submit") markStep("insurance");
      if (decision === "approved" && item.capability === "ops_action.apply") markStep("floor");
      toast(verb);
      onDone(verb);
    } catch {
      toast("That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const answerIt = async () => {
    if (!item.journey_id || !item.question) return;
    setBusy(true);
    try {
      await answerQuestion(item.journey_id, item.question.field, answer.trim(), by);
      toast("Answer sent. Intake is reading the referral again.");
      onDone("answered");
    } finally {
      setBusy(false);
    }
  };

  const profile = agentProfile(item.agent);
  const header = (
    <header className="border-b border-rule px-5 py-4">
      <p className="text-[12px] font-bold text-ink-soft">{KIND_WORD[item.kind]}</p>
      <h2 className="mt-0.5 font-figure text-[22px] font-semibold">{item.title}</h2>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-soft">
        {item.patient && item.journey_id && (
          <Link href={`/patients/${item.journey_id}`} className="font-bold text-ink underline">
            {item.patient}
          </Link>
        )}
        <span className="inline-flex items-center gap-1.5">
          <AgentGlyph name={item.agent} size={18} />
          {profile?.label} agent
          {item.kind === "approval"
            ? " drafted this"
            : item.kind === "handoff"
              ? " stepped back"
              : " asked"}
          {drafter.at ? ` ${when(drafter.at, now)}` : ""}
        </span>
        <ModelChip model={drafter.model} ms={drafter.ms} />
      </p>
    </header>
  );

  const backBox = sendBack && (
    <div className="mt-3">
      <label htmlFor="sendback" className="text-[13px] font-bold">
        What should change?
      </label>
      <textarea
        id="sendback"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-[6px] border border-rule p-2 text-[14px]"
      />
    </div>
  );

  const decisionBar = (primary: string, toastText: string) => (
    <footer className="flex flex-wrap items-center gap-3 border-t border-rule px-5 py-4">
      {!sendBack ? (
        <>
          <PrimaryButton
            onClick={() => void act("approved", toastText)}
            disabled={busy || (!journey && !!item.journey_id)}
          >
            {primary}
          </PrimaryButton>
          <QuietButton onClick={() => setSendBack(true)} disabled={busy}>
            Send back
          </QuietButton>
        </>
      ) : (
        <>
          <PrimaryButton
            tone="staff"
            onClick={() => void act("rejected", "Sent back with your note", note.trim())}
            disabled={busy || note.trim().length === 0}
          >
            Send back with note
          </PrimaryButton>
          <QuietButton onClick={() => setSendBack(false)}>Cancel</QuietButton>
        </>
      )}
    </footer>
  );

  // Insurance submission
  if (item.capability === "prior_auth.submit") {
    const packet = journey?.auth_packets.at(-1);
    return (
      <article className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2 md:divide-x md:divide-rule">
          <Pane title="Source: the faxed referral">
            {journey ? <FaxImage journey={journey} /> : <Skeleton rows={6} />}
            <p className="mt-3 rounded-[4px] bg-canvas p-3 text-[13px]">
              <span className="font-bold">Payer rule.</span> Lonestar Health Plan requires prior
              authorization for CT chest/abdomen/pelvis with contrast and for infusions.
            </p>
          </Pane>
          <Pane title="Draft: prior authorization request">
            {packet ? (
              <div className="space-y-3">
                {packet.sections.map((s) => (
                  <section key={s.heading}>
                    <h4 className="text-[14px] font-bold">{s.heading}</h4>
                    <p className="text-[14px] whitespace-pre-line">{s.body}</p>
                  </section>
                ))}
              </div>
            ) : (
              <Skeleton rows={4} />
            )}
            {backBox}
          </Pane>
        </div>
        {decisionBar("Approve and submit", "Submitted to Lonestar Health Plan")}
      </article>
    );
  }

  // Summary signature
  if (item.capability === "summary.send") {
    const draft = journey?.summary?.draft ?? [];
    return (
      <article className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid border-b border-rule md:grid-cols-2 md:divide-x md:divide-rule">
            <Pane title="Source: your visit notes, as written">{null}</Pane>
            <Pane title="Draft: what the patient will read">{null}</Pane>
          </div>
          {draft.map((s) => (
            <div
              key={s.heading}
              className="grid border-b border-rule md:grid-cols-2 md:divide-x md:divide-rule"
            >
              <div className="px-5 py-3">
                <h4 className="text-[13px] font-bold">{s.heading}</h4>
                <p className="text-[14px]">{s.verbatim}</p>
              </div>
              <div className="px-5 py-3">
                <h4 className="text-[13px] font-bold">{s.heading}</h4>
                <p className="text-[14px]">{s.plain}</p>
              </div>
            </div>
          ))}
          {!journey && (
            <div className="p-5">
              <Skeleton rows={4} />
            </div>
          )}
          <div className="px-5">{backBox}</div>
        </div>
        {decisionBar("Sign and send", "Signed and sent to the patient")}
      </article>
    );
  }

  // Ops change
  if (item.capability === "ops_action.apply") {
    const action = (item.review?.pending_event as { payload?: { action?: OpsAction } } | undefined)
      ?.payload?.action;
    return (
      <article className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2 md:divide-x md:divide-rule">
          <Pane title="Source: what the floor shows">
            <p className="text-[14px]">
              CT scanner 1 is down since 9:40. The CT waiting room camera shows the queue growing
              while patients keep arriving for their booked scans.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 text-[13px] text-ink-soft">
              <AgentGlyph name="sensing" size={18} /> Waiting-room sensing counts people with SAM
              3.1 every minute.
            </p>
            <p className="mt-3">
              <Link href="/today" className="text-[14px] text-agent underline">
                Open today&apos;s floor
              </Link>
            </p>
          </Pane>
          <Pane title="Draft: proposed change">
            {action ? (
              <Proposal
                proposal={{ review_id: item.id, status: "pending", action }}
                busy={busy}
                onDecide={(d) =>
                  void act(
                    d,
                    d === "approved"
                      ? "Change applied. Patients are being re-planned."
                      : "Dismissed",
                  )
                }
              />
            ) : null}
          </Pane>
        </div>
      </article>
    );
  }

  // Nurse handoff
  if (item.kind === "handoff") {
    const thread = (journey?.outreach_log ?? []).slice(-6);
    const script = /symptom|clinical/i.test(item.reason) ? PROTOCOL.symptom : PROTOCOL.default;
    return (
      <article className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2 md:divide-x md:divide-rule">
          <Pane title="Source: the conversation">
            <ul className="space-y-2">
              {thread.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[90%] rounded-[8px] px-3 py-2 text-[14px] ${
                    m.direction === "in" ? "bg-canvas" : "ml-auto bg-agent-tint"
                  }`}
                >
                  <span className="block text-[11px] text-ink-soft">
                    {m.direction === "in" ? item.patient : "Throughline"}, {when(m.at, now)}
                  </span>
                  {m.text}
                </li>
              ))}
            </ul>
          </Pane>
          <Pane title="Why the agent stepped back">
            <p className="text-[14px]">
              The message reads as a medical question. Agents never answer those; it was handed to
              you and the patient was told a nurse will call.
            </p>
            <label htmlFor="nurse-reply" className="mt-4 block text-[13px] font-bold">
              Your reply
            </label>
            <textarea
              id="nurse-reply"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-[6px] border border-rule p-2 text-[14px]"
            />
            <button
              type="button"
              onClick={() => setNote(script ?? "")}
              className="mt-1 text-[13px] text-agent underline"
            >
              Insert protocol reply
            </button>
          </Pane>
        </div>
        <footer className="flex items-center gap-3 border-t border-rule px-5 py-4">
          <PrimaryButton
            tone="urgent"
            onClick={() => void act("approved", "Sent. The handoff is closed.", note.trim())}
            disabled={busy || note.trim().length === 0}
          >
            Send as nurse
          </PrimaryButton>
        </footer>
      </article>
    );
  }

  // Intake question
  if (item.kind === "question") {
    return (
      <article className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2 md:divide-x md:divide-rule">
          <Pane title="Source: the fax and the insurance card">
            {journey ? <FaxImage journey={journey} /> : <Skeleton rows={6} />}
            {card && (
              <img
                src={documentUrl(card.image)}
                alt={`Insurance card for ${item.patient}`}
                className="mt-3 w-full max-w-[340px] rounded-[8px] border border-rule"
              />
            )}
          </Pane>
          <Pane title="The agent's question">
            <p className="text-[14px]">{item.reason}</p>
            <label htmlFor="answer" className="mt-4 block text-[13px] font-bold">
              {item.question?.field === "member_id" ? "Member ID" : "Answer"}
            </label>
            <input
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="mt-1 h-10 w-full max-w-[320px] rounded-[6px] border border-rule px-3 text-[15px] tabular-nums"
            />
            {card && (
              <button
                type="button"
                onClick={() => setAnswer(card.member_id)}
                className="mt-1 block text-[13px] text-agent underline"
              >
                Fill from insurance card
              </button>
            )}
          </Pane>
        </div>
        <footer className="flex items-center gap-3 border-t border-rule px-5 py-4">
          <PrimaryButton
            onClick={() => void answerIt()}
            disabled={busy || answer.trim().length === 0}
          >
            Send answer
          </PrimaryButton>
        </footer>
      </article>
    );
  }

  // Task
  return (
    <article className="flex min-h-0 flex-1 flex-col">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <p className="text-[15px]">{item.reason}</p>
        <label htmlFor="task-note" className="mt-4 block text-[13px] font-bold">
          Note (optional)
        </label>
        <textarea
          id="task-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full max-w-[560px] rounded-[6px] border border-rule p-2 text-[14px]"
        />
      </div>
      <footer className="flex items-center gap-3 border-t border-rule px-5 py-4">
        <PrimaryButton
          onClick={() => void act("approved", "Marked done", note.trim() || undefined)}
          disabled={busy}
        >
          Mark done
        </PrimaryButton>
      </footer>
    </article>
  );
}

// ---- page ---------------------------------------------------------------------------------

function Inbox() {
  const { user } = useUser();
  const params = useSearchParams();
  const [scope, setScope] = useState<"mine" | "all" | "done">("mine");
  const role: StaffRole | undefined = scope === "mine" ? user?.role : undefined;
  const { data: items, reload } = useLive(
    () => fetchInbox(role, scope === "done" ? "done" : "pending"),
    [role, scope],
  );
  const { data: hospital } = useLive(fetchHospital);
  const [selected, setSelected] = useState<string | undefined>(params.get("item") ?? undefined);
  // On a phone the list and the item take turns; a deep link opens the item.
  const [reading, setReading] = useState(params.get("item") !== null);
  const list = useMemo(() => items ?? [], [items]);
  useEffect(() => {
    if (list.length > 0 && !list.some((i) => i.id === selected)) setSelected(list[0]?.id);
  }, [list, selected]);
  const item = list.find((i) => i.id === selected);
  const now = hospital?.now ?? "";
  const counts = (["handoff", "approval", "question", "task"] as const).map(
    (k) => [k, list.filter((i) => i.kind === k).length] as const,
  );
  return (
    <div className="flex h-full">
      <section
        aria-label="Items"
        className={`${reading ? "hidden lg:flex" : "flex"} w-full shrink-0 flex-col border-r border-rule bg-panel lg:w-[360px]`}
      >
        <div className="border-b border-rule px-4 pt-4 pb-3">
          <h1 className="font-figure text-[22px] font-semibold">Inbox</h1>
          <div className="mt-2 flex gap-1" role="tablist">
            {(
              [
                ["mine", "Mine"],
                ["all", "All"],
                ["done", "Done"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={scope === k}
                onClick={() => setScope(k)}
                className={`rounded-[4px] px-2.5 py-1 text-[13px] ${
                  scope === k ? "bg-ink font-bold text-white" : "text-ink-soft hover:bg-canvas"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {scope !== "done" && (
            <p className="mt-2 text-[12px] text-ink-soft">
              {counts
                .filter(([, n]) => n > 0)
                .map(([k, n]) => `${KIND_WORD[k]}s ${n}`)
                .join(", ") || " "}
            </p>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {!items && <Skeleton rows={5} height={56} />}
          {list.map((i) => (
            <ItemRow
              key={i.id}
              item={i}
              now={now}
              selected={i.id === selected}
              onSelect={() => {
                setSelected(i.id);
                setReading(true);
              }}
            />
          ))}
        </ul>
      </section>
      <section
        aria-label="Detail"
        className={`${reading ? "flex" : "hidden lg:flex"} min-w-0 flex-1 flex-col bg-panel`}
      >
        <button
          type="button"
          onClick={() => setReading(false)}
          className="border-b border-rule px-4 py-2 text-left text-[14px] text-agent lg:hidden"
        >
          All items
        </button>
        {item ? (
          scope === "done" ? (
            <div className="p-6 text-[14px]">
              <h2 className="font-figure text-[22px] font-semibold">{item.title}</h2>
              <p className="mt-2">
                {item.status === "rejected" ? "Sent back" : "Done"} by {item.resolved_by}
                {item.resolved_at ? `, ${when(item.resolved_at, now)}` : ""}.
              </p>
              {item.note && <p className="mt-2 text-ink-soft">“{item.note}”</p>}
            </div>
          ) : (
            <Detail key={item.id} item={item} now={now} onDone={() => reload()} />
          )
        ) : items ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-figure text-[20px] font-semibold">Nothing needs you.</p>
            <p className="max-w-[44ch] text-[14px] text-ink-soft">
              Agents are handling {hospital?.referrals_in_progress ?? "the"} referrals in progress
              {user
                ? `. Items for other roles go to ${Object.values(ROLE_PERSON)
                    .filter((p) => p.id !== user.id)
                    .map((p) => p.name.split(",")[0])
                    .join(", ")}`
                : ""}
              .
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <Inbox />
    </Suspense>
  );
}
