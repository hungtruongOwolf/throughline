import type React from "react";
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { getLength, getPointAtLength } from "@remotion/paths";
import { C, F } from "../theme";
import { CometThread, EZ, useSpring } from "../v2/fx";
import { Sfx } from "../components/frames";
import { Badge } from "../scenes/act2";
import { cue, type LineProps } from "../v4/anim";

/**
 * The film's animated scenes (v5). Each one plays under one voice line and places every moment
 * where the narrator says it. A drifting stage sits under all of them, so no frame is ever still.
 */

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const useIn = (at: number) => useSpring(at, { damping: 16, stiffness: 150 });
const ramp = (f: number, a: number, b: number, easing = EZ.inOut) =>
  interpolate(f, [a, b], [0, 1], { ...cl, easing });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (i: number, k = 1) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ---- the stage -------------------------------------------------------------------------------

/** Soft moving light and slow dust, with a gentle push-in over the whole shot. */
function Stage({ children, dur, light = false, push = 0.05 }: { children: ReactNode; dur: number; light?: boolean; push?: number }) {
  const f = useCurrentFrame();
  const blobs = [
    { c: light ? "rgba(15,118,110,.10)" : "rgba(45,212,191,.16)", s: 1000, k: 0 },
    { c: light ? "rgba(59,111,214,.06)" : "rgba(99,102,241,.13)", s: 900, k: 1 },
    { c: light ? "rgba(201,151,26,.05)" : "rgba(201,151,26,.07)", s: 700, k: 2 },
  ];
  const z = 1 + (push * f) / Math.max(1, dur);
  return (
    <AbsoluteFill style={{ background: light ? C.paper : C.ink, overflow: "hidden" }}>
      {blobs.map((b) => (
        <div
          key={b.k}
          style={{
            position: "absolute",
            width: b.s,
            height: b.s,
            left: 960 + 620 * Math.sin(f * 0.0045 + b.k * 2.1) - b.s / 2,
            top: 540 + 300 * Math.cos(f * 0.0037 + b.k * 1.3) - b.s / 2,
            background: `radial-gradient(circle, ${b.c}, transparent 65%)`,
          }}
        />
      ))}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 40 }).map((_, i) => {
          const sp = 0.3 + rand(i, 3) * 0.6;
          const x = (((rand(i) * 1920 + f * 0.12 * sp) % 1920) + 1920) % 1920;
          const y = (((rand(i, 2) * 1080 - f * 0.4 * sp) % 1080) + 1080) % 1080;
          return <circle key={i} cx={x} cy={y} r={1.2 + rand(i, 4) * 2} fill={light ? C.ink : "#fff"} opacity={(light ? 0.05 : 0.1) + rand(i, 5) * 0.15} />;
        })}
      </svg>
      <AbsoluteFill style={{ transform: `scale(${z})` }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(5,10,20,${light ? 0.1 : 0.45}) 100%)` }} />
    </AbsoluteFill>
  );
}

/** A big line of type that rises out of a mask. */
function Kicker({ at, children, x = 960, y, size = 64, color = C.boardText, align = "center" }: { at: number; children: ReactNode; x?: number; y: number; size?: number; color?: string; align?: "center" | "left" }) {
  const e = useIn(at);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: align === "center" ? "translateX(-50%)" : undefined, overflow: "hidden", paddingBottom: 8 }}>
      <div style={{ transform: `translateY(${(1 - e) * 110}%)`, opacity: Math.min(1, e * 1.5), fontFamily: F.display, fontWeight: 800, fontSize: size, color, whiteSpace: "nowrap", lineHeight: 1.05 }}>{children}</div>
    </div>
  );
}

/** A person; when `walk` is set the legs swing and the body bobs. */
function Walker({ x, y, size = 80, color = C.boardText, walk = 0, phase = 0, opacity = 1 }: { x: number; y: number; size?: number; color?: string; walk?: number; phase?: number; opacity?: number }) {
  const f = useCurrentFrame();
  const sw = Math.sin(f * 0.35 + phase) * 22 * walk;
  const bob = Math.abs(Math.sin(f * 0.35 + phase)) * 2.5 * walk;
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 40 64" style={{ position: "absolute", left: x - size / 2, top: y - size * 1.6 + bob, opacity, overflow: "visible" }}>
      <ellipse cx={20} cy={63} rx={12} ry={2.5} fill="#000" opacity={0.25} />
      <g transform={`rotate(${sw} 20 40)`}>
        <rect x={15} y={38} width={5} height={24} rx={2.5} fill={color} />
      </g>
      <g transform={`rotate(${-sw} 20 40)`}>
        <rect x={20} y={38} width={5} height={24} rx={2.5} fill={color} />
      </g>
      <rect x={11} y={17} width={18} height={25} rx={8} fill={color} />
      <circle cx={20} cy={9} r={7} fill={color} />
    </svg>
  );
}

function Chip({ at, x, y, children, tone = "dim", dim = 1 }: { at: number; x: number; y: number; children: ReactNode; tone?: "dim" | "held" | "teal"; dim?: number }) {
  const e = useIn(at);
  const f = useCurrentFrame();
  const t = {
    dim: { bg: "rgba(14,21,38,.88)", fg: C.boardText, bd: "rgba(244,246,242,.4)" },
    held: { bg: C.heldBg, fg: C.held, bd: C.held },
    teal: { bg: C.agent, fg: "#fff", bd: C.glow },
  }[tone];
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y + Math.sin(f * 0.06 + x) * 3,
        transform: `translate(-50%, -50%) translateY(${(1 - e) * 26}px) scale(${0.9 + 0.1 * e})`,
        opacity: e * dim,
        background: t.bg,
        color: t.fg,
        border: `2px solid ${t.bd}`,
        borderRadius: 999,
        padding: "12px 26px",
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: 30,
        whiteSpace: "nowrap",
        boxShadow: "0 18px 40px -20px rgba(0,0,0,.8)",
      }}
    >
      {children}
    </div>
  );
}

// ---- the hospital's signs (opening and close) -------------------------------------------------

const SIGNS = [
  { x: 380, y: 230, rot: -7, label: "Imaging", arrow: 0, accent: C.zone.violet },
  { x: 960, y: 170, rot: 5, label: "Lab", arrow: 180, accent: C.zone.rose },
  { x: 1520, y: 250, rot: -4, label: "Clinic 2A", arrow: 90, accent: C.zone.blue },
  { x: 290, y: 560, rot: 5, label: "Registration", arrow: 270, accent: C.zone.gold },
  { x: 1620, y: 560, rot: -6, label: "Pharmacy", arrow: 0, accent: C.zone.green },
  { x: 420, y: 880, rot: 6, label: "Elevator B", arrow: 180, accent: C.zone.blue },
  { x: 1000, y: 930, rot: -4, label: "Infusion", arrow: 90, accent: C.zone.violet },
  { x: 1540, y: 870, rot: 4, label: "Billing", arrow: 270, accent: C.zone.gold },
];

function Sign({ s, x, y, opacity = 1, glow = 0 }: { s: (typeof SIGNS)[number]; x: number; y: number; opacity?: number; glow?: number }) {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity, transform: `translate(-50%, -50%) rotate(${s.rot + Math.sin(f * 0.02 + s.x) * 1.5}deg)` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: glow > 0 ? `rgba(15,118,110,${0.4 + 0.6 * glow})` : "#101a30",
          borderLeft: `8px solid ${glow > 0 ? C.glow : s.accent}`,
          borderRadius: 6,
          padding: "16px 24px",
          color: C.boardText,
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 36,
          boxShadow: glow > 0 ? `0 0 ${50 * glow}px rgba(45,212,191,.6)` : "0 24px 40px -20px rgba(0,0,0,.9)",
        }}
      >
        {s.label}
        <svg width="30" height="30" viewBox="0 0 24 24" style={{ transform: `rotate(${s.arrow}deg)` }}>
          <path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.8" fill="none" />
        </svg>
      </div>
    </div>
  );
}

/** A small hospital, lit windows flickering, a door that glows. */
function Building({ f }: { f: number }) {
  const W = 760;
  const cols = 9;
  const rows = 6;
  return (
    <svg width={W + 360} height={560} viewBox={`0 0 ${W + 360} 560`} style={{ overflow: "visible" }}>
      {/* wings */}
      <rect x={0} y={200} width={200} height={340} fill="#1a2742" />
      <rect x={W + 160} y={240} width={200} height={300} fill="#1a2742" />
      {/* main block */}
      <rect x={180} y={60} width={W} height={480} fill="#21304f" />
      <rect x={180} y={60} width={W} height={10} fill="#2c3d61" />
      {Array.from({ length: cols * rows }).map((_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const lit = Math.sin(i * 12.9 + Math.floor((f + i * 7) / 24) * 1.7) > -0.1;
        return <rect key={i} x={220 + c * 82} y={110 + r * 62} width={48} height={34} rx={3} fill={lit ? "rgba(255,214,150,.85)" : "rgba(244,246,242,.07)"} />;
      })}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={`w${i}`} x={i < 4 ? 30 + (i % 2) * 80 : W + 190 + (i % 2) * 80} y={(i < 4 ? 250 : 290) + Math.floor((i % 4) / 2) * 90} width={50} height={34} rx={3} fill={Math.sin(i * 3.3 + Math.floor(f / 30)) > 0 ? "rgba(255,214,150,.7)" : "rgba(244,246,242,.07)"} />
      ))}
      {/* the sign on the roof */}
      <rect x={180 + W / 2 - 60} y={-10} width={120} height={60} rx={8} fill="#fff" />
      <rect x={180 + W / 2 - 10} y={0} width={20} height={40} fill={C.urgent} />
      <rect x={180 + W / 2 - 22} y={10} width={44} height={20} fill={C.urgent} />
      {/* the door */}
      <rect x={180 + W / 2 - 70} y={440} width={140} height={100} rx={6} fill={C.glow} opacity={0.75 + 0.2 * Math.sin(f * 0.1)} />
      <rect x={180 + W / 2 - 70} y={440} width={140} height={100} rx={6} fill="none" stroke="#fff" strokeOpacity={0.5} />
    </svg>
  );
}

// ---- 1. Millions go; few know the way ---------------------------------------------------------

export function Arrival({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const mil = cue(text, "millions", vo);
  const dep = cue(text, "organized around", vo);
  const ins = cue(text, "someone on the inside", vo);
  const med = cue(text, "medical terms", vo);
  const lang = cue(text, "or the language", vo);
  const qs = [
    { q: "Where to go?", at: cue(text, "where to go", vo), x: 660 },
    { q: "Who to ask?", at: cue(text, "who to ask", vo), x: 960 },
    { q: "What comes next?", at: cue(text, "what comes next", vo), x: 1290 },
  ];
  const dive = ramp(f, dep - 4, dep + 26, EZ.in);
  const signsIn = (i: number) => useSpring(dep + 10 + i * 3, { damping: 15, stiffness: 120 });
  const t = Math.max(0, f - med) / 30;
  const px = 960 + 80 * Math.sin(t * 0.9) + 30 * Math.sin(t * 2.3);
  const py = 600 + 36 * Math.sin(t * 1.3);
  const wander = ramp(f, med, med + 20);
  const quiet = interpolate(f, [qs[0]!.at - 6, qs[0]!.at + 12], [1, 0.4], cl);
  return (
    <Stage dur={dur}>
      {/* everyone walks in */}
      <AbsoluteFill style={{ opacity: 1 - dive, transform: `scale(${1 + dive * 2.2})`, transformOrigin: "960px 780px" }}>
        <div style={{ position: "absolute", left: 960 - 560, top: 280 }}>
          <Building f={f} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 820, height: 3, background: "rgba(244,246,242,.12)" }} />
        {Array.from({ length: 28 }).map((_, i) => {
          const side = i % 2;
          const lane = i % 5;
          const k = (((f * (0.0035 + rand(i) * 0.003) + rand(i, 9)) % 1) + 1) % 1;
          const x = side ? lerp(2000, 1010, k) : lerp(-80, 910, k);
          const sz = 44 + lane * 6;
          return <Walker key={i} x={x} y={826 + lane * 30} size={sz} walk={1} phase={i} opacity={Math.min(1, (1 - k) * 8) * 0.9} color={i % 7 === 3 ? C.glow : C.boardText} />;
        })}
        <Kicker at={mil} y={110} size={72}>
          Millions of hospital visits, every year
        </Kicker>
      </AbsoluteFill>
      {/* inside: the signs scatter, and one person stands among them */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: ramp(f, dep + 20, dep + 50) * 0.9 }}>
        {SIGNS.map((s, i) => {
          const n = SIGNS[(i + 3) % SIGNS.length]!;
          return <path key={i} d={`M ${s.x} ${s.y} Q ${(s.x + n.x) / 2 + 160 * Math.sin(i)} ${(s.y + n.y) / 2 + 120 * Math.cos(i)} ${n.x} ${n.y}`} stroke="rgba(244,246,242,.14)" strokeWidth={2} strokeDasharray="6 10" strokeDashoffset={-f * 0.6} fill="none" />;
        })}
      </svg>
      {SIGNS.map((s, i) => {
        const e = signsIn(i);
        return <Sign key={s.label} s={s} x={lerp(960, s.x, e)} y={lerp(600, s.y, e)} opacity={Math.min(1, e * 1.4) * (1 - 0.35 * wander)} />;
      })}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 26 }).map((_, k) => {
          const tk = Math.max(0, f - k * 4 - med) / 30;
          if (f - k * 4 < med) return null;
          return <circle key={k} cx={960 + 80 * Math.sin(tk * 0.9) + 30 * Math.sin(tk * 2.3)} cy={600 + 36 * Math.sin(tk * 1.3)} r={4} fill={C.held} opacity={0.5 * (1 - k / 26)} />;
        })}
      </svg>
      <div style={{ opacity: useIn(dep + 14) }}>
        <Walker x={px} y={py + 60} size={90} walk={wander * 0.8} />
      </div>
      <Chip at={ins} x={490} y={780} dim={quiet}>
        No one on the inside
      </Chip>
      <Chip at={med} x={960} y={780} dim={quiet}>
        Unfamiliar medical terms
      </Chip>
      <Chip at={lang} x={1430} y={780} dim={quiet}>
        Not your language
      </Chip>
      {qs.map((q) => (
        <Chip key={q.q} at={q.at} x={q.x} y={q.x === 960 ? 400 : 430} tone="held">
          {q.q}
        </Chip>
      ))}
      <Sfx at={dep} name="whoosh" volume={0.3} />
      {[ins, med, lang].map((a) => (
        <Sfx key={a} at={a + 4} name="tick-a" volume={0.2} />
      ))}
      {qs.map((q) => (
        <Sfx key={q.q} at={q.at + 4} name="tick-b" volume={0.22} />
      ))}
    </Stage>
  );
}

// ---- 3. My family, and the steps that never meet ------------------------------------------------

function Card({ at, x, title, children }: { at: number; x: number; title: string; children: ReactNode }) {
  const e = useIn(at);
  return (
    <div style={{ position: "absolute", left: x - 200, top: 230, width: 400, perspective: 1200 }}>
      <div
        style={{
          height: 420,
          borderRadius: 18,
          background: "linear-gradient(180deg, #16223b, #0f182b)",
          border: "1px solid rgba(244,246,242,.14)",
          boxShadow: "0 50px 90px -40px rgba(0,0,0,.95)",
          opacity: Math.min(1, e * 1.4),
          transform: `rotateX(${(1 - e) * 60}deg) translateY(${(1 - e) * 60}px)`,
          transformOrigin: "50% 100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0 }}>{children}</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, textAlign: "center", fontFamily: F.display, fontWeight: 700, fontSize: 36, color: C.boardText }}>{title}</div>
      </div>
    </div>
  );
}

const SYSTEMS = [
  { step: "Referral", sys: "Clinic records", who: "Front desk", accent: C.zone.blue },
  { step: "Insurance", sys: "Insurer portal", who: "Insurer", accent: C.zone.gold },
  { step: "Visit", sys: "Hospital scheduling", who: "Scheduler", accent: C.zone.green },
  { step: "Results", sys: "Lab system", who: "Lab", accent: C.zone.rose },
  { step: "Follow-up", sys: "Doctor's inbox", who: "Doctor", accent: C.zone.violet },
];

export function Family({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const a = cue(text, "lost referral", vo);
  const b = cue(text, "weeks waiting", vo);
  const c = cue(text, "results no one", vo);
  const s = cue(text, "each step", vo);
  const fx = cue(text, "by fax", vo);
  const out = ramp(f, s - 6, s + 12);
  const fly = ramp(f, a + 16, a + 46, EZ.in);
  const week = Math.max(1, Math.min(6, 1 + Math.floor(interpolate(f, [b + 6, b + 66], [0, 5.99], cl))));
  const flip = ((f - b) % 11) / 11;
  const W = 300;
  const G = 64;
  const x0 = (1920 - (5 * W + 4 * G)) / 2;
  const faxIn = ramp(f, fx - 8, fx + 16, EZ.out);
  return (
    <Stage dur={dur}>
      <AbsoluteFill style={{ opacity: 1 - out, transform: `scale(${1 - 0.08 * out})` }}>
        <Kicker at={2} y={110} size={64}>
          My family has lived this
        </Kicker>
        <div style={{ position: "absolute", left: 300, top: 760, height: 4, width: 1320 * ramp(f, 0, a + 12), background: "rgba(244,246,242,.25)", borderRadius: 2 }} />
        {[a, b, c].map((at, i) => (
          <div key={i} style={{ position: "absolute", left: 480 + i * 480 - 12, top: 750, width: 24, height: 24, borderRadius: 12, background: f > at ? C.urgent : "rgba(244,246,242,.25)", boxShadow: f > at ? "0 0 20px rgba(180,35,24,.7)" : "none" }} />
        ))}
        <Card at={a} x={480} title="A lost referral">
          <div style={{ position: "absolute", left: 90, top: 40, width: 220, height: 280, border: "3px dashed rgba(244,246,242,.3)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.display, fontWeight: 800, fontSize: 120, color: "rgba(244,246,242,.25)", opacity: fly }}>
            ?
          </div>
          <Img src={staticFile("assets/maria-referral-fax.png")} style={{ position: "absolute", left: 90, top: 40, width: 220, filter: "grayscale(1)", transform: `translate(${fly * 340}px, ${-fly * 160}px) rotate(${-4 + fly * 40}deg)`, opacity: 1 - fly }} />
        </Card>
        <Card at={b} x={960} title="Weeks on insurance">
          <div style={{ position: "absolute", left: 80, top: 40, width: 240, height: 270, borderRadius: 14, background: C.panel, overflow: "hidden", boxShadow: "0 20px 40px -20px rgba(0,0,0,.8)" }}>
            <div style={{ height: 64, background: C.urgent, color: "#fff", fontFamily: F.text, fontWeight: 700, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>Waiting</div>
            <div style={{ transform: f > b + 6 && week < 6 ? `scaleY(${0.75 + 0.25 * Math.min(1, flip * 3)})` : undefined, transformOrigin: "50% 0" }}>
              <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 120, color: C.ink, textAlign: "center", lineHeight: 1.25 }}>{week}</div>
              <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 26, color: C.inkSoft, textAlign: "center" }}>{week === 1 ? "week" : "weeks"}</div>
            </div>
          </div>
        </Card>
        <Card at={c} x={1440} title="No call about results">
          <div style={{ position: "absolute", left: 125, top: 30, width: 150, height: 280, borderRadius: 26, border: "4px solid rgba(244,246,242,.6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 40, color: C.boardText }}>{f > c ? `${Math.min(5, 1 + Math.floor((f - c) / 14))}:00` : "1:00"}</div>
            <div style={{ fontFamily: F.text, fontSize: 18, color: "rgba(244,246,242,.6)", textAlign: "center", padding: "0 12px" }}>No new messages</div>
          </div>
          {f > c &&
            [0, 1].map((k) => {
              const r = ((f - c + k * 20) % 40) / 40;
              return <div key={k} style={{ position: "absolute", left: 200 - 130 * r, top: 170 - 130 * r, width: 260 * r, height: 260 * r, borderRadius: "50%", border: "2px solid rgba(244,246,242,.5)", opacity: 0.4 * (1 - r) }} />;
            })}
        </Card>
      </AbsoluteFill>
      {/* every step in its own system, with gaps between them */}
      <AbsoluteFill style={{ opacity: ramp(f, s - 4, s + 8) }}>
        {SYSTEMS.map((m, i) => {
          const e = useIn(s + 2 + i * 5);
          const isFax = i === 0 && f > fx;
          return (
            <div key={m.step} style={{ position: "absolute", left: x0 + i * (W + G), top: 360, width: W, opacity: e, transform: `translateY(${(1 - e) * 60}px) rotate(${(i - 2) * 1.2 * (1 - e)}deg)` }}>
              <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: isFax ? `0 0 0 ${5 + 3 * Math.sin(f * 0.25)}px rgba(201,151,26,.5), 0 40px 70px -30px rgba(0,0,0,.9)` : "0 40px 70px -30px rgba(0,0,0,.9)" }}>
                <div style={{ height: 46, background: m.accent, display: "flex", alignItems: "center", gap: 8, padding: "0 14px" }}>
                  {[0, 1, 2].map((d) => (
                    <span key={d} style={{ width: 10, height: 10, borderRadius: 5, background: "rgba(255,255,255,.55)" }} />
                  ))}
                  <span style={{ marginLeft: 8, fontFamily: F.text, fontWeight: 700, fontSize: 20, color: "#fff", whiteSpace: "nowrap" }}>{m.sys}</span>
                </div>
                <div style={{ height: 230, background: "#111a2e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
                  <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 46, color: C.boardText }}>{m.step}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: F.text, fontWeight: 700, fontSize: 22, color: "rgba(244,246,242,.6)" }}>
                    <svg width={22} height={22} viewBox="0 0 24 24">
                      <circle cx={12} cy={7} r={4} fill="currentColor" />
                      <path d="M4 22c0-5 3.5-8 8-8s8 3 8 8" fill="currentColor" />
                    </svg>
                    {m.who}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {SYSTEMS.slice(1).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: x0 + (i + 1) * (W + G) - G + 8, top: 490, width: G - 16, borderTop: `5px dashed ${C.urgent}`, opacity: (0.35 + 0.65 * Math.abs(Math.sin(f * 0.2 + i * 1.7))) * ramp(f, s + 20, s + 30) }} />
        ))}
        <Img src={staticFile("assets/maria-referral-fax.png")} style={{ position: "absolute", width: 120, left: lerp(-200, x0 + W - 110, faxIn), top: lerp(80, 330, faxIn), transform: `rotate(${lerp(-30, 8, faxIn)}deg)`, opacity: f > fx - 8 ? 1 : 0, boxShadow: "0 16px 30px -10px rgba(0,0,0,.8)" }} />
      </AbsoluteFill>
      <Sfx at={a + 16} name="whoosh" volume={0.2} />
      <Sfx at={b + 4} name="tick-a" volume={0.22} />
      <Sfx at={c + 4} name="tick-b" volume={0.22} />
      {SYSTEMS.map((m, i) => (
        <Sfx key={m.step} at={s + 4 + i * 5} name={i % 2 ? "tick-b" : "tick-a"} volume={0.14} />
      ))}
      <Sfx at={fx + 4} name="fax" volume={0.28} />
    </Stage>
  );
}

// ---- 5. The price ------------------------------------------------------------------------------

function Column({ at, x, active, big, caption, children }: { at: number; x: number; active: number; big: ReactNode; caption: string; children: ReactNode }) {
  const e = useIn(at);
  return (
    <div
      style={{
        position: "absolute",
        left: x - 260,
        top: 170,
        width: 520,
        height: 700,
        borderRadius: 24,
        background: `rgba(255,255,255,${0.025 + 0.035 * active})`,
        border: `1px solid rgba(244,246,242,${0.08 + 0.12 * active})`,
        opacity: e * (0.45 + 0.55 * active),
        transform: `translateY(${(1 - e) * 70}px) scale(${0.96 + 0.04 * active})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 40,
        gap: 28,
      }}
    >
      <div style={{ height: 300, width: 400, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 116, lineHeight: 1, color: C.boardText }}>{big}</div>
      <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 28, lineHeight: 1.3, color: "rgba(244,246,242,.8)", textAlign: "center", width: 400 }}>{caption}</div>
    </div>
  );
}

export function Stats({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const a = cue(text, "quarter to a third", vo);
  const b = cue(text, "thirteen hours", vo);
  const c = cue(text, "in one recent study", vo);
  const act = (at: number, next: number) => ramp(f, at, at + 10) * (1 - ramp(f, next, next + 14));
  // a quarter to a third: the arc fills to 25%, then reaches on to a third
  const lo = Math.round(25 * ramp(f, a + 6, a + 36, EZ.out));
  const reach = ramp(f, a + 36, a + 60, EZ.out);
  const pct = lo + 8 * reach;
  const hrs = ramp(f, b + 4, b + 56);
  const done = ramp(f, c + 24, c + 60, EZ.out);
  return (
    <Stage dur={dur}>
      <Column at={a} x={380} active={act(a, b)} big={reach > 0.5 ? "25–35%" : `${lo}%`} caption="of US health spending goes to administration">
        <svg width={280} height={280} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={40} fill="none" stroke="rgba(244,246,242,.12)" strokeWidth={11} />
          <circle cx={50} cy={50} r={40} fill="none" stroke={C.urgent} strokeWidth={11} strokeLinecap="round" strokeDasharray={`${(251 * pct) / 100} 251`} transform="rotate(-90 50 50)" style={{ filter: "drop-shadow(0 0 4px rgba(180,35,24,.8))" }} />
        </svg>
      </Column>
      <Column at={b} x={960} active={act(b, c)} big={`${Math.round(13 * hrs)} h`} caption="a week getting insurers to approve tests">
        <svg width={280} height={280} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={44} fill="none" stroke="rgba(244,246,242,.3)" strokeWidth={2.5} />
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={i} x1={50} y1={10} x2={50} y2={15} stroke="rgba(244,246,242,.5)" strokeWidth={2} transform={`rotate(${i * 30} 50 50)`} />
          ))}
          <path d={`M 50 50 L 50 8 A 42 42 0 ${hrs * 13 * 30 > 180 ? 1 : 0} 1 ${50 + 42 * Math.sin(((hrs * 13 * 30) % 360) * (Math.PI / 180))} ${50 - 42 * Math.cos(((hrs * 13 * 30) % 360) * (Math.PI / 180))} Z`} fill={C.waitMid} opacity={hrs > 0 && hrs * 13 < 12 ? 0.3 : 0} />
          <line x1={50} y1={50} x2={50} y2={14} stroke={C.waitMid} strokeWidth={3.5} strokeLinecap="round" transform={`rotate(${hrs * 13 * 30} 50 50)`} />
          <line x1={50} y1={50} x2={50} y2={28} stroke={C.boardText} strokeWidth={3.5} strokeLinecap="round" transform={`rotate(${hrs * 13 * 2.5} 50 50)`} />
          <circle cx={50} cy={50} r={3.5} fill={C.boardText} />
        </svg>
      </Column>
      <Column at={c} x={1540} active={ramp(f, c, c + 10)} big={`${Math.round(58 * done)}%`} caption="of tests and referrals completed on time, in one 2023 study">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 50px)", gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => {
            // 7 of 12 is 58%: those turn teal with a check, the rest stay open
            const ok = i < 7 && done * 7 > i;
            return (
              <div key={i} style={{ width: 50, height: 62, borderRadius: 7, background: ok ? C.agent : "rgba(244,246,242,.14)", border: ok ? `2px solid ${C.glow}` : "2px dashed rgba(244,246,242,.35)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: ok ? "0 0 16px rgba(45,212,191,.45)" : "none" }}>
                {ok && (
                  <svg width={26} height={26} viewBox="0 0 24 24">
                    <path d="M4 12l5 5L20 6" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </Column>
      <Sfx at={a + 4} name="count" volume={0.3} />
      <Sfx at={b + 4} name="count" volume={0.3} />
      <Sfx at={c + 24} name="tick-a" volume={0.2} />
    </Stage>
  );
}

// ---- 8. Throughline -----------------------------------------------------------------------------

const CODES = ["IN", "CV", "PA", "SC", "VP", "PM", "WS", "IT", "CO", "OP", "RW", "DS", "FU"];
const NAMES = ["Intake", "Coverage", "Prior auth", "Scheduling", "Visit prep", "Messaging", "Sensing", "Itinerary", "Companion", "Ops planner", "Results watch", "Discharge", "Follow-up"];

/** Glowing dots that keep running along a straight thread. */
function Pulses({ x1, x2, y, on, color = C.glow, n = 3 }: { x1: number; x2: number; y: number; on: number; color?: string; n?: number }) {
  const f = useCurrentFrame();
  return (
    <>
      {Array.from({ length: n }).map((_, k) => {
        const t = (((f * 0.012 + k / n) % 1) + 1) % 1;
        return <div key={k} style={{ position: "absolute", left: lerp(x1, x2, t) - 8, top: y - 8, width: 16, height: 16, borderRadius: 8, background: color, opacity: on * Math.sin(t * Math.PI), boxShadow: `0 0 18px 6px ${color}88` }} />;
      })}
    </>
  );
}

export function Product({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const mark = ramp(f, 2, 26, EZ.out);
  const agents = cue(text, "thirteen", vo);
  const up = ramp(f, agents - 8, agents + 14);
  const step = 132;
  const x0 = 960 - (step * 12) / 2;
  const thread = ramp(f, agents, Math.min(dur - 20, agents + vo * 0.5));
  const y = 640;
  return (
    <Stage dur={dur} light>
      <div style={{ position: "absolute", left: 0, right: 0, top: lerp(430, 190, up), display: "flex", justifyContent: "center", transform: `scale(${lerp(1.1, 0.78, up)})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, overflow: "hidden" }}>
          <span style={{ width: 80 * mark, height: 18, background: C.agent }} />
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 180, color: C.ink, lineHeight: 1, clipPath: `inset(0 ${100 - mark * 100}% 0 0)` }}>Throughline</span>
        </div>
      </div>
      <Kicker at={agents + 4} y={380} size={44} color={C.inkSoft}>
        Thirteen AI agents, from referral to follow-up
      </Kicker>
      <CometThread d={`M ${x0 - 110} ${y} L ${x0 + step * 12 + 110} ${y}`} progress={thread} color={C.agent} width={6} />
      <Pulses x1={x0 - 110} x2={x0 + step * 12 + 110} y={y} on={ramp(f, agents + vo * 0.5, agents + vo * 0.5 + 10)} color={C.agent} />
      {CODES.map((c, i) => {
        const x = x0 + i * step;
        const on = thread * (step * 12 + 220) - 110 > x - x0;
        const e = useSpring(agents + 4 + i * 3, { damping: 12, stiffness: 160 });
        return (
          <div key={c} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${e}) translateY(${on ? Math.sin(f * 0.08 + i) * 3 : 0}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ height: 60 }} />
            <Badge code={c} on={on ? 1 : 0} size={68} />
            <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 17, color: C.ink, opacity: on ? 1 : 0.4, whiteSpace: "nowrap" }}>{NAMES[i]}</div>
          </div>
        );
      })}
      <Sfx at={2} name="impact" volume={0.35} />
      {CODES.map((c, i) => (
        <Sfx key={c} at={agents + 4 + i * 3} name="tick-a" volume={0.07} />
      ))}
    </Stage>
  );
}

// ---- 9. Agents pass the work; people decide -----------------------------------------------------

const GATES_AFTER: Record<number, string> = { 2: "Insurance request", 9: "Schedule change" };

export function Flow({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const show = cue(text, "let me show you", vo);
  const person = cue(text, "bring in a person", vo);
  // badge and gate positions along the thread
  const step = 112;
  const gap = 92;
  const xs: number[] = [];
  const gates: { x: number; label: string }[] = [];
  let x = 0;
  CODES.forEach((_, i) => {
    xs.push(x);
    if (GATES_AFTER[i]) {
      gates.push({ x: x + (step + gap) / 2, label: GATES_AFTER[i]! });
      x += step + gap;
    } else x += step;
  });
  const span = xs[xs.length - 1]!;
  const off = 960 - span / 2;
  const y = 600;
  // the work moves along, and waits at each gate for a person
  const H = 22;
  const t0 = 8;
  const t1 = Math.max(t0 + 60, show - 8);
  const segs = [gates[0]!.x, gates[1]!.x - gates[0]!.x, span + 60 - gates[1]!.x];
  const move = t1 - t0 - 2 * H;
  const tot = segs.reduce((s, v) => s + v, 0);
  const ta = t0 + (move * segs[0]!) / tot;
  const tb = ta + H + (move * segs[1]!) / tot;
  const px = interpolate(f, [t0, ta, ta + H, tb, tb + H, t1], [-40, gates[0]!.x, gates[0]!.x, gates[1]!.x, gates[1]!.x, span + 60], { ...cl, easing: EZ.inOut });
  const label = px < gates[0]!.x + 1 ? "Referral" : px < gates[1]!.x + 1 ? "Visit plan" : "Results";
  const away = ramp(f, show - 4, show + 12);
  return (
    <Stage dur={dur} light>
      <AbsoluteFill style={{ opacity: 1 - away, transform: `scale(${1 - 0.1 * away}) translateY(${-60 * away}px)` }}>
        <Kicker at={4} x={160} y={170} size={60} color={C.ink} align="left">
          Agents pass the work along.
        </Kicker>
        <Kicker at={Math.max(14, person)} x={160} y={240} size={60} color={C.held} align="left">
          People decide at the gates.
        </Kicker>
        <div style={{ position: "absolute", left: off - 60, top: y - 3, width: (span + 120) * ramp(f, 0, 20), height: 6, background: `${C.agent}55`, borderRadius: 3 }} />
        <div style={{ position: "absolute", left: off - 60, top: y - 3, width: Math.max(0, px + 60), height: 6, background: C.agent, borderRadius: 3, boxShadow: `0 0 16px ${C.glow}` }} />
        {CODES.map((c, i) => {
          const on = px >= xs[i]! ? 1 : 0;
          const e = useSpring(4 + i * 2, { damping: 14, stiffness: 160 });
          return (
            <div key={c} style={{ position: "absolute", left: off + xs[i]!, top: y, transform: `translate(-50%, -50%) scale(${e})` }}>
              <Badge code={c} on={on} size={60} />
            </div>
          );
        })}
        {gates.map((g, k) => {
          const arrive = k === 0 ? ta : tb;
          const ok = f >= arrive + 8;
          const lit = ramp(f, arrive - 4, arrive + 8);
          return (
            <div key={g.label} style={{ position: "absolute", left: off + g.x, top: y - 250, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: useIn(10 + k * 6) }}>
              <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 22, color: C.held, whiteSpace: "nowrap" }}>{g.label}</div>
              <div style={{ width: 78, height: 78, borderRadius: 39, background: ok ? C.agent : C.heldBg, border: `3px solid ${ok ? C.agent : C.held}`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${1 + 0.15 * lit * (1 - Math.min(1, Math.max(0, f - arrive - 8) / 10))})`, boxShadow: lit > 0 && !ok ? `0 0 0 ${10 * lit}px rgba(154,69,7,.15)` : "none" }}>
                {ok ? (
                  <svg width={40} height={40} viewBox="0 0 24 24">
                    <path d="M4 12l5 5L20 6" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width={40} height={40} viewBox="0 0 24 24">
                    <circle cx={12} cy={8} r={4} fill={C.held} />
                    <path d="M4 22c0-5 3.5-8 8-8s8 3 8 8" fill={C.held} />
                  </svg>
                )}
              </div>
              <div style={{ width: 3, height: 120, background: C.held, opacity: 0.5 }} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: off + px, top: y - 74, transform: "translateX(-50%)", background: C.panel, border: `2px solid ${C.agent}`, borderRadius: 10, padding: "8px 18px", fontFamily: F.text, fontWeight: 700, fontSize: 22, color: C.ink, whiteSpace: "nowrap", boxShadow: "0 14px 30px -14px rgba(24,34,58,.6)", opacity: ramp(f, t0, t0 + 6) }}>
          {label}
        </div>
      </AbsoluteFill>
      {/* "Let me show you": the three parts of the demo */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 32 }}>
        {["Before the visit", "The visit day", "After the visit"].map((s, i) => {
          const e = useSpring(show + 2 + i * 5, { damping: 14, stiffness: 150 });
          return (
            <div key={s} style={{ width: 440, height: 140, borderRadius: 12, background: i === 0 ? C.agent : C.panel, border: `2px solid ${C.agent}`, display: "flex", alignItems: "center", gap: 22, padding: "0 32px", opacity: e, transform: `translateY(${(1 - e) * 80}px)`, boxShadow: "0 30px 60px -30px rgba(24,34,58,.6)" }}>
              <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 60, color: i === 0 ? "#fff" : C.agent }}>{i + 1}</span>
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 44, color: i === 0 ? "#fff" : C.ink }}>{s}</span>
            </div>
          );
        })}
      </AbsoluteFill>
      <Sfx at={ta} name="gate-hold" volume={0.25} />
      <Sfx at={ta + 8} name="gate-ok" volume={0.3} />
      <Sfx at={tb} name="gate-hold" volume={0.25} />
      <Sfx at={tb + 8} name="gate-ok" volume={0.3} />
      <Sfx at={show + 2} name="whoosh" volume={0.25} />
    </Stage>
  );
}

// ---- 28. Under the hood -------------------------------------------------------------------------

type Plug = { label: string; note: string; to: string[]; cueText: string; x: number; dark?: boolean };
const PLUGS: Plug[] = [
  { label: "Muse Spark 1.3", note: "reads, writes, sees", to: ["IN", "PA", "PM", "CO", "DS"], cueText: "muse spark reads", x: 300 },
  { label: "Muse Voice Transcribe", note: "voice notes", to: ["PM"], cueText: "voice transcribe", x: 690 },
  { label: "SAM 3.1", note: "counts waiting rooms", to: ["WS"], cueText: "segment anything", x: 1040 },
  { label: "Muse Spark Open", note: "open weights, on Baseten", to: ["OP"], cueText: "muse spark open", x: 1380 },
  { label: "Rust engine", note: "exact schedules", to: ["SC", "IT", "OP", "FU"], cueText: "rust engine", x: 1700, dark: true },
];

export function Hood({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const step = 132;
  const x0 = 960 - (step * 12) / 2;
  const ax = (c: string) => x0 + CODES.indexOf(c) * step;
  const rowY = 800;
  const lit = (c: string) => PLUGS.filter((p) => p.to.includes(c) && f > cue(text, p.cueText, vo) + 20).length > 0;
  return (
    <Stage dur={dur}>
      <Kicker at={2} y={70} size={52} color="rgba(244,246,242,.85)">
        Under the hood
      </Kicker>
      <div style={{ position: "absolute", left: x0 - 90, top: rowY - 70, width: step * 12 + 180, height: 150, borderRadius: 24, background: "rgba(255,255,255,.035)", border: "1px solid rgba(244,246,242,.08)" }} />
      {CODES.map((c, i) => (
        <div key={c} style={{ position: "absolute", left: ax(c), top: rowY, transform: "translate(-50%, -50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity: lit(c) ? 1 : 0.45 }}>
          <Badge code={c} on={lit(c) ? 1 : 0} size={66} />
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 17, color: C.boardText, whiteSpace: "nowrap" }}>{NAMES[i]}</div>
        </div>
      ))}
      {PLUGS.map((p, i) => {
        const at = cue(text, p.cueText, vo);
        const e = useIn(at);
        const draw = ramp(f, at + 4, at + 24);
        const y = 250 + (i % 2) * 130;
        const color = p.dark ? C.boardText : C.glow;
        return (
          <div key={p.label}>
            <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
              {p.to.map((c, k) => {
                const d = `M ${p.x} ${y + 50} C ${p.x} ${(y + rowY) / 2}, ${ax(c)} ${(y + rowY) / 2 - 40}, ${ax(c)} ${rowY - 46}`;
                const len = getLength(d);
                const t = (((f - at) * 0.02 + k * 0.3) % 1 + 1) % 1;
                const pt = getPointAtLength(d, len * t) ?? { x: 0, y: 0 };
                return (
                  <g key={c}>
                    <path d={d} stroke={color} strokeOpacity={0.55} strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
                    {draw >= 1 && <circle cx={pt.x} cy={pt.y} r={5} fill={color} opacity={0.9} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />}
                  </g>
                );
              })}
            </svg>
            <div style={{ position: "absolute", left: p.x, top: y, transform: `translate(-50%, -50%) translateY(${(1 - e) * 24}px) scale(${0.9 + 0.1 * e})`, opacity: e, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ background: p.dark ? "#0e1526" : C.agent, border: `2px solid ${p.dark ? "rgba(244,246,242,.5)" : C.glow}`, color: "#fff", borderRadius: 999, padding: "14px 30px", fontFamily: F.text, fontWeight: 700, fontSize: 30, whiteSpace: "nowrap", boxShadow: p.dark ? "0 0 30px rgba(244,246,242,.12)" : "0 0 36px rgba(45,212,191,.45)" }}>{p.label}</div>
              <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 22, color: "rgba(244,246,242,.7)", whiteSpace: "nowrap" }}>{p.note}</div>
            </div>
          </div>
        );
      })}
      {PLUGS.map((p) => (
        <Sfx key={p.label} at={cue(text, p.cueText, vo) + 4} name="tick-b" volume={0.22} />
      ))}
    </Stage>
  );
}

// ---- 32-33. The close ---------------------------------------------------------------------------

const ROUTE = "M 960 600 C 1100 600, 1180 500, 1300 420 S 1400 340, 1420 330";

export function Found({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const way = cue(text, "find their way", vo);
  const r = ramp(f, way - 26, way + 14);
  const walk = ramp(f, way + 6, Math.min(dur - 14, way + 70), EZ.inOut);
  const len = getLength(ROUTE);
  const pt = getPointAtLength(ROUTE, len * walk) ?? { x: 960, y: 600 };
  const target = SIGNS.findIndex((s) => s.label === "Clinic 2A");
  return (
    <Stage dur={dur}>
      {SIGNS.map((s, i) => (
        <Sign key={s.label} s={s} x={s.x} y={s.y} opacity={i === target ? 1 : 1 - 0.65 * r} glow={i === target ? ramp(f, way + 30, way + 60) : 0} />
      ))}
      <CometThread d={ROUTE} progress={r} />
      <Walker x={pt.x} y={pt.y + 50} size={90} walk={walk > 0 && walk < 1 ? 1 : 0} color={walk >= 1 ? C.glow : C.boardText} />
      <Sfx at={way} name="whoosh" volume={0.25} />
      <Sfx at={way + 40} name="gate-ok" volume={0.3} />
    </Stage>
  );
}

export function Impact({ dur, vo, text }: LineProps) {
  const f = useCurrentFrame();
  const items = [
    { t: "Easier for patients", at: cue(text, "easier for patients", vo), icon: "M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" },
    { t: "Lighter for staff", at: cue(text, "lighter for staff", vo), icon: "M4 12l5 5L20 6" },
    { t: "Reaches more people", at: cue(text, "reaches more people", vo), icon: "M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 2.2-5 5-5s5 2 5 5m0 0c0-3 2.2-5 5-5s5 2 5 5" },
  ];
  const end = vo + 12;
  const card = useSpring(end, { damping: 200 });
  const line = ramp(f, end + 6, end + 36);
  return (
    <Stage dur={dur} push={0.03}>
      <div style={{ opacity: 1 - card }}><Kicker at={cue(text, "care gets easier", vo)} y={210} size={56} color="rgba(244,246,242,.8)">
        When the steps connect
      </Kicker></div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - card, transform: `scale(${1 - 0.05 * card})` }}>
        <div style={{ display: "flex", gap: 80, marginTop: 80 }}>
          {items.map((it) => {
            const e = useSpring(it.at, { damping: 12, stiffness: 150 });
            return (
              <div key={it.t} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, opacity: Math.min(1, e * 1.5), transform: `translateY(${(1 - e) * 50}px)` }}>
                <div style={{ width: 160, height: 160, borderRadius: 44, background: C.agent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 ${40 + 20 * Math.sin(f * 0.08)}px rgba(45,212,191,.4)`, transform: `scale(${e})` }}>
                  <svg width={84} height={84} viewBox="0 0 24 24">
                    <path d={it.icon} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 54, color: C.boardText }}>{it.t}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: card }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26, transform: `scale(${0.94 + 0.06 * card})` }}>
          <span style={{ width: 80, height: 18, background: C.glow }} />
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 160, color: C.boardText }}>Throughline</span>
        </div>
        <div style={{ width: 760 * line, height: 3, background: C.glow, marginTop: 18, boxShadow: `0 0 18px ${C.glow}` }} />
        <div style={{ marginTop: 30, fontFamily: F.text, fontWeight: 700, fontSize: 32, color: "rgba(244,246,242,.88)" }}>throughline-zeta-ten.vercel.app</div>
        <div style={{ marginTop: 16, fontFamily: F.text, fontSize: 24, color: "rgba(244,246,242,.6)" }}>Built on Muse Spark, Muse Spark Open, SAM 3.1 and Muse Voice Transcribe</div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#000", opacity: interpolate(f, [dur - 24, dur], [0, 1], cl) }} />
      {items.map((it) => (
        <Sfx key={it.t} at={it.at + 4} name="tick-a" volume={0.25} />
      ))}
      <Sfx at={end} name="impact" volume={0.45} />
    </Stage>
  );
}

export const SCENES: Record<string, (p: LineProps) => React.ReactElement> = { Arrival, Family, Stats, Product, Flow, Hood, Found, Impact };
