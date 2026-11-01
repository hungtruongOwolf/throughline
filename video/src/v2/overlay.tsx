import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../theme";
import { EZ } from "./fx";
import type { ShotRow } from "./Film2";

/**
 * Who is working right now: a card for each agent the moment it starts (what it is for and what
 * it runs on), and a rail of the three stages with how many of the thirteen have worked so far.
 */

type Kind = "meta" | "engine" | "rules";
type Agent = { code: string; name: string; job: string; runs: { label: string; kind: Kind }[]; icon: ReactNode };

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const I = {
  fax: <g {...s}><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8 8h8M8 12h8M8 16h5" /></g>,
  shield: <g {...s}><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" /><path d="M9 12l2 2 4-4" /></g>,
  stamp: <g {...s}><path d="M9 3h6v6l3 3v3H6v-3l3-3z" /><path d="M5 20h14" /></g>,
  calendar: <g {...s}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M8 15h3" /></g>,
  list: <g {...s}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></g>,
  chat: <g {...s}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 10h1M12 10h1M16 10h1" /></g>,
  camera: <g {...s}><rect x="3" y="7" width="18" height="13" rx="2" /><circle cx="12" cy="13.5" r="3.5" /><path d="M8 7l2-3h4l2 3" /></g>,
  route: <g {...s}><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6" /></g>,
  compass: <g {...s}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></g>,
  chart: <g {...s}><path d="M4 20V4M4 20h16" /><path d="M7 15l4-5 3 3 5-7" /></g>,
  flask: <g {...s}><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" /><path d="M7.5 15h9" /></g>,
  note: <g {...s}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h5" /></g>,
  loop: <g {...s}><path d="M20 12a8 8 0 1 1-3-6.2" /><path d="M20 4v4h-4" /></g>,
};

const SPARK = { label: "Muse Spark 1.3", kind: "meta" as const };
const RUST = { label: "Rust engine", kind: "engine" as const };
const RULES = { label: "Rules", kind: "rules" as const };

export const AGENTS: Record<string, Agent> = {
  IN: { code: "IN", name: "Intake", job: "Reads the faxed referral", runs: [SPARK], icon: I.fax },
  CV: { code: "CV", name: "Coverage", job: "Checks the plan and what needs approval", runs: [{ label: "Payer rules", kind: "rules" }], icon: I.shield },
  PA: { code: "PA", name: "Prior auth", job: "Drafts the request to the insurer", runs: [SPARK], icon: I.stamp },
  SC: { code: "SC", name: "Scheduling", job: "Books every visit in the fewest trips", runs: [RUST], icon: I.calendar },
  VP: { code: "VP", name: "Visit prep", job: "Sends the plan for the day", runs: [RULES], icon: I.list },
  PM: { code: "PM", name: "Messaging", job: "Reads replies and voice notes", runs: [SPARK, { label: "Voice Transcribe", kind: "meta" }], icon: I.chat },
  IT: { code: "IT", name: "Itinerary", job: "Plans and re-plans her stops", runs: [RUST], icon: I.route },
  WS: { code: "WS", name: "Waiting-room sensing", job: "Counts people in each waiting room", runs: [{ label: "SAM 3.1", kind: "meta" }], icon: I.camera },
  OP: { code: "OP", name: "Ops planner", job: "Simulates fixes when a line grows", runs: [{ label: "Muse Spark Open · Baseten", kind: "meta" }], icon: I.chart },
  CO: { code: "CO", name: "Visit companion", job: "Tells patients where to go and why", runs: [SPARK], icon: I.compass },
  DS: { code: "DS", name: "Discharge", job: "Puts the doctor's notes in plain words", runs: [SPARK], icon: I.note },
  RW: { code: "RW", name: "Results watch", job: "Tracks results until a doctor signs", runs: [RULES], icon: I.flask },
  FU: { code: "FU", name: "Follow-up", job: "Books the next visit, closes the loop", runs: [RUST], icon: I.loop },
};

/** When each agent first works: the beat of the voice line and how far into it. */
const CUES: { beat: string; at: number; code: string }[] = [
  { beat: "HANDOFF-1", at: 0.05, code: "IN" },
  { beat: "HANDOFF-2", at: 0.25, code: "CV" },
  { beat: "HANDOFF-3", at: 0.0, code: "PA" },
  { beat: "HANDOFF-4", at: 0.1, code: "SC" },
  { beat: "HANDOFF-5", at: 0.0, code: "VP" },
  { beat: "HANDOFF-5", at: 0.42, code: "PM" },
  { beat: "HANDOFF-5", at: 0.74, code: "IT" },
  { beat: "DAY-2", at: 0.05, code: "WS" },
  { beat: "HANDOFF-6", at: 0.3, code: "OP" },
  { beat: "GATE-2", at: 0.62, code: "CO" },
  { beat: "AFTER-1", at: 0.1, code: "DS" },
  { beat: "AFTER-3", at: 0.0, code: "RW" },
  { beat: "AFTER-3", at: 0.5, code: "FU" },
];

const STAGES = [
  { label: "Before the visit", from: "HANDOFF-1", to: "HIT-2" },
  { label: "Visit day", from: "HIT-2", to: "DROP2" },
  { label: "After the visit", from: "DROP2", to: "TECH-1" },
];

const CARD_LEN = 78; // frames a card stays (about 2.6 s)

export function cueFrames(shots: ShotRow[]) {
  const by = Object.fromEntries(shots.map((s) => [s.beat, s]));
  return CUES.map((c) => {
    const s = by[c.beat]!;
    return { ...c, frame: Math.round(s.start + c.at * Math.max(s.vo, 30)) };
  });
}

function Chip({ label, kind }: { label: string; kind: Kind }) {
  const meta = kind === "meta";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 999,
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: 19,
        whiteSpace: "nowrap",
        background: meta ? "rgba(45,212,191,.16)" : "rgba(244,246,242,.1)",
        color: meta ? C.glow : "rgba(244,246,242,.78)",
        border: `1px solid ${meta ? "rgba(45,212,191,.55)" : "rgba(244,246,242,.25)"}`,
      }}
    >
      {meta && <span style={{ width: 8, height: 8, borderRadius: 4, background: C.glow }} />}
      {label}
    </span>
  );
}

function Card({ agent, local, n }: { agent: Agent; local: number; n: number }) {
  const { fps } = useVideoConfig();
  const inP = spring({ frame: local, fps, config: { damping: 18, stiffness: 160 } });
  const outP = interpolate(local, [CARD_LEN - 10, CARD_LEN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.in });
  const ring = interpolate(local, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        bottom: 56,
        width: 660,
        display: "flex",
        gap: 22,
        alignItems: "center",
        padding: "20px 26px 20px 20px",
        borderRadius: 18,
        background: "rgba(16,24,42,.94)",
        border: "1px solid rgba(45,212,191,.35)",
        boxShadow: "0 30px 60px -24px rgba(0,0,0,.6), 0 0 40px rgba(45,212,191,.12)",
        opacity: inP * (1 - outP),
        transform: `translateX(${(1 - inP) * -60 - outP * 30}px)`,
      }}
    >
      <div style={{ position: "relative", width: 92, height: 92, flexShrink: 0 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 22,
            background: C.agent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 0 ${ring * 10}px rgba(45,212,191,${0.25 * (1 - ring)})`,
          }}
        >
          <svg width={52} height={52} viewBox="0 0 24 24">
            {agent.icon}
          </svg>
        </div>
        <span
          style={{
            position: "absolute",
            right: -8,
            bottom: -8,
            padding: "2px 7px",
            borderRadius: 7,
            background: C.ink,
            border: `2px solid ${C.glow}`,
            color: C.glow,
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {agent.code}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.boardText, lineHeight: 1 }}>{agent.name}</span>
          <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 20, color: "rgba(244,246,242,.5)" }}>agent {n} of 13</span>
        </div>
        <div style={{ fontFamily: F.text, fontSize: 23, color: "rgba(244,246,242,.85)" }}>{agent.job}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          {agent.runs.map((r) => (
            <Chip key={r.label} {...r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Rail({ stage, worked, show }: { stage: number; worked: number; show: number }) {
  return (
    <div
      style={{
        position: "absolute",
        right: 48,
        top: 44,
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "10px 14px 10px 20px",
        borderRadius: 999,
        background: "rgba(16,24,42,.9)",
        border: "1px solid rgba(244,246,242,.14)",
        opacity: show,
        transform: `translateY(${(1 - show) * -20}px)`,
      }}
    >
      {STAGES.map((st, i) => (
        <div key={st.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              background: i < stage ? C.agent : i === stage ? C.glow : "transparent",
              border: `2px solid ${i <= stage ? C.glow : "rgba(244,246,242,.35)"}`,
              boxShadow: i === stage ? `0 0 12px ${C.glow}` : "none",
            }}
          />
          <span
            style={{
              fontFamily: F.text,
              fontWeight: 700,
              fontSize: 19,
              color: i === stage ? C.boardText : "rgba(244,246,242,.45)",
              whiteSpace: "nowrap",
            }}
          >
            {st.label}
          </span>
          {i < STAGES.length - 1 && <span style={{ width: 26, height: 2, background: "rgba(244,246,242,.25)" }} />}
        </div>
      ))}
      <span style={{ width: 1, height: 26, background: "rgba(244,246,242,.2)", marginLeft: 6 }} />
      <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 21, color: C.glow, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
        {worked}/13 agents
      </span>
    </div>
  );
}

/** The layer over the whole film. */
export function AgentLayer({ shots }: { shots: ShotRow[] }) {
  const f = useCurrentFrame();
  const cues = cueFrames(shots);
  const by = Object.fromEntries(shots.map((s) => [s.beat, s.start]));
  const stage = STAGES.findIndex((st) => f >= by[st.from]! && f < by[st.to]!);
  const railFrom = by[STAGES[0]!.from]!;
  const railTo = by[STAGES[2]!.to]!;
  const show =
    interpolate(f, [railFrom, railFrom + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(f, [railTo - 10, railTo], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const worked = cues.filter((c) => f >= c.frame).length;
  const active = cues
    .map((c, i) => ({ ...c, n: i + 1 }))
    .filter((c) => f >= c.frame && f < c.frame + CARD_LEN)
    .slice(-1)[0];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {show > 0 && <Rail stage={Math.max(0, stage)} worked={worked} show={show} />}
      {active && <Card key={active.code} agent={AGENTS[active.code]!} local={f - active.frame} n={active.n} />}
    </AbsoluteFill>
  );
}
