import type { ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { Badge } from "../scenes/act2";
import { CometThread, EZ } from "../v2/fx";

/**
 * Still diagrams for the README, drawn in the film's language: navy or paper, the teal thread,
 * agent badges, and amber for the moments a person decides. Rendered to PNG by
 * scripts/render-diagrams.mjs.
 */

const soft = "rgba(244,246,242,.72)";

function Canvas({ children, light = false, title, sub, foot }: { children: ReactNode; light?: boolean; title: string; sub?: string; foot?: string }) {
  return (
    <AbsoluteFill style={{ background: light ? C.paper : C.ink, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -300, top: -400, width: 1200, height: 1200, background: `radial-gradient(circle, ${light ? "rgba(15,118,110,.10)" : "rgba(45,212,191,.16)"}, transparent 65%)` }} />
      <div style={{ position: "absolute", right: -300, bottom: -500, width: 1300, height: 1300, background: `radial-gradient(circle, ${light ? "rgba(59,111,214,.07)" : "rgba(99,102,241,.14)"}, transparent 65%)` }} />
      <div style={{ position: "absolute", left: 70, top: 56, display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ width: 46, height: 12, background: light ? C.agent : C.glow }} />
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 54, color: light ? C.ink : C.boardText }}>{title}</span>
      </div>
      {sub && <div style={{ position: "absolute", left: 134, top: 128, fontFamily: F.text, fontSize: 26, color: light ? C.inkSoft : soft }}>{sub}</div>}
      {children}
      {foot && <div style={{ position: "absolute", left: 70, right: 70, bottom: 34, fontFamily: F.text, fontSize: 19, color: light ? C.inkSoft : "rgba(244,246,242,.5)" }}>{foot}</div>}
    </AbsoluteFill>
  );
}

function Person({ size = 28, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx={12} cy={7.5} r={4.2} fill={color} />
      <path d="M3.5 22c0-5 3.8-8.2 8.5-8.2s8.5 3.2 8.5 8.2" fill={color} />
    </svg>
  );
}

// ---- 1. The broken chain ----------------------------------------------------------------------

const STEPS = [
  { step: "Referral", sys: "Clinic records", who: "Front desk", accent: C.zone.blue, x: 110, y: 250 },
  { step: "Insurance", sys: "Insurer portal", who: "Insurer", accent: C.zone.gold, x: 620, y: 250 },
  { step: "Scheduling", sys: "Hospital scheduling", who: "Scheduler", accent: C.zone.green, x: 1130, y: 250 },
  { step: "Visit day", sys: "The building itself", who: "Whoever is nearby", accent: C.zone.violet, x: 1130, y: 590 },
  { step: "Results", sys: "Lab system", who: "Lab", accent: C.zone.rose, x: 620, y: 590 },
  { step: "Follow-up", sys: "Doctor's inbox", who: "Doctor", accent: C.zone.blue, x: 110, y: 590 },
];
const W1 = 360;
const H1 = 210;
const LINKS1 = [
  { label: "fax", d: `M ${110 + W1} 355 L 620 355`, at: [545, 330] },
  { label: "phone call", d: `M ${620 + W1} 355 L 1130 355`, at: [1055, 330] },
  { label: "a letter", d: `M ${1130 + W1} 355 C 1560 355, 1560 695, ${1130 + W1} 695`, at: [1470, 525] },
  { label: '"where do I go?"', d: `M 1130 695 L ${620 + W1} 695`, at: [1055, 670] },
  { label: "a portal, maybe", d: `M 620 695 L ${110 + W1} 695`, at: [545, 670] },
];

function Window({ s }: { s: (typeof STEPS)[number] }) {
  return (
    <div style={{ position: "absolute", left: s.x, top: s.y, width: W1, borderRadius: 14, overflow: "hidden", boxShadow: "0 40px 70px -30px rgba(0,0,0,.9)" }}>
      <div style={{ height: 50, background: s.accent, display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
        {[0, 1, 2].map((d) => (
          <span key={d} style={{ width: 11, height: 11, borderRadius: 6, background: "rgba(255,255,255,.55)" }} />
        ))}
        <span style={{ marginLeft: 8, fontFamily: F.text, fontWeight: 700, fontSize: 23, color: "#fff" }}>{s.sys}</span>
      </div>
      <div style={{ height: H1 - 50, background: "#111a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 52, color: C.boardText }}>{s.step}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: F.text, fontWeight: 700, fontSize: 24, color: soft }}>
          <Person size={24} color={soft} />
          {s.who}
        </div>
      </div>
    </div>
  );
}

export function BrokenChain() {
  return (
    <Canvas title="Six steps, six systems, nobody owns the chain" sub="Every handoff between them is done by hand, and every handoff is a place to fall through." foot="Illustrative. A typical referral for an outpatient CT scan in a US hospital.">
      <svg width={1600} height={900} style={{ position: "absolute", inset: 0 }}>
        {LINKS1.map((l) => (
          <path key={l.label} d={l.d} stroke={C.urgent} strokeWidth={5} strokeDasharray="12 12" fill="none" />
        ))}
      </svg>
      {STEPS.map((s) => (
        <Window key={s.step} s={s} />
      ))}
      {LINKS1.map((l) => (
        <div key={l.label} style={{ position: "absolute", left: l.at[0], top: l.at[1], transform: "translate(-50%, -50%)", background: C.heldBg, color: C.held, border: `2px solid ${C.held}`, borderRadius: 999, padding: "8px 18px", fontFamily: F.text, fontWeight: 700, fontSize: 22, whiteSpace: "nowrap" }}>
          {l.label}
        </div>
      ))}
    </Canvas>
  );
}

// ---- 2. The journey -----------------------------------------------------------------------------

type Item = { code?: string; name: string; on: string; gate?: boolean };
const LANES: { title: string; items: Item[] }[] = [
  {
    title: "Before",
    items: [
      { code: "IN", name: "Intake", on: "Muse Spark" },
      { code: "CV", name: "Coverage", on: "Payer rules" },
      { code: "PA", name: "Prior auth", on: "Muse Spark" },
      { name: "Coordinator approves", on: "", gate: true },
      { code: "SC", name: "Scheduling", on: "Rust engine" },
      { code: "VP", name: "Visit prep", on: "Rules" },
      { code: "PM", name: "Messaging", on: "Voice Transcribe" },
    ],
  },
  {
    title: "Visit day",
    items: [
      { code: "WS", name: "Sensing", on: "SAM 3.1" },
      { code: "OP", name: "Ops planner", on: "Spark Open" },
      { name: "Within policy, or the ops lead", on: "", gate: true },
      { code: "IT", name: "Itinerary", on: "Rust engine" },
      { code: "CO", name: "Companion", on: "Muse Spark" },
    ],
  },
  {
    title: "After",
    items: [
      { code: "DS", name: "Discharge", on: "Muse Spark" },
      { name: "Doctor signs", on: "", gate: true },
      { code: "RW", name: "Results watch", on: "Rules" },
      { code: "FU", name: "Follow-up", on: "Rust engine" },
    ],
  },
];
const LX0 = 330;
const LX1 = 1380;
const LY = [300, 560, 820];
const lx = (lane: number, i: number) => {
  const n = LANES[lane]!.items.length;
  const span = lane === 0 ? LX1 - LX0 : ((LX1 - LX0) * (n - 1)) / 6;
  return LX0 + (n === 1 ? 0 : (span * i) / (n - 1));
};

export function Journey() {
  const rows = LANES.map((l, k) => ({ y: LY[k]!, first: lx(k, 0), last: lx(k, l.items.length - 1) }));
  // the thread runs along each lane, turns at the right edge, and comes back between the lanes
  const turn = LX1 + 60;
  let d = `M ${LX0 - 70} ${rows[0]!.y}`;
  rows.forEach((r, k) => {
    const next = rows[k + 1];
    if (!next) {
      d += ` L ${r.last} ${r.y}`;
      return;
    }
    const mid = (r.y + next.y) / 2 + 10;
    d += ` L ${turn} ${r.y} C ${turn + 70} ${r.y}, ${turn + 70} ${mid}, ${turn} ${mid} L ${LX0 - 40} ${mid} C ${LX0 - 110} ${mid}, ${LX0 - 110} ${next.y}, ${LX0 - 40} ${next.y} L ${next.first} ${next.y}`;
  });
  return (
    <Canvas light title="One journey, thirteen agents" sub="Each agent owns one step and hands the work to the next. People decide at the amber gates." foot="Teal: an agent and what it runs on. Amber: a person decides. Dashed: a medical question or an unsure patient goes to a nurse.">
      {LANES.map((l, k) => (
        <div key={l.title} style={{ position: "absolute", left: 70, top: LY[k]! - 62, width: 1400, height: 196, borderRadius: 22, background: "rgba(15,118,110,.05)", border: `1px solid ${C.rule}` }}>
          <div style={{ position: "absolute", left: 26, top: 40, fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.agent, width: 150, lineHeight: 1 }}>{l.title}</div>
        </div>
      ))}
      <svg width={1600} height={1000} style={{ position: "absolute", inset: 0 }}>
        <path d={d} stroke={C.agent} strokeWidth={6} fill="none" strokeLinecap="round" />
        {["PM", "CO", "FU"].map((c) => {
          const k = LANES.findIndex((l) => l.items.some((i) => i.code === c));
          const i = LANES[k]!.items.findIndex((it) => it.code === c);
          const x = lx(k, i);
          return <path key={c} d={`M ${x + 40} ${LY[k]!} C ${x + 120} ${LY[k]!}, 1545 ${LY[k]! - 40}, 1545 ${LY[k]! + 60} L 1545 975`} stroke={C.held} strokeWidth={3} strokeDasharray="8 10" fill="none" opacity={0.7} />;
        })}
      </svg>
      {LANES.map((l, k) =>
        l.items.map((it, i) => {
          const x = lx(k, i);
          const y = LY[k]!;
          if (it.gate)
            return (
              <div key={it.name} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ width: 70, height: 70, borderRadius: 35, background: C.heldBg, border: `4px solid ${C.held}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Person size={38} color={C.held} />
                </div>
                <div style={{ position: "absolute", top: 82, width: 180, textAlign: "center", fontFamily: F.text, fontWeight: 700, fontSize: 22, lineHeight: 1.2, color: C.held }}>{it.name}</div>
              </div>
            );
          return (
            <div key={it.name} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Badge code={it.code!} on={1} size={72} />
              <div style={{ position: "absolute", top: 82, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 24, color: C.ink, whiteSpace: "nowrap" }}>{it.name}</div>
                <div style={{ fontFamily: F.text, fontSize: 19, color: C.agent, whiteSpace: "nowrap" }}>{it.on}</div>
              </div>
            </div>
          );
        }),
      )}
      <div style={{ position: "absolute", left: 1385, top: 975, display: "flex", alignItems: "center", gap: 12, background: C.heldBg, border: `3px solid ${C.held}`, borderRadius: 999, padding: "10px 24px", fontFamily: F.text, fontWeight: 700, fontSize: 24, color: C.held }}>
        <Person size={28} color={C.held} />
        Nurse
      </div>
    </Canvas>
  );
}

// ---- 3. Architecture ----------------------------------------------------------------------------

function Box({ x, y, w, h, title, lines, tone = "dark", small }: { x: number; y: number; w: number; h: number; title: string; lines?: string[]; tone?: "dark" | "teal" | "amber" | "line"; small?: boolean }) {
  const bg = { dark: "#132039", teal: C.agent, amber: C.heldBg, line: "rgba(255,255,255,.03)" }[tone];
  const fg = tone === "amber" ? C.held : C.boardText;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 16, background: bg, border: `2px solid ${tone === "teal" ? C.glow : tone === "amber" ? C.held : "rgba(244,246,242,.16)"}`, padding: "16px 20px", boxShadow: tone === "line" ? "none" : "0 30px 60px -30px rgba(0,0,0,.9)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: small ? 28 : 34, color: fg }}>{title}</div>
      {lines?.map((l) => (
        <div key={l} style={{ fontFamily: F.text, fontSize: 21, color: tone === "amber" ? C.held : soft, lineHeight: 1.25 }}>
          {l}
        </div>
      ))}
    </div>
  );
}

function Arrow({ d, label, at, color = C.glow, both = true }: { d: string; label?: string; at?: [number, number]; color?: string; both?: boolean }) {
  return (
    <>
      <svg width={1600} height={1000} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <marker id={`a${color.replace(/[^a-z0-9]/gi, "")}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        </defs>
        <path d={d} stroke={color} strokeWidth={4} fill="none" markerEnd={`url(#a${color.replace(/[^a-z0-9]/gi, "")})`} markerStart={both ? `url(#a${color.replace(/[^a-z0-9]/gi, "")})` : undefined} />
      </svg>
      {label && at && <div style={{ position: "absolute", left: at[0], top: at[1], transform: "translate(-50%, -50%)", background: C.ink, padding: "4px 12px", borderRadius: 8, fontFamily: F.text, fontWeight: 700, fontSize: 20, color, whiteSpace: "nowrap" }}>{label}</div>}
    </>
  );
}

export function Architecture() {
  return (
    <Canvas title="How it fits together" sub="One event log drives the agents; one live stream drives every screen." foot="The public site serves model outputs recorded from live calls, so the server holds no API keys.">
      {/* web */}
      <div style={{ position: "absolute", left: 60, top: 200, width: 400, height: 660, borderRadius: 24, border: "2px dashed rgba(244,246,242,.25)" }} />
      <div style={{ position: "absolute", left: 84, top: 214, fontFamily: F.text, fontWeight: 700, fontSize: 22, color: soft }}>Web app · Next.js on Vercel</div>
      <Box x={90} y={262} w={340} h={130} title="Staff workspace" lines={["Inbox, Referrals, Record,", "Today, Agents"]} small />
      <Box x={90} y={410} w={340} h={130} title="Patient app" lines={["Plan, wait, directions,", "voice notes"]} small />
      <Box x={90} y={558} w={340} h={130} title="3D campus" lines={["Floors, waits, routes"]} small />
      <Box x={90} y={706} w={340} h={120} title="Rust engine" lines={["WebAssembly, in the browser"]} tone="teal" small />
      {/* runtime */}
      <div style={{ position: "absolute", left: 560, top: 200, width: 560, height: 660, borderRadius: 24, border: "2px dashed rgba(244,246,242,.25)" }} />
      <div style={{ position: "absolute", left: 584, top: 214, fontFamily: F.text, fontWeight: 700, fontSize: 22, color: soft }}>Runtime · Node on Modal</div>
      <Box x={590} y={262} w={500} h={100} title="API and one live event stream" small />
      <Box x={590} y={380} w={500} h={110} title="Event log and journey state" lines={["Append-only; state is derived from events"]} small />
      <Box x={590} y={508} w={240} h={150} title="13 agents" lines={["One required tool,", "retry, fallback"]} tone="teal" small />
      <Box x={850} y={508} w={240} h={150} title="Safety gate" lines={["Grants, approvals,", "nurse handoffs"]} tone="amber" small />
      <Box x={590} y={676} w={240} h={150} title="Simulated world" lines={["Clock, fax line,", "insurer, lab, cameras"]} small />
      <Box x={850} y={676} w={240} h={150} title="Rust engine" lines={["Routes, schedules,", "queue simulation"]} tone="teal" small />
      {/* models */}
      <div style={{ position: "absolute", left: 1220, top: 200, width: 320, height: 660, borderRadius: 24, border: "2px dashed rgba(244,246,242,.25)" }} />
      <div style={{ position: "absolute", left: 1244, top: 214, fontFamily: F.text, fontWeight: 700, fontSize: 22, color: soft }}>Models</div>
      <Box x={1250} y={262} w={260} h={120} title="Record and replay cache" small />
      <Box x={1250} y={440} w={260} h={220} title="Meta Model API" lines={["Muse Spark 1.3", "SAM 3.1", "Muse Voice Transcribe", "Muse Image"]} tone="teal" small />
      <Box x={1250} y={684} w={260} h={142} title="Baseten" lines={["Muse Spark Open,", "open weights"]} tone="teal" small />
      <Arrow d="M 440 330 L 580 312" label="HTTPS + stream" at={[510, 290]} />
      <Arrow d="M 440 470 L 580 330" />
      <Arrow d="M 1100 312 L 1240 312" label="every call" at={[1170, 290]} />
      <Arrow d="M 1380 386 L 1380 430" both={false} />
      <Arrow d="M 1520 330 C 1580 330, 1580 750, 1520 750" />
    </Canvas>
  );
}

// ---- 4. The agent contract ----------------------------------------------------------------------

function Step({ n, x, y, w = 300, title, line, tone = "paper" }: { n: string; x: number; y: number; w?: number; title: string; line: string; tone?: "paper" | "teal" | "amber" }) {
  const bg = { paper: C.panel, teal: C.agent, amber: C.heldBg }[tone];
  const bd = { paper: C.rule, teal: C.agent, amber: C.held }[tone];
  const fg = tone === "teal" ? "#fff" : tone === "amber" ? C.held : C.ink;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: w, minHeight: 150, borderRadius: 18, background: bg, border: `2px solid ${bd}`, padding: "18px 22px", boxShadow: "0 24px 50px -28px rgba(24,34,58,.55)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 40, color: tone === "teal" ? "#bff3ea" : tone === "amber" ? C.held : C.agent }}>{n}</span>
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, color: fg }}>{title}</span>
      </div>
      <div style={{ marginTop: 8, fontFamily: F.text, fontSize: 22, lineHeight: 1.3, color: tone === "teal" ? "rgba(255,255,255,.88)" : tone === "amber" ? C.held : C.inkSoft }}>{line}</div>
    </div>
  );
}

function Line({ d, color = C.agent, dashed = false }: { d: string; color?: string; dashed?: boolean }) {
  return (
    <svg width={1600} height={1000} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <marker id={`m${color.replace(/[^a-z0-9]/gi, "")}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <path d={d} stroke={color} strokeWidth={4} strokeDasharray={dashed ? "9 9" : undefined} fill="none" markerEnd={`url(#m${color.replace(/[^a-z0-9]/gi, "")})`} />
    </svg>
  );
}

export function Contract() {
  return (
    <Canvas light title="The contract every agent follows" sub="This is what makes thirteen agents safe to run without someone watching each one.">
      <Step n="1" x={70} y={220} title="Event" line="Something happened: a fax arrived, a queue grew, a result came back." />
      <Step n="2" x={420} y={220} title="Grant check" line="Is this capability granted to this agent? If not, refused." />
      <Step n="3" x={770} y={220} w={380} title="Safety gate" line="Routine: run now. Needs a person: park it. Medical: hand to a nurse." tone="amber" />
      <Step n="4" x={1210} y={220} title="Agent runs" line="Deterministic code, or a model with exactly one required tool." tone="teal" />
      <Step n="5" x={1210} y={500} title="Validate" line="Arguments checked against the schema in code." />
      <Step n="6" x={770} y={500} w={380} title="Retry, then fall back" line="Prose or invalid: one retry with the error. Still invalid: a deterministic rule. Recorded." />
      <Step n="7" x={420} y={500} title="New events" line="The run is recorded: input, sources, model, output." tone="teal" />
      <Step n="P" x={770} y={760} w={380} title="Park and replay" line="A person approves the exact proposal; the parked event replays as is." tone="amber" />
      <Line d="M 370 300 L 410 300" />
      <Line d="M 720 300 L 760 300" />
      <Line d="M 1150 300 L 1200 300" />
      <Line d="M 1360 380 L 1360 490" />
      <Line d="M 1200 580 L 1160 580" />
      <Line d="M 760 580 L 730 580" />
      <Line d="M 800 400 L 800 440 Q 800 460 780 460 L 760 460 Q 745 460 745 480 L 745 820 Q 745 840 762 840" color={C.held} dashed />
      <Line d="M 1150 840 L 1165 840 Q 1180 840 1180 820 L 1180 470 Q 1180 450 1195 440 L 1205 432" color={C.held} dashed />
      <Line d="M 420 600 C 200 640, 120 520, 200 380" color={C.agent} dashed />
      <div style={{ position: "absolute", left: 70, top: 690, width: 330, fontFamily: F.text, fontSize: 21, color: C.inkSoft, lineHeight: 1.35 }}>The next agent picks up the new events, so the journey carries on without anyone re-typing it.</div>
    </Canvas>
  );
}

// ---- 5. By the numbers --------------------------------------------------------------------------

type Stat = { big: string; label: string; src: string; color: string };

function Stats({ title, sub, stats, cols, foot }: { title: string; sub: string; stats: Stat[]; cols: number; foot: string }) {
  const W = (1460 - (cols - 1) * 30) / cols;
  const rows = Math.ceil(stats.length / cols);
  const H = rows === 1 ? 400 : 300;
  return (
    <Canvas title={title} sub={sub} foot={foot}>
      {stats.map((s, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return (
          <div key={s.big + i} style={{ position: "absolute", left: 70 + c * (W + 30), top: 210 + r * (H + 30), width: W, height: H, borderRadius: 22, background: "rgba(255,255,255,.04)", border: "1px solid rgba(244,246,242,.12)", padding: "28px 30px", display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: s.color }} />
            <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: rows === 1 ? 110 : 84, lineHeight: 1, color: s.color }}>{s.big}</div>
            <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 25, lineHeight: 1.3, color: C.boardText }}>{s.label}</div>
            <div style={{ marginTop: "auto", fontFamily: F.text, fontSize: 18, color: "rgba(244,246,242,.55)" }}>{s.src}</div>
          </div>
        );
      })}
    </Canvas>
  );
}

export const StatsUS = () => (
  <Stats
    title="The cost of the gaps, in the US"
    sub="Recent figures, 2023 to 2026."
    cols={3}
    foot="Survey and study figures; sources and caveats are listed in the README."
    stats={[
      { big: "25–35%", label: "of US health spending goes to administration", src: "American Hospital Association, 2025", color: C.urgent },
      { big: "13 h", label: "a week per physician on prior authorization, about 40 requests", src: "AMA Prior Authorization Survey, Dec 2025", color: C.waitMid },
      { big: "31 days", label: "average wait for a new-patient appointment, up 19% since 2022", src: "AMN Healthcare, 15 metro areas, 2025", color: C.zone.gold },
      { big: "58%", label: "of insured adults hit a problem using their coverage in a year", src: "KFF Consumer Survey, 2023", color: C.zone.violet },
      { big: "42%", label: "of tests and referrals ordered at in-person visits were not completed on time; 57% after video visits", src: "JAMA Network Open, 2023", color: C.zone.rose },
      { big: "28%", label: "of US adults read at the lowest literacy levels, up from 19% in 2017", src: "NCES, PIAAC 2023 (Dec 2024)", color: C.glow },
    ]}
  />
);

export const StatsWorld = () => (
  <Stats
    title="And worldwide"
    sub="The shape is the same everywhere: specialized departments, and no one connecting them."
    cols={3}
    foot="Sources and caveats are listed in the README."
    stats={[
      { big: "4.6 B", label: "people lack full coverage of essential health services; 2.1 B face financial hardship", src: "WHO and World Bank, UHC Global Monitoring Report, 2025", color: C.urgent },
      { big: "1 in 10", label: "patients is harmed in health care; over 3 million deaths a year from unsafe care", src: "WHO patient safety fact sheet, 2023", color: C.waitMid },
      { big: "11.1 M", label: "health workers short by 2030, as staff and patients age together", src: "WHO health workforce report, 2026", color: C.glow },
    ]}
  />
);

// ---- 6. The hero (animated) ----------------------------------------------------------------------

const CODES = ["IN", "CV", "PA", "SC", "VP", "PM", "WS", "IT", "CO", "OP", "RW", "DS", "FU"];

export function Hero() {
  const f = useCurrentFrame();
  const thread = interpolate(f, [6, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.inOut });
  const step = 82;
  const x0 = 600 - (step * 12) / 2;
  const y = 300;
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: -200, top: -300, width: 900, height: 900, background: "radial-gradient(circle, rgba(45,212,191,.18), transparent 65%)", transform: `translateX(${Math.sin(f * 0.05) * 40}px)` }} />
      <div style={{ position: "absolute", right: -300, top: -200, width: 900, height: 900, background: "radial-gradient(circle, rgba(99,102,241,.16), transparent 65%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
        <span style={{ width: 54, height: 13, background: C.glow }} />
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 104, color: C.boardText, lineHeight: 1 }}>Throughline</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 196, textAlign: "center", fontFamily: F.text, fontWeight: 700, fontSize: 26, color: soft }}>One thread through a hospital visit, from referral to follow-up</div>
      <CometThread d={`M ${x0 - 70} ${y} L ${x0 + step * 12 + 70} ${y}`} progress={thread} color={C.glow} width={5} />
      {CODES.map((c, i) => {
        const x = x0 + i * step;
        const on = thread * (step * 12 + 140) - 70 > x - x0;
        const pulse = (((f - 60) * 0.025) % 1 + 1) % 1;
        const near = f > 60 ? Math.max(0, 1 - Math.abs(pulse * (step * 12 + 140) - 70 - (x - x0)) / 40) : 0;
        return (
          <div key={c} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${1 + 0.18 * near})` }}>
            <Badge code={c} on={on ? 1 : 0} size={50} />
          </div>
        );
      })}
      {f > 60 && (
        <div style={{ position: "absolute", left: x0 - 70 + ((((f - 60) * 0.025) % 1) * (step * 12 + 140)) - 9, top: y - 9, width: 18, height: 18, borderRadius: 9, background: C.glow, boxShadow: `0 0 20px 8px ${C.glow}88` }} />
      )}
    </AbsoluteFill>
  );
}

