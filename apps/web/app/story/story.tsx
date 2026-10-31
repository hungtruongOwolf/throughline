"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { BoardView, Journey, OpsProposal } from "@throughline/shared";
import { Proposal } from "../../components/Proposal";
import { clockTime } from "../../lib/format";
import {
  fetchBoard,
  fetchJourney,
  fetchOverview,
  RUNTIME_URL,
  storyCommand,
  subscribeAll,
  type StoryState,
} from "../../lib/runtime";
import { PatientPortal } from "../p/[journeyId]/patient-portal";
import { STEPS, type StoryStepCopy } from "./steps";

const JOURNEY = "maria-001";

// ---- the screens of the people in the story ---------------------------------------------

/** A device or desk around a screen, labeled with whose it is. */
function Frame({
  label,
  children,
  dark = false,
}: {
  label: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-[14px] ring-1 ring-ink/15">
      <figcaption className="bg-ink px-4 py-2 text-[14px] text-white">{label}</figcaption>
      <div className={dark ? "bg-ink" : "bg-paper"}>{children}</div>
    </figure>
  );
}

function IntakeScreen({ journey }: { journey: Journey | undefined }) {
  return (
    <Frame label="Intake coordinator's screen, Halden Medical Center">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1fr]">
        <div>
          <p className="text-[15px] font-bold text-ink-soft">The fax</p>
          <img
            src={`${RUNTIME_URL}/api/documents/maria-referral-fax.png`}
            alt="Faxed referral for Maria Diaz from Northgate Family Medicine. The member ID ends in a smudge."
            className="mt-2 w-full rounded-[6px] ring-1 ring-ink/10"
          />
        </div>
        <div>
          <p className="text-[15px] font-bold text-ink-soft">What Throughline read</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[16px]">
            <dt className="text-ink-soft">Patient</dt>
            <dd>{journey?.patient.display_name ?? "Maria Diaz"}</dd>
            <dt className="text-ink-soft">Referred by</dt>
            <dd>Hannah Whitcombe, MD</dd>
            <dt className="text-ink-soft">For</dt>
            <dd>New patient visit, medical oncology, with blood tests and a CT scan</dd>
            <dt className="text-ink-soft">Urgency</dt>
            <dd>Routine, within 2 weeks (as written)</dd>
            <dt className="text-ink-soft">Member ID</dt>
            <dd className="font-bold text-held">LHP-883201- (unreadable)</dd>
          </dl>
          <p className="mt-5 text-[15px] font-bold text-ink-soft">The insurance card</p>
          <img
            src={`${RUNTIME_URL}/api/documents/maria-insurance-card.png`}
            alt="Lonestar Health Plan card for Maria Diaz, member ID LHP-883201-02."
            className="mt-2 w-full max-w-[360px] rounded-[10px] ring-1 ring-ink/10"
          />
          <label className="mt-5 block text-[16px] font-bold">
            Member ID
            <input
              readOnly
              value="LHP-883201-02"
              className="mt-1 block min-h-12 w-full max-w-[360px] rounded-[10px] bg-white px-3 font-normal ring-2 ring-line"
            />
          </label>
        </div>
      </div>
    </Frame>
  );
}

function AuthScreen({ journey }: { journey: Journey | undefined }) {
  const packet = journey?.auth_packets.at(-1);
  return (
    <Frame label="Intake coordinator's screen, Halden Medical Center">
      <div className="p-6">
        <p className="inline-block rounded-[6px] bg-held-bg px-2 py-0.5 text-[15px] font-bold text-held">
          Waiting for you
        </p>
        <h3 className="mt-2 font-display text-[28px] font-bold">
          Insurance approval request for Maria Diaz
        </h3>
        <p className="text-[16px] text-ink-soft">
          To Lonestar Health Plan. Drafted by Throughline from the referral.
        </p>
        <div className="mt-4 max-w-[70ch] space-y-3 border-l-[3px] border-ink/15 pl-4">
          {(packet?.sections ?? []).map((s) => (
            <section key={s.heading}>
              <h4 className="font-bold">{s.heading}</h4>
              <p className="whitespace-pre-line text-[16px] text-ink-soft">{s.body}</p>
            </section>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function WaitingScreen({ journey }: { journey: Journey | undefined }) {
  const packet = journey?.auth_packets.at(-1);
  return (
    <Frame label="Intake coordinator's screen, Halden Medical Center">
      <div className="p-6 text-[17px]">
        <p className="font-display text-[28px] font-bold">Sent to Lonestar Health Plan</p>
        <p className="mt-1 text-ink-soft">
          Sent by {packet?.submitted_by ?? "the coordinator"}. Insurers usually answer within two
          business days. Throughline books the visits as soon as the answer comes in.
        </p>
      </div>
    </Frame>
  );
}

function StationScreen() {
  const [board, setBoard] = useState<BoardView | undefined>();
  useEffect(() => {
    const load = () =>
      void fetchBoard("imaging_ct")
        .then(setBoard)
        .catch(() => undefined);
    load();
    return subscribeAll(load);
  }, []);
  const rows = (board?.arriving ?? []).slice(0, 7);
  return (
    <Frame label="CT front desk screen, Level 2" dark>
      <div className="p-6 font-display text-board-text">
        <div className="flex items-baseline justify-between">
          <p className="text-[40px] font-bold">CT</p>
          <p className="text-[32px] font-semibold tabular-nums">
            {board ? clockTime(board.now) : ""}
          </p>
        </div>
        <p className="mt-2 inline-block bg-wait-high px-3 py-1 font-sans text-[16px] font-bold text-white">
          CT 1 out of service since 9:40. Waiting now: {board?.waiting_now ?? ""}
        </p>
        <table className="mt-4 w-full text-left text-[22px]">
          <thead>
            <tr className="text-[16px] text-board-text/70">
              <th className="pb-2 font-semibold">Patient</th>
              <th className="pb-2 font-semibold">Time</th>
              <th className="pb-2 font-semibold">Where they are</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.key}
                className={r.journey_id === JOURNEY ? "text-white" : "text-board-text/55"}
              >
                <td className="py-1 font-semibold">
                  {r.initials}
                  {r.journey_id === JOURNEY && (
                    <span className="ml-3 font-sans text-[14px] font-bold">Maria, wheelchair</span>
                  )}
                </td>
                <td className="py-1 tabular-nums">{clockTime(r.eta)}</td>
                <td className="py-1">
                  {r.status === "in_service"
                    ? "being scanned"
                    : r.status === "waiting"
                      ? "waiting here"
                      : "on the way"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

function OpsScreen({ onApprove, busy }: { onApprove: () => void; busy: boolean }) {
  const [proposal, setProposal] = useState<OpsProposal | undefined>();
  useEffect(() => {
    void fetchOverview()
      .then((o) => setProposal(o.proposals.find((p) => p.status === "pending") ?? o.proposals[0]))
      .catch(() => undefined);
  }, []);
  return (
    <Frame label="Operations manager's screen, command center">
      <div className="p-6">
        <p className="text-[15px] font-bold text-ink-soft">Needs your decision</p>
        {proposal ? (
          <div className="mt-3 max-w-[60ch]">
            <Proposal
              proposal={proposal}
              busy={busy}
              onDecide={(d) => d === "approved" && onApprove()}
            />
          </div>
        ) : (
          <p className="mt-3 text-ink-soft">Loading the proposal.</p>
        )}
      </div>
    </Frame>
  );
}

// ---- the story page --------------------------------------------------------------------

function Rail({ index, onGo }: { index: number; onGo: (i: number) => void }) {
  return (
    <nav aria-label="Maria's journey">
      <ol>
        {STEPS.map((s, i) => {
          const state = i < index ? "done" : i === index ? "now" : "later";
          return (
            <li key={s.id} className="grid grid-cols-[18px_1fr] gap-x-3">
              <span aria-hidden className="relative flex justify-center">
                <span
                  className={`absolute top-0 bottom-0 w-[4px] ${i < index ? "bg-line" : "bg-line/20"}`}
                />
                <span
                  className={`relative mt-2 block ${
                    state === "done"
                      ? "h-3 w-3 bg-line"
                      : state === "now"
                        ? "h-4 w-4 bg-held"
                        : "h-3 w-3 border-2 border-line bg-paper"
                  }`}
                />
              </span>
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-current={state === "now" ? "step" : undefined}
                className={`py-1.5 text-left text-[15px] ${state === "now" ? "font-bold text-ink" : state === "done" ? "text-ink" : "text-ink-soft"} hover:underline`}
              >
                {s.rail}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ScreenFor({
  step,
  journey,
  busy,
  onAct,
}: {
  step: StoryStepCopy;
  journey: Journey | undefined;
  busy: boolean;
  onAct: () => void;
}) {
  switch (step.screen.kind) {
    case "intake":
      return <IntakeScreen journey={journey} />;
    case "auth":
      return <AuthScreen journey={journey} />;
    case "waiting":
      return <WaitingScreen journey={journey} />;
    case "station":
      return <StationScreen />;
    case "ops":
      return <OpsScreen onApprove={onAct} busy={busy} />;
    case "patient":
      return (
        <Frame label="Maria's patient page, on her phone or computer">
          <PatientPortal journeyId={JOURNEY} embedded phase={step.screen.phase} />
        </Frame>
      );
  }
}

/**
 * Maria's journey as one story (owner feedback: one flow, one action per step, always a next
 * step). The rail is the whole journey; the main area is the real screen of whoever acts now.
 */
export function Story() {
  const [state, setState] = useState<StoryState | undefined>();
  const [journey, setJourney] = useState<Journey | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const loadJourney = useCallback(
    () =>
      void fetchJourney(JOURNEY)
        .then(setJourney)
        .catch(() => undefined),
    [],
  );

  const run = useCallback(
    (command: Parameters<typeof storyCommand>[0]) => {
      setBusy(true);
      setError(false);
      storyCommand(command)
        .then((s) => {
          setState(s);
          loadJourney();
        })
        .catch(() => setError(true))
        .finally(() => setBusy(false));
    },
    [loadJourney],
  );

  useEffect(() => {
    // Open at the step in the address (so a reload or a shared link keeps it), else the fax.
    const wanted = new URLSearchParams(window.location.search).get("step");
    run({ kind: "goto", step: STEPS.some((x) => x.id === wanted) ? (wanted as string) : "fax" });
  }, [run]);

  useEffect(() => {
    if (!state) return;
    const url = new URL(window.location.href);
    url.searchParams.set("step", state.step);
    window.history.replaceState(null, "", url);
  }, [state]);

  const index = state?.index ?? 0;
  const step = STEPS[index] as StoryStepCopy;
  const last = index === STEPS.length - 1;
  const act = () => run(last ? { kind: "goto", step: "fax" } : { kind: "act" });

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden className="block h-[6px] w-6 bg-line" />
            <span className="font-display text-[22px] font-bold">Throughline</span>
          </Link>
          <span className="text-[16px] text-ink-soft">
            Maria&apos;s journey, step {index + 1} of {STEPS.length}
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Rail index={index} onGo={(i) => run({ kind: "goto", step: STEPS[i]?.id ?? "fax" })} />
        </aside>

        <main className="min-w-0">
          <p className="text-[15px] font-bold text-ink-soft">
            {step.when}. {step.who}
          </p>
          <h1 className="mt-1 font-display text-[44px] leading-none font-bold">{step.rail}</h1>
          <p className="mt-3 max-w-[70ch] text-[19px]">{step.happened}</p>

          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[14px] bg-white p-4 ring-1 ring-ink/10">
            {step.voice && (
              <div className="w-full rounded-[16px] bg-line/10 px-4 py-3 text-[17px] sm:w-auto sm:flex-1">
                <span className="block text-[13px] font-bold text-ink-soft">
                  Maria&apos;s voice note
                </span>
                <audio
                  controls
                  preload="none"
                  src={`${RUNTIME_URL}${step.voice.src}`}
                  className="mt-1 h-10 w-full max-w-[420px]"
                />
                <p className="mt-1">&ldquo;{step.voice.words}&rdquo;</p>
              </div>
            )}
            {step.screen.kind !== "ops" && (
              <button
                type="button"
                onClick={act}
                disabled={busy}
                className="min-h-12 rounded-[12px] bg-line px-6 text-[17px] font-bold text-white disabled:opacity-50"
              >
                {busy ? "Working…" : step.action}
              </button>
            )}
            {step.screen.kind === "ops" && (
              <p className="text-[17px] font-bold">Approve or reject the proposal below.</p>
            )}
            {step.next && (
              <p className="max-w-[60ch] text-[16px] text-ink-soft">Next: {step.next}</p>
            )}
            {error && (
              <p role="alert" className="text-[16px] text-wait-high">
                Throughline didn&apos;t respond. Try again.
              </p>
            )}
          </div>

          <div
            className={`mt-6 transition-opacity ${busy ? "opacity-50" : ""}`}
            key={`${step.id}-${state?.now}`}
          >
            <ScreenFor step={step} journey={journey} busy={busy} onAct={act} />
          </div>
        </main>
      </div>
    </div>
  );
}
