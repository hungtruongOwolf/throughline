import type React from "react";
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, F } from "../theme";
import { CometThread, Drift, EZ, useSpring } from "../v2/fx";
import { SignBlade } from "../components/kit";
import { Sfx } from "../components/frames";
import { Badge } from "../scenes/act2";

/**
 * The film's animated scenes, one per voice line. Every moment is placed where the narrator says
 * the matching words, so a scene always fits its line exactly: nothing is cut short or frozen.
 */
export type LineProps = { dur: number; vo: number; text: string };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The frame (from the start of the line) where a phrase is spoken, assuming even pacing. */
export function cue(text: string, phrase: string, vo: number, lead = 4): number {
  const words = text.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  const target = phrase.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  let at = 0;
  for (let i = 0; i <= words.length - target.length; i++) {
    if (target.every((w, k) => words[i + k] === w)) {
      at = i;
      break;
    }
  }
  return Math.max(0, Math.round((vo * at) / Math.max(1, words.length)) - lead);
}

function useIn(at: number) {
  return useSpring(at, { damping: 18, stiffness: 140 });
}
const fadeOut = (f: number, dur: number) => interpolate(f, [dur - 12, dur], [1, 0], clamp);

function Night({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(45,212,191,.10), transparent 65%)" }} />
      {children}
    </AbsoluteFill>
  );
}
function Paper({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${C.rule}55 1px, transparent 1px), linear-gradient(90deg, ${C.rule}55 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      {children}
    </AbsoluteFill>
  );
}

/** A plain label in the brand's sign style. */
function Label({ children, at, x, y, size = 30, color = C.boardText }: { children: ReactNode; at: number; x: number; y: number; size?: number; color?: string }) {
  const e = useIn(at);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, ${(1 - e) * 18}px)`, opacity: e, fontFamily: F.text, fontWeight: 700, fontSize: size, color, whiteSpace: "nowrap", textAlign: "center" }}>
      {children}
    </div>
  );
}

// ---- 1. Millions go to a hospital --------------------------------------------------------

export function Crowds({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const kinds = [
    { label: "Checkup", at: cue(text, "checkup", vo), accent: C.zone.green },
    { label: "Scan", at: cue(text, "scan", vo), accent: C.zone.violet },
    { label: "Emergency", at: cue(text, "emergency", vo), accent: C.urgent },
  ];
  const zoom = interpolate(f, [0, dur], [1.08, 1], { easing: EZ.out });
  return (
    <Night>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, opacity: fadeOut(f, dur) }}>
        <div style={{ position: "absolute", left: 960, top: 560, transform: "translate(-50%, -50%)", width: 1500, opacity: 0.9 }}>
          <Img src={staticFile("clips/campus-halden.png")} style={{ width: 1500, borderRadius: 24, filter: "saturate(.8) brightness(.95)", boxShadow: "0 60px 120px -40px rgba(0,0,0,.7)" }} />
        </div>
        {/* people walking in: dots flowing toward the entrance */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 70 }).map((_, i) => {
            const lane = i % 7;
            const t = ((f * (0.004 + (i % 5) * 0.0012) + i * 0.137) % 1 + 1) % 1;
            const x = 120 + t * 760 + lane * 6;
            const y = 980 - t * 360 + Math.sin(i) * 40;
            return <circle key={i} cx={x} cy={y} r={7} fill={C.boardText} opacity={0.25 + 0.5 * Math.sin(t * Math.PI)} />;
          })}
        </svg>
        {kinds.map((k, i) => {
          const e = useIn(k.at);
          return (
            <div key={k.label} style={{ position: "absolute", left: 1320, top: 260 + i * 120, opacity: e, transform: `translateX(${(1 - e) * 60}px)` }}>
              <SignBlade label={k.label} accent={k.accent} width={360} />
            </div>
          );
        })}
      </AbsoluteFill>
      {kinds.map((k) => (
        <Sfx key={k.label} at={k.at + 4} name="tick-a" volume={0.25} />
      ))}
    </Night>
  );
}

// ---- 2. Not knowing where to go ----------------------------------------------------------

const MAZE = [
  { x: 380, y: 240, rot: -8, label: "Imaging", arrow: 0 },
  { x: 980, y: 200, rot: 6, label: "Lab", arrow: 180 },
  { x: 1520, y: 260, rot: -4, label: "Clinic 2A", arrow: 90 },
  { x: 300, y: 560, rot: 5, label: "Registration", arrow: 270 },
  { x: 1600, y: 560, rot: -7, label: "Pharmacy", arrow: 0 },
  { x: 420, y: 860, rot: 7, label: "Elevator B", arrow: 180 },
  { x: 1000, y: 900, rot: -5, label: "Infusion", arrow: 90 },
  { x: 1540, y: 860, rot: 4, label: "Billing", arrow: 270 },
];

function Maze({ dim = 0, route = 0 }: { dim?: number; route?: number }) {
  const f = useCurrentFrame();
  return (
    <>
      {MAZE.map((m, i) => (
        <div key={m.label} style={{ position: "absolute", left: m.x, top: m.y, transform: `translate(-50%, -50%) rotate(${m.rot + Math.sin(f * 0.02 + i) * 1.5}deg)`, opacity: 1 - dim * 0.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, background: C.ink, border: "1px solid rgba(244,246,242,.2)", borderRadius: 6, padding: "16px 24px", color: C.boardText, fontFamily: F.display, fontWeight: 700, fontSize: 34, boxShadow: "0 20px 40px -20px rgba(0,0,0,.8)" }}>
            {m.label}
            <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: `rotate(${m.arrow}deg)` }}>
              <path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.8" fill="none" />
            </svg>
          </div>
        </div>
      ))}
      {route > 0 && <CometThread d="M 960 560 C 1100 560, 1180 420, 1420 330 S 1520 260, 1520 260" progress={route} />}
    </>
  );
}

function Person({ x, y, size = 120, color = C.boardText, spin = 0 }: { x: number; y: number; size?: number; color?: string; spin?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ position: "absolute", left: x - size / 2, top: y - size / 2, transform: `rotate(${spin}deg)` }}>
      <circle cx="12" cy="7" r="4" fill={color} />
      <path d="M4 22c0-5 3.5-8 8-8s8 3 8 8" fill={color} />
    </svg>
  );
}

export function Lost({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const qs = [
    { q: "Where to go?", at: cue(text, "where to go", vo) },
    { q: "Who to ask?", at: cue(text, "who to ask", vo) },
    { q: "What comes next?", at: cue(text, "what comes next", vo) },
  ];
  const look = Math.sin(f * 0.05) * 25;
  return (
    <Night>
      <AbsoluteFill style={{ opacity: fadeOut(f, dur) }}>
        <Drift seed="maze" amp={10}>
          <Maze />
        </Drift>
        <Person x={960} y={560} size={130} spin={look * 0.2} />
        {qs.map((q, i) => {
          const e = useIn(q.at);
          return (
            <div key={q.q} style={{ position: "absolute", left: 960 + (i - 1) * 300, top: 420 - (i % 2) * 40, transform: `translate(-50%, ${(1 - e) * 20}px)`, opacity: e, background: C.heldBg, color: C.held, border: `2px solid ${C.held}`, borderRadius: 999, padding: "10px 22px", fontFamily: F.text, fontWeight: 700, fontSize: 28, whiteSpace: "nowrap" }}>
              {q.q}
            </div>
          );
        })}
      </AbsoluteFill>
      {qs.map((q) => (
        <Sfx key={q.q} at={q.at + 4} name="tick-b" volume={0.22} />
      ))}
    </Night>
  );
}

// ---- 3. My family has lived this ---------------------------------------------------------

function Panel({ at, title, children }: { at: number; title: string; children: ReactNode }) {
  const e = useIn(at);
  return (
    <div style={{ width: 470, height: 520, background: "#0e1526", border: "1px solid rgba(244,246,242,.12)", borderRadius: 14, opacity: e, transform: `translateY(${(1 - e) * 50}px)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "40px 30px", boxShadow: "0 40px 80px -40px rgba(0,0,0,.9)" }}>
      <div style={{ height: 330, width: "100%", position: "relative" }}>{children}</div>
      <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, color: C.boardText }}>{title}</div>
    </div>
  );
}

export function Family({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const a = cue(text, "lost track", vo);
  const b = cue(text, "waited weeks", vo);
  const c = cue(text, "never knew", vo);
  const lost = interpolate(f, [a + 20, a + 60], [0, 1], clamp);
  const weeks = Math.min(4, Math.max(1, Math.floor(interpolate(f, [b + 10, b + 70], [1, 4.99], clamp))));
  const ring = (f - c) % 40;
  return (
    <Night>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: fadeOut(f, dur) }}>
        <div style={{ display: "flex", gap: 44 }}>
          <Panel at={a} title="A lost referral">
            <div style={{ position: "absolute", left: 90, top: 10 + lost * 60, width: 240, transform: `rotate(${-6 + lost * 18}deg)`, opacity: 1 - lost * 0.75 }}>
              <Img src={staticFile("assets/maria-referral-fax.png")} style={{ width: 240, filter: "grayscale(1)" }} />
            </div>
          </Panel>
          <Panel at={b} title="Weeks of waiting">
            <div style={{ position: "absolute", left: 85, top: 40, width: 240, height: 250, borderRadius: 14, background: C.panel, overflow: "hidden" }}>
              <div style={{ height: 60, background: C.urgent, color: "#fff", fontFamily: F.text, fontWeight: 700, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>Insurance</div>
              <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 110, color: C.ink, textAlign: "center", lineHeight: 1.3 }}>{weeks}</div>
              <div style={{ fontFamily: F.text, fontSize: 24, color: C.inkSoft, textAlign: "center" }}>{weeks === 1 ? "week" : "weeks"}</div>
            </div>
          </Panel>
          <Panel at={c} title="A call that never came">
            <svg width={200} height={200} viewBox="0 0 24 24" style={{ position: "absolute", left: 135, top: 60, opacity: 0.85 }}>
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" fill="none" stroke={C.boardText} strokeWidth="1.6" />
            </svg>
            {f > c && <div style={{ position: "absolute", left: 235 - ring * 2, top: 160 - ring * 2, width: ring * 4, height: ring * 4, borderRadius: "50%", border: `2px solid ${C.boardText}`, opacity: Math.max(0, 0.3 - ring / 130) }} />}
          </Panel>
        </div>
      </AbsoluteFill>
      <Sfx at={a + 4} name="fax" volume={0.25} />
      <Sfx at={b + 4} name="tick-a" volume={0.25} />
      <Sfx at={c + 4} name="tick-b" volume={0.25} />
    </Night>
  );
}

// ---- 4 and 7. The chain: broken, then connected --------------------------------------------

const LINKS = [
  { label: "Referral", who: "Clinic", accent: C.zone.blue },
  { label: "Insurance", who: "Insurer", accent: C.zone.gold },
  { label: "Visit", who: "Hospital", accent: C.zone.green },
  { label: "Results", who: "Lab", accent: C.zone.rose },
  { label: "Follow-up", who: "Doctor", accent: C.zone.violet },
];
const BW = 280;
const GAP = 76;
const X0 = (1920 - (LINKS.length * BW + (LINKS.length - 1) * GAP)) / 2;
const bx = (i: number) => X0 + i * (BW + GAP);

function Chain({ at, linked = 0, faxPulse = -1 }: { at: (i: number) => number; linked?: number; faxPulse?: number }) {
  const f = useCurrentFrame();
  return (
    <>
      {LINKS.map((l, i) => {
        const e = useIn(at(i));
        return (
          <div key={l.label} style={{ position: "absolute", left: bx(i), top: 470, opacity: e, transform: `translateY(${(1 - e) * 30}px)` }}>
            <SignBlade label={l.label} accent={l.accent} width={BW} />
            <div style={{ marginTop: 18, textAlign: "center", fontFamily: F.text, fontWeight: 700, fontSize: 24, color: "rgba(244,246,242,.6)" }}>{l.who}</div>
            {i === 0 && faxPulse >= 0 && f > faxPulse && (
              <div style={{ position: "absolute", left: BW / 2 - 60, top: -120, width: 120, height: 90, borderRadius: 8, background: C.panel, boxShadow: `0 0 0 ${6 + Math.sin((f - faxPulse) * 0.25) * 4}px rgba(201,151,26,.35)`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.text, fontWeight: 700, fontSize: 26, color: C.ink }}>
                FAX
              </div>
            )}
          </div>
        );
      })}
      {LINKS.slice(1).map((_, i) => {
        const broken = 0.35 + 0.65 * Math.abs(Math.sin(f * 0.21 + i * 1.7));
        return (
          <div key={i} style={{ position: "absolute", left: bx(i) + BW + 12, top: 510, width: GAP - 24, borderTop: `5px ${linked > (i + 1) / LINKS.length ? "solid" : "dashed"} ${linked > (i + 1) / LINKS.length ? C.glow : C.urgent}`, opacity: linked > (i + 1) / LINKS.length ? 1 : broken * Math.min(1, f / 20) }} />
        );
      })}
    </>
  );
}

export function Silos({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const fax = cue(text, "fax", vo);
  return (
    <Night>
      <AbsoluteFill style={{ opacity: fadeOut(f, dur) }}>
        <Drift seed="silos" amp={8}>
          <Chain at={(i) => 6 + i * Math.round(vo * 0.08)} faxPulse={fax} />
        </Drift>
      </AbsoluteFill>
      {LINKS.map((_, i) => (
        <Sfx key={i} at={8 + i * Math.round(vo * 0.08)} name={i % 2 ? "tick-b" : "tick-a"} volume={0.18} />
      ))}
      <Sfx at={fax + 4} name="fax" volume={0.25} />
    </Night>
  );
}

export function Connect({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const c = cue(text, "connected", vo);
  const own = cue(text, "on its own", vo);
  const link = interpolate(f, [c, c + 40], [0, 1], { ...clamp, easing: EZ.inOut });
  const day = interpolate(f, [dur - 30, dur], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Night>
        <Chain at={() => 0} linked={link} />
        <CometThread d={`M ${bx(0) - 80} 512 L ${bx(4) + BW + 80} 512`} progress={link} />
        {LINKS.map((l, i) => {
          const e = useIn(own + i * 5);
          return (
            <div key={l.label} style={{ position: "absolute", left: bx(i) + BW / 2, top: 400, transform: `translate(-50%, -50%) scale(${e})`, opacity: e }}>
              <Badge code={["IN", "PA", "IT", "RW", "FU"][i]!} on={1} size={64} />
            </div>
          );
        })}
      </Night>
      <AbsoluteFill style={{ background: C.paper, opacity: day }} />
      <Sfx at={c} name="whoosh" volume={0.3} />
      {LINKS.map((_, i) => (
        <Sfx key={i} at={own + i * 5} name="tick-a" volume={0.18} />
      ))}
    </AbsoluteFill>
  );
}

// ---- 5 and 6. The price ------------------------------------------------------------------

function Stat({ at, big, unit, color, children }: { at: number; big: string; unit: string; color: string; children?: ReactNode }) {
  const e = useIn(at);
  return (
    <div style={{ width: 640, display: "flex", flexDirection: "column", alignItems: "center", gap: 20, opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}>
      <div style={{ height: 260, display: "flex", alignItems: "center" }}>{children}</div>
      <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 150, lineHeight: 0.9, color }}>{big}</div>
      <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.boardText, opacity: 0.8, textAlign: "center" }}>{unit}</div>
    </div>
  );
}

export function Price({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const a = cue(text, "a quarter", vo);
  const b = cue(text, "thirteen hours", vo);
  const fill = interpolate(f, [a + 10, a + 40], [0, 0.25], { ...clamp, easing: EZ.out });
  const hours = Math.round(interpolate(f, [b + 6, b + 40], [0, 13], clamp));
  return (
    <Night>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 80, opacity: fadeOut(f, dur) }}>
        <Stat at={a} big="¼" unit="of US health spending is estimated waste" color={C.urgent}>
          <svg width={240} height={240} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={40} fill="none" stroke="rgba(244,246,242,.15)" strokeWidth={12} />
            <circle cx={50} cy={50} r={40} fill="none" stroke={C.urgent} strokeWidth={12} strokeDasharray={`${251 * fill} 251`} transform="rotate(-90 50 50)" />
          </svg>
        </Stat>
        <Stat at={b} big={`${hours} h`} unit="a week on prior authorization" color={C.waitMid}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 40px)", gap: 8 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{ width: 40, height: 40, borderRadius: 6, background: i < hours ? C.waitMid : "rgba(244,246,242,.1)" }} />
            ))}
          </div>
        </Stat>
      </AbsoluteFill>
      <Sfx at={a + 4} name="count" volume={0.35} />
      <Sfx at={b + 4} name="count" volume={0.35} />
    </Night>
  );
}

export function Missed({ dur, vo }: LineProps) {
  const f = useCurrentFrame();
  const fall = interpolate(f, [vo * 0.55, vo * 0.85], [0, 1], { ...clamp, easing: EZ.in });
  return (
    <Night>
      <AbsoluteFill style={{ opacity: fadeOut(f, dur) }}>
        <div style={{ position: "absolute", left: 960, top: 230, transform: "translateX(-50%)", fontFamily: F.figure, fontWeight: 600, fontSize: 170, color: C.boardText, opacity: useIn(4) }}>
          <span style={{ color: C.urgent }}>1</span> in 14
        </div>
        <div style={{ position: "absolute", left: 960, top: 430, transform: "translateX(-50%)", fontFamily: F.text, fontWeight: 700, fontSize: 30, color: "rgba(244,246,242,.75)", opacity: useIn(14), whiteSpace: "nowrap" }}>
          abnormal test results never reach the patient
        </div>
        {Array.from({ length: 14 }).map((_, i) => {
          const lost = i === 9;
          const e = useIn(10 + i * 2);
          return (
            <div key={i} style={{ position: "absolute", left: 960 - 7 * 92 + i * 92, top: 620 + (lost ? fall * 420 : 0), width: 70, height: 90, borderRadius: 8, background: lost ? C.urgent : C.panel, opacity: e * (lost ? 1 - fall * 0.8 : 1), transform: `rotate(${lost ? fall * 40 : 0}deg)` }} />
          );
        })}
      </AbsoluteFill>
    </Night>
  );
}

// ---- 8. The product ----------------------------------------------------------------------

const CODES = ["IN", "CV", "PA", "SC", "VP", "PM", "WS", "IT", "CO", "OP", "RW", "DS", "FU"];
const NAMES = ["Intake", "Coverage", "Prior auth", "Scheduling", "Visit prep", "Messaging", "Sensing", "Itinerary", "Companion", "Ops planner", "Results watch", "Discharge", "Follow-up"];

export function Product({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const word = useIn(0);
  const agents = cue(text, "thirteen", vo);
  const up = interpolate(f, [agents - 10, agents + 12], [0, 1], { ...clamp, easing: EZ.inOut });
  const step = 132;
  const x0 = 960 - (step * 12) / 2;
  const thread = interpolate(f, [agents, Math.min(dur - 10, agents + vo * 0.55)], [0, 1], { ...clamp, easing: EZ.inOut });
  return (
    <Paper>
      <AbsoluteFill style={{ opacity: fadeOut(f, dur) }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 470 - up * 270, display: "flex", justifyContent: "center", alignItems: "center", gap: 24, opacity: word, transform: `scale(${1.15 - 0.15 * word - up * 0.25})` }}>
          <span style={{ width: 70, height: 16, background: C.agent }} />
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 170, color: C.ink, lineHeight: 1 }}>Throughline</span>
        </div>
        <CometThread d={`M ${x0 - 100} 600 L ${x0 + step * 12 + 100} 600`} progress={thread} color={C.agent} width={6} />
        {CODES.map((c, i) => {
          const x = x0 + i * step;
          const on = thread * (step * 12 + 200) - 100 > x - x0;
          const e = useIn(agents + 6 + i * 3);
          return (
            <div key={c} style={{ position: "absolute", left: x, top: 600, transform: `translate(-50%, -50%) scale(${e})`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ height: 60 }} />
              <Badge code={c} on={on ? 1 : 0} size={64} />
              <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 17, color: C.ink, opacity: on ? 1 : 0.4, whiteSpace: "nowrap" }}>{NAMES[i]}</div>
            </div>
          );
        })}
      </AbsoluteFill>
      <Sfx at={2} name="impact" volume={0.35} />
      {CODES.map((c, i) => (
        <Sfx key={c} at={agents + 6 + i * 3} name="tick-a" volume={0.08} />
      ))}
    </Paper>
  );
}

// ---- 28-30. Under the hood ---------------------------------------------------------------

type Plug = { label: string; to: string[]; cueText: string; dark?: boolean; x?: number };

function Hood({ dur, vo, text, plugs, highlight }: LineProps & { plugs: Plug[]; highlight?: string[] }) {
  const f = useCurrentFrame();
  const step = 132;
  const x0 = 960 - (step * 12) / 2;
  const ax = (c: string) => x0 + CODES.indexOf(c) * step;
  const rowY = 760;
  const used = new Set(plugs.flatMap((p) => p.to));
  return (
    <Night>
      <AbsoluteFill style={{ opacity: fadeOut(f, dur) }}>
        {CODES.map((c, i) => (
          <div key={c} style={{ position: "absolute", left: ax(c), top: rowY, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity: used.has(c) || highlight?.includes(c) ? 1 : 0.35 }}>
            <Badge code={c} on={used.has(c) ? 1 : 0} size={66} />
            <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 17, color: C.boardText, whiteSpace: "nowrap" }}>{NAMES[i]}</div>
          </div>
        ))}
        {plugs.map((p, i) => {
          const at = cue(text, p.cueText, vo);
          const e = useIn(at);
          const draw = interpolate(f, [at + 4, at + 26], [0, 1], { ...clamp, easing: EZ.inOut });
          const cx = p.x ?? p.to.reduce((s, c) => s + ax(c), 0) / p.to.length;
          const y = 260 + (i % 2) * 110;
          return (
            <div key={p.label}>
              <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
                {p.to.map((c) => (
                  <path key={c} d={`M ${cx} ${y + 30} C ${cx} ${(y + rowY) / 2}, ${ax(c)} ${(y + rowY) / 2}, ${ax(c)} ${rowY - 46}`} stroke={p.dark ? C.boardText : C.glow} strokeOpacity={0.7} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
                ))}
              </svg>
              <div style={{ position: "absolute", left: cx, top: y, transform: `translate(-50%, -50%) translateY(${(1 - e) * 20}px)`, opacity: e, background: p.dark ? "#0e1526" : C.agent, border: `2px solid ${p.dark ? "rgba(244,246,242,.4)" : C.glow}`, color: "#fff", borderRadius: 999, padding: "14px 30px", fontFamily: F.text, fontWeight: 700, fontSize: 30, whiteSpace: "nowrap", boxShadow: p.dark ? "none" : `0 0 30px rgba(45,212,191,.35)` }}>
                {p.label}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
      {plugs.map((p) => (
        <Sfx key={p.label} at={cue(text, p.cueText, vo) + 4} name="tick-b" volume={0.22} />
      ))}
    </Night>
  );
}

export const HoodModels = (p: LineProps) => (
  <Hood
    {...p}
    plugs={[
      { label: "Muse Spark 1.3", to: ["IN", "PA", "PM", "CO", "DS"], cueText: "muse spark", x: 520 },
      { label: "Muse Voice Transcribe", to: ["PM"], cueText: "voice transcribe", x: 960 },
      { label: "SAM 3.1", to: ["WS"], cueText: "segment anything", x: 1400 },
    ]}
  />
);
export const HoodOpen = (p: LineProps) => (
  <Hood
    {...p}
    plugs={[{ label: "Muse Spark Open · open weights · Baseten", to: ["OP"], cueText: "muse spark open" }]}
    highlight={["OP"]}
  />
);
export const HoodRust = (p: LineProps) => (
  <Hood {...p} plugs={[{ label: "Rust engine", to: ["SC", "IT", "OP", "FU"], cueText: "rust", dark: true }]} />
);

// ---- 32-33. The close ---------------------------------------------------------------------

export function Found({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const way = cue(text, "find their way", vo);
  const route = interpolate(f, [way - 20, way + 30], [0, 1], { ...clamp, easing: EZ.inOut });
  return (
    <Night>
      <AbsoluteFill style={{ opacity: fadeOut(f, dur) }}>
        <Maze dim={route} route={route} />
        <Person x={960} y={560} size={130} color={route > 0.95 ? C.glow : C.boardText} />
      </AbsoluteFill>
      <Sfx at={way} name="gate-ok" volume={0.3} />
    </Night>
  );
}

export function Impact({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const items = [
    { t: "Easier for patients", at: cue(text, "easier for patients", vo), icon: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" },
    { t: "Lighter for staff", at: cue(text, "lighter for staff", vo), icon: "M4 12l5 5L20 6" },
    { t: "Reaches more people", at: cue(text, "reaches more people", vo), icon: "M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 2.2-5 5-5s5 2 5 5m0 0c0-3 2.2-5 5-5s5 2 5 5" },
  ];
  const end = vo + 10;
  const card = useSpring(end, { damping: 200 });
  return (
    <Night>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - card }}>
        <div style={{ display: "flex", gap: 60 }}>
          {items.map((it) => {
            const e = useIn(it.at);
            return (
              <div key={it.t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}>
                <div style={{ width: 150, height: 150, borderRadius: 40, background: C.agent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 50px rgba(45,212,191,.35)" }}>
                  <svg width={80} height={80} viewBox="0 0 24 24">
                    <path d={it.icon} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 52, color: C.boardText }}>{it.t}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, transform: `scale(${0.94 + 0.06 * card})` }}>
          <span style={{ width: 70, height: 16, background: C.glow }} />
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 150, color: C.boardText }}>Throughline</span>
        </div>
        <div style={{ marginTop: 30, fontFamily: F.text, fontWeight: 700, fontSize: 32, color: "rgba(244,246,242,.85)" }}>throughline-zeta-ten.vercel.app</div>
        <div style={{ marginTop: 18, fontFamily: F.text, fontSize: 24, color: "rgba(244,246,242,.55)" }}>Built on Muse Spark · Spark Open · SAM 3.1 · Muse Voice Transcribe</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [dur - 25, dur], [0, 1], clamp) }} />
      {items.map((it) => (
        <Sfx key={it.t} at={it.at + 4} name="tick-a" volume={0.25} />
      ))}
      <Sfx at={end} name="impact" volume={0.45} />
    </Night>
  );
}

export const ANIM: Record<number, (p: LineProps) => React.ReactElement> = {
  1: Crowds,
  2: Lost,
  3: Family,
  4: Silos,
  5: Price,
  6: Missed,
  7: Connect,
  8: Product,
  28: HoodModels,
  29: HoodOpen,
  30: HoodRust,
  32: Found,
  33: Impact,
};
