import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Audio, Img, interpolate, interpolateColors, Sequence, staticFile, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { getLength, getPointAtLength } from "@remotion/paths";
import { C, F } from "../../theme";
import { Camera, CometThread, Day, Drift, EZ, FULL, LineReveal, Night, Odometer, SP, Shot, TiltScreen, WordSlam, useSpring } from "../fx";
import { Phone, Sfx } from "../../components/frames";
import { GateTag } from "../../components/kit";
import { Badge } from "../../scenes/act2";
import type { Group, SceneProps } from "../types";

/*
 * Group C: from Scheduling to the human gate on visit day.
 * HANDOFF-4, HANDOFF-5, HIT-2, DAY-1, DAY-2, HANDOFF-6, DAY-3, DAY-4, GATE-2.
 */

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ip = (f: number, a: number, b: number, ease = EZ.out) => interpolate(f, [a, b], [0, 1], { ...cl, easing: ease });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ------------------------------------------------------------------ shared bits */

type Tr = "none" | "whip" | "zoom" | "fade";

/** A sub-shot with its own entry and exit transition (8 frames each, overlapping the neighbour). */
function Seg({
  from,
  len,
  tin = "none",
  tout = "none",
  dir = 1,
  id,
  children,
}: {
  from: number;
  len: number;
  tin?: Tr;
  tout?: Tr;
  dir?: 1 | -1;
  id: string;
  children: ReactNode;
}) {
  return (
    <Sequence from={from} durationInFrames={len} premountFor={20}>
      <Move len={len} tin={tin} tout={tout} dir={dir} id={id}>
        {children}
      </Move>
    </Sequence>
  );
}

function Move({ len, tin, tout, dir, id, children }: { len: number; tin: Tr; tout: Tr; dir: 1 | -1; id: string; children: ReactNode }) {
  const f = useCurrentFrame();
  const a = tin === "none" ? 0 : interpolate(f, [0, 8], [1, 0], { ...cl, easing: EZ.out });
  const b = tout === "none" ? 0 : interpolate(f, [len - 8, len], [0, 1], { ...cl, easing: EZ.in });
  let tf = "";
  let blur = 0;
  let op = 1;
  if (tin === "whip") {
    tf += ` translateX(${a * 1920 * dir}px)`;
    blur += a * 70;
  }
  if (tout === "whip") {
    tf += ` translateX(${-b * 1920 * dir}px)`;
    blur += b * 70;
  }
  if (tin === "zoom") {
    tf += ` scale(${1 - 0.35 * a})`;
    op *= 1 - a;
  }
  if (tout === "zoom") {
    tf += ` scale(${1 + 2.2 * b})`;
    op *= 1 - b;
  }
  if (tin === "fade") op *= 1 - a;
  if (tout === "fade") op *= 1 - b;
  const fid = `cblur-${id}`;
  return (
    <>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={fid} x="-10%" y="0" width="120%" height="100%">
          <feGaussianBlur stdDeviation={`${blur} 0`} />
        </filter>
      </svg>
      <AbsoluteFill style={{ transform: tf || undefined, opacity: op, filter: blur > 0.6 ? `url(#${fid})` : undefined }}>{children}</AbsoluteFill>
    </>
  );
}

function Kicker({ children, color = C.inkSoft, size = 24, style }: { children: ReactNode; color?: string; size?: number; style?: CSSProperties }) {
  return (
    <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: size, letterSpacing: "0.14em", textTransform: "uppercase", color, ...style }}>
      {children}
    </div>
  );
}

const TONES = {
  teal: { bg: C.agentTint, fg: C.agent, bd: C.agent },
  glow: { bg: "rgba(45,212,191,.12)", fg: C.glow, bd: C.glow },
  ink: { bg: C.ink, fg: C.boardText, bd: C.ink },
  amber: { bg: C.heldBg, fg: C.held, bd: C.held },
  red: { bg: "rgba(180,35,24,.14)", fg: "#ff6b5e", bd: "#ff6b5e" },
  hot: { bg: "rgba(194,65,12,.16)", fg: "#ff9a5c", bd: "#ff9a5c" },
};

/** A small wayfinding pill that springs in at `at` (absolute frame of the current sequence). */
function Pill({ at, tone = "teal", size = 28, children, style }: { at: number; tone?: keyof typeof TONES; size?: number; children: ReactNode; style?: CSSProperties }) {
  const p = useSpring(at, SP.snappy);
  const t = TONES[tone];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.45,
        padding: `${size * 0.4}px ${size * 0.8}px`,
        borderRadius: 999,
        background: t.bg,
        border: `2px solid ${t.bd}`,
        color: t.fg,
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: size,
        opacity: Math.min(1, p * 1.5),
        transform: `translateY(${(1 - p) * 24}px) scale(${0.85 + 0.15 * p})`,
        transformOrigin: "left center",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Wheelchair({ size = 120, color = C.agent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="26" cy="9" r="5" fill={color} stroke="none" />
      <path d="M26 17v18h16l6 14" />
      <path d="M26 26h13" />
      <path d="M20 30a14 14 0 1 0 20 16" />
    </svg>
  );
}

function Gear({ size = 60, color = C.glow, rot = 0 }: { size?: number; color?: string; rot?: number }) {
  const teeth = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg width={size} height={size} viewBox="-32 -32 64 64" style={{ transform: `rotate(${rot}deg)` }}>
      {teeth.map((a) => (
        <rect key={a} x={-5} y={-30} width={10} height={14} rx={2} fill={color} transform={`rotate(${a})`} />
      ))}
      <circle r={20} fill={color} />
      <circle r={8} fill={C.ink} />
    </svg>
  );
}

/** A badge with a ring burst when it switches on. */
function Node({ code, at, size = 140, dark = false }: { code: string; at: number; size?: number; dark?: boolean }) {
  const f = useCurrentFrame();
  const on = useSpring(at, SP.snappy);
  const ring = ip(f, at, at + 20);
  const col = dark ? C.glow : C.agent;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {f >= at && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: -size * 0.6 * ring,
            top: -size * 0.6 * ring,
            width: size * (1 + 1.2 * ring),
            height: size * (1 + 1.2 * ring),
            borderRadius: size * 0.3,
            border: `3px solid ${col}`,
            opacity: 1 - ring,
          }}
        />
      )}
      <div style={{ filter: dark && on > 0.5 ? `drop-shadow(0 0 24px ${C.glow}88)` : undefined }}>
        <Badge code={code} on={on} size={size} />
      </div>
    </div>
  );
}

/** Cursor on an arc with a click ripple (coordinates of the parent box). */
function Cursor({ from, to, at, travel, clickAt }: { from: [number, number]; to: [number, number]; at: number; travel: number; clickAt: number }) {
  const f = useCurrentFrame();
  const [x0, y0] = from;
  const [x1, y1] = to;
  const mx = (x0 + x1) / 2 - (y1 - y0) * 0.2;
  const my = (y0 + y1) / 2 + (x1 - x0) * 0.2;
  const d = `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}`;
  const p = ip(f, at, at + travel, EZ.inOut);
  const pt = getPointAtLength(d, getLength(d) * p) ?? { x: x0, y: y0 };
  const press = interpolate(f, [clickAt, clickAt + 2, clickAt + 7], [1, 0.82, 1], cl);
  const ring = ip(f, clickAt, clickAt + 16);
  const show = interpolate(f, [at - 4, at + 2], [0, 1], cl);
  return (
    <>
      {f >= clickAt && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: x1 - 70 * ring,
            top: y1 - 70 * ring,
            width: 140 * ring,
            height: 140 * ring,
            borderRadius: "50%",
            border: `4px solid rgba(15,118,110,${1 - ring})`,
          }}
        />
      )}
      <svg
        width="56"
        height="56"
        viewBox="0 0 24 24"
        style={{ position: "absolute", left: pt.x - 6, top: pt.y - 3, opacity: show, transform: `scale(${press})`, transformOrigin: "6px 3px", filter: "drop-shadow(0 8px 12px rgba(0,0,0,.35))" }}
      >
        <path d="M4 2l15 10-6.5 1.4L16 21l-3 1.3-3.4-7.7L4 19z" fill="#fff" stroke="#18223a" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </>
  );
}

/* ------------------------------------------------------------------ HANDOFF-4: Scheduling, a Rust engine */

const BX = 110;
const BY = 190;
const COLW = 250;
const ROW = (r: number) => BY + 100 + r * 118;
const DAYS = ["Mon 16", "Tue 17", "Wed 18", "Thu 19", "Fri 20"];
const H4_CHIPS = [
  { name: "Labs", day: 0, row: 1, color: C.zone.blue, time: "08:30" },
  { name: "CT scan", day: 2, row: 3, color: C.zone.violet, time: "09:15" },
  { name: "Clinic", day: 3, row: 0, color: C.zone.green, time: "10:40" },
  { name: "Infusion", day: 4, row: 4, color: C.zone.rose, time: "11:30" },
  { name: "Pharmacy", day: 1, row: 2, color: C.zone.gold, time: "12:30" },
];

function H4Intro() {
  const f = useCurrentFrame();
  return (
    <Day>
      <Drift seed="h4a" amp={10}>
        <CometThread d="M -60 540 C 260 560, 420 520, 640 540" progress={ip(f, 0, 18, EZ.inOut)} color={C.agent} width={7} />
        <div style={{ position: "absolute", left: 640, top: 465 }}>
          <Node code="SC" at={14} size={150} />
        </div>
        <div style={{ position: "absolute", left: 840, top: 440 }}>
          <LineReveal lines={["Scheduling"]} at={12} size={160} color={C.ink} />
        </div>
        <div style={{ position: "absolute", left: 846, top: 400, opacity: ip(f, 20, 30) }}>
          <Kicker>Before the visit</Kicker>
        </div>
      </Drift>
    </Day>
  );
}

function H4Board({ len }: { len: number }) {
  const f = useCurrentFrame();
  const focus = ip(f, 72, 84, EZ.inOut);
  const push = interpolate(f, [0, len], [1, 1.06], cl);
  const rust = useSpring(34, SP.snappy);
  const times = ip(f, 76, 86);
  const thread = ip(f, 80, 102, EZ.inOut);
  const tx = BX + COLW + 10;
  return (
    <Day>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "35% 50%" }}>
        <Drift seed="h4b" amp={6}>
          <div style={{ position: "absolute", left: BX, top: 108 }}>
            <Kicker>Week of November 16</Kicker>
          </div>
          {/* columns */}
          {DAYS.map((d, i) => {
            const tue = i === 1;
            return (
              <div
                key={d}
                style={{
                  position: "absolute",
                  left: BX + i * COLW,
                  top: BY,
                  width: COLW - 10,
                  height: 690,
                  borderRadius: 14,
                  background: tue ? interpolateColors(focus, [0, 1], [C.panel, C.agentTint]) : C.panel,
                  border: `2px solid ${tue ? interpolateColors(focus, [0, 1], [C.rule, C.agent]) : C.rule}`,
                  opacity: tue ? 1 : 1 - 0.5 * focus,
                }}
              >
                <div style={{ padding: "22px 0 0 22px", fontFamily: F.display, fontWeight: 700, fontSize: 40, color: tue && focus > 0.5 ? C.agent : C.ink }}>{d}</div>
              </div>
            );
          })}
          {/* the thread through the day */}
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <path
              d={`M ${tx} ${ROW(0) - 20} L ${tx} ${ROW(4) + 116}`}
              stroke={C.agent}
              strokeWidth={6}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - thread}
            />
          </svg>
          {H4_CHIPS.map((c, i) => {
            const pop = useSpring(4 + i * 3, SP.snappy);
            const snap = useSpring(51 + i * 5, SP.snappy);
            const x0 = BX + c.day * COLW + 10;
            const y0 = ROW(c.row);
            const x1 = BX + COLW + 22;
            const y1 = ROW(i);
            const x = lerp(x0, x1, snap);
            const y = lerp(y0, y1, snap) - Math.sin(Math.PI * Math.min(1, snap)) * 110;
            return (
              <div
                key={c.name}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: COLW - 44,
                  height: 96,
                  borderRadius: 12,
                  background: C.panel,
                  borderLeft: `10px solid ${c.color}`,
                  boxShadow: `0 ${10 + 30 * Math.sin(Math.PI * Math.min(1, snap))}px ${24 + 30 * Math.sin(Math.PI * Math.min(1, snap))}px -14px rgba(24,34,58,.35)`,
                  padding: "14px 18px",
                  opacity: Math.min(1, pop * 1.5),
                  transform: `scale(${0.8 + 0.2 * pop})`,
                  zIndex: 2,
                }}
              >
                <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 28, color: C.ink }}>{c.name}</div>
                <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 26, color: C.agent, opacity: times }}>{c.time}</div>
              </div>
            );
          })}
          {/* Rust engine card */}
          <div
            style={{
              position: "absolute",
              left: 1430,
              top: 300,
              width: 400,
              padding: "30px 34px",
              borderRadius: 18,
              background: C.ink,
              boxShadow: "0 40px 80px -40px rgba(24,34,58,.7)",
              opacity: Math.min(1, rust * 1.5),
              transform: `translateX(${(1 - rust) * 160}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <Gear size={64} rot={f * 3} />
              <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 70, color: C.boardText, lineHeight: 1 }}>Rust engine</div>
            </div>
            <Kicker color={C.glow} size={20} style={{ marginTop: 18 }}>
              Not a language model
            </Kicker>
          </div>
          <div style={{ position: "absolute", left: 1434, top: 560 }}>
            <WordSlam text="Exact." at={95} size={150} color={C.ink} />
          </div>
        </Drift>
      </AbsoluteFill>
    </Day>
  );
}

function Handoff4({ dur }: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Seg from={0} len={49} tout="whip" id="h4a">
        <H4Intro />
      </Seg>
      <Seg from={41} len={dur - 41} tin="whip" id="h4b">
        <H4Board len={dur - 41} />
      </Seg>
      <Sfx at={10} name="tick-a" volume={0.25} />
      <Sfx at={36} name="whoosh" volume={0.3} />
      <Sfx at={75} name="tick-b" volume={0.3} />
      {H4_CHIPS.map((_, i) => (
        <Sfx key={i} at={98 + i * 5} name="tick-a" volume={0.22} />
      ))}
      <Sfx at={136} name="ping" volume={0.22} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ HANDOFF-5: the voice note, the reroute */

function H5Voice() {
  const f = useCurrentFrame();
  const talking = f < 50;
  const word = useSpring(52, SP.snappy);
  const tilt = interpolate(f, [0, 79], [-6, 2], cl);
  return (
    <Day>
      <Sequence from={2} durationInFrames={45} layout="none">
        <Audio src={staticFile("assets/maria-reply.wav")} volume={(t) => 0.28 * interpolate(t, [0, 4, 36, 45], [0, 1, 1, 0], cl)} />
      </Sequence>
      <Drift seed="h5a" amp={10}>
        <div style={{ position: "absolute", left: 300, top: 120, transform: `perspective(1800px) rotateY(${tilt}deg)` }}>
          <Phone width={380}>
            <div style={{ position: "absolute", left: 30, right: 30, top: 70 }}>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 40, color: C.ink }}>Maria Diaz</div>
              <Kicker size={16} style={{ marginTop: 6 }}>
                Voice note
              </Kicker>
            </div>
            {/* the note bubble with a live waveform */}
            <div style={{ position: "absolute", left: 22, right: 22, top: 190, height: 120, borderRadius: 24, background: C.agentTint, display: "flex", alignItems: "center", gap: 6, padding: "0 20px" }}>
              <div style={{ width: 52, height: 52, borderRadius: 26, background: C.agent, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {talking ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ width: 6, height: 20, background: "#fff", borderRadius: 2 }} />
                    <div style={{ width: 6, height: 20, background: "#fff", borderRadius: 2 }} />
                  </div>
                ) : (
                  <svg width={22} height={22} viewBox="0 0 10 10">
                    <path d="M2 1 L9 5 L2 9 Z" fill="#fff" />
                  </svg>
                )}
              </div>
              {Array.from({ length: 18 }).map((_, i) => {
                const n = Math.abs(noise2D("wf", i * 0.6, f * 0.25));
                const h = talking ? 10 + n * 70 : 10 + Math.abs(noise2D("wf", i * 0.6, 12)) * 30;
                const played = i / 18 < Math.min(1, f / 50);
                return <div key={i} style={{ flex: 1, height: h, borderRadius: 3, background: played ? C.agent : `${C.agent}55` }} />;
              })}
            </div>
            {/* transcript, one word lit */}
            <div style={{ position: "absolute", left: 30, right: 30, top: 350, display: "flex", flexDirection: "column", gap: 18, opacity: ip(f, 30, 42) }}>
              <div style={{ height: 16, width: "92%", borderRadius: 8, background: C.rule }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ height: 16, width: 70, borderRadius: 8, background: C.rule }} />
                <div
                  style={{
                    padding: "6px 14px",
                    borderRadius: 10,
                    fontFamily: F.text,
                    fontWeight: 700,
                    fontSize: 26,
                    color: word > 0.5 ? "#fff" : C.inkSoft,
                    background: word > 0.5 ? C.agent : "transparent",
                    transform: `scale(${1 + 0.15 * Math.sin(Math.PI * Math.min(1, word))})`,
                  }}
                >
                  wheelchair
                </div>
                <div style={{ height: 16, flex: 1, borderRadius: 8, background: C.rule }} />
              </div>
              <div style={{ height: 16, width: "64%", borderRadius: 8, background: C.rule }} />
            </div>
          </Phone>
        </div>
        <div style={{ position: "absolute", left: 860, top: 220 }}>
          <LineReveal lines={["Voice note"]} at={6} size={140} color={C.ink} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 860,
            top: 440,
            display: "flex",
            alignItems: "center",
            gap: 30,
            opacity: Math.min(1, word * 1.5),
            transform: `translateX(${(1 - word) * -120}px) scale(${0.8 + 0.2 * word})`,
            transformOrigin: "left center",
          }}
        >
          <div style={{ width: 170, height: 170, borderRadius: 85, background: C.agent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 ${16 * word}px ${C.agent}22` }}>
            <Wheelchair size={110} color="#fff" />
          </div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 130, color: C.agent, lineHeight: 1 }}>wheelchair</div>
        </div>
        <div style={{ position: "absolute", left: 866, top: 660 }}>
          <Pill at={62} tone="teal" size={26}>
            Muse Voice Transcribe
          </Pill>
        </div>
      </Drift>
    </Day>
  );
}

const ROUTE = "M 230 898 L 1290 898 L 1290 530 L 1720 530";
const GHOST = "M 230 898 L 640 898 L 960 530 L 1720 530";

function H5Route({ len }: { len: number }) {
  const f = useCurrentFrame();
  const link = ip(f, 18, 34, EZ.inOut);
  const ghost = ip(f, 38, 52, EZ.inOut);
  const ghostOut = ip(f, 58, 72);
  const xOut = ip(f, 56, 66);
  const route = ip(f, 60, 104, EZ.inOut);
  const rl = getLength(ROUTE);
  const head = getPointAtLength(ROUTE, rl * Math.max(0.001, route)) ?? { x: 230, y: 898 };
  const car = interpolate(head.y, [530, 898], [0, 1], cl);
  const push = interpolate(f, [0, len], [1, 1.05], cl);
  const steps = Array.from({ length: 7 }, (_, i) => i);
  const sx = 640;
  const sw = 320 / 7;
  const sh = 368 / 7;
  const stairs = `M ${sx} 930 ` + steps.map((i) => `L ${sx + i * sw} ${930 - (i + 1) * sh} L ${sx + (i + 1) * sw} ${930 - (i + 1) * sh}`).join(" ");
  return (
    <Day>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "67% 70%" }}>
        <Drift seed="h5b" amp={6}>
          {/* the handoff row */}
          <div style={{ position: "absolute", left: 160, top: 100, display: "flex", alignItems: "center", gap: 24 }}>
            <Node code="PM" at={2} size={100} />
            <LineReveal lines={["Messaging"]} at={4} size={72} color={C.ink} />
          </div>
          <div style={{ position: "absolute", left: 1000, top: 100, display: "flex", alignItems: "center", gap: 24 }}>
            <Node code="IT" at={34} size={100} />
            <LineReveal lines={["Itinerary"]} at={36} size={72} color={C.ink} />
          </div>
          <CometThread d="M 590 150 L 990 150" progress={link} color={C.agent} width={6} />
          {/* building section */}
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <rect x={140} y={930} width={1640} height={16} rx={8} fill={C.ink} opacity={0.85} />
            <rect x={960} y={562} width={820} height={16} rx={8} fill={C.ink} opacity={0.85} />
            <rect x={140} y={562} width={500} height={16} rx={8} fill={C.ink} opacity={0.25} />
            {/* stairs */}
            <path d={stairs} stroke={C.inkSoft} strokeWidth={8} fill="none" strokeLinejoin="round" opacity={1 - 0.6 * xOut} />
            {/* elevator shaft and car */}
            <rect x={1222} y={500} width={136} height={430} rx={8} fill={C.ink} fillOpacity={0.06} stroke={C.ink} strokeOpacity={0.4} strokeWidth={3} />
            <rect x={1236} y={500 + 330 * car + 14} width={108} height={86} rx={6} fill={C.agentTint} stroke={C.agent} strokeWidth={3} opacity={0.4 + 0.6 * ip(f, 56, 64)} />
            {/* the ghost route over the stairs */}
            <path d={GHOST} stroke={C.inkSoft} strokeWidth={5} fill="none" strokeDasharray="14 14" opacity={(ghost > 0 ? 0.7 : 0) * (1 - ghostOut)} pathLength={1000} strokeDashoffset={1000 * (1 - ghost)} />
            <g transform="translate(800 745)" opacity={xOut}>
              <path
                d="M -70 -70 L 70 70 M 70 -70 L -70 70"
                stroke={C.urgent}
                strokeWidth={16}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - xOut}
              />
            </g>
          </svg>
          <CometThread d={ROUTE} progress={route} color={C.agent} width={8} />
          {route > 0.001 && (
            <div style={{ position: "absolute", left: head.x - 36, top: head.y - 84, opacity: ip(f, 60, 66) }}>
              <Wheelchair size={72} />
            </div>
          )}
          <div style={{ position: "absolute", left: 160, top: 962 }}>
            <Kicker>Entrance</Kicker>
          </div>
          <div style={{ position: "absolute", left: 1220, top: 962 }}>
            <Kicker>Elevator</Kicker>
          </div>
          <div style={{ position: "absolute", left: 700, top: 962, opacity: xOut }}>
            <Kicker color={C.urgent}>Stairs</Kicker>
          </div>
          <div
            style={{
              position: "absolute",
              left: 1500,
              top: 400,
              padding: "12px 26px",
              borderRadius: 10,
              background: C.ink,
              color: C.boardText,
              fontFamily: F.display,
              fontWeight: 700,
              fontSize: 44,
              opacity: ip(f, 30, 40),
            }}
          >
            Clinic · Level 2
          </div>
          <div style={{ position: "absolute", left: 1400, top: 610 }}>
            <Pill at={100} tone="teal" size={30}>
              Step-free route
            </Pill>
          </div>
        </Drift>
      </AbsoluteFill>
    </Day>
  );
}

function Handoff5({ dur }: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Seg from={0} len={79} tout="whip" id="h5a">
        <H5Voice />
      </Seg>
      <Seg from={71} len={dur - 71} tin="whip" id="h5b">
        <H5Route len={dur - 71} />
      </Seg>
      <Sfx at={52} name="ping" volume={0.35} />
      <Sfx at={66} name="whoosh" volume={0.3} />
      <Sfx at={105} name="tick-a" volume={0.25} />
      <Sfx at={127} name="gate-hold" volume={0.22} />
      <Sfx at={131} name="tick-b" volume={0.25} />
      <Sfx at={171} name="ping" volume={0.22} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ HIT-2: the visit day dawns */

const DATES = [
  { d: 13, w: "Friday" },
  { d: 14, w: "Saturday" },
  { d: 15, w: "Sunday" },
  { d: 16, w: "Monday" },
  { d: 17, w: "Tuesday" },
];

function Hit2() {
  const f = useCurrentFrame();
  const bg = interpolateColors(f, [0, 20, 38, 50], [C.ink, "#36385a", "#f0c79e", C.paper]);
  const sunY = interpolate(f, [0, 44], [1250, 560], { ...cl, easing: EZ.out });
  const idx = Math.min(4, Math.floor(f / 6));
  const local = f - idx * 6;
  const roll = idx < 4 ? interpolate(local, [0, 3], [1, 0], cl) : interpolate(f, [24, 30], [1, 0], { ...cl, easing: EZ.out });
  const land = f >= 30 ? 1 + 0.06 * Math.exp(-(f - 30) / 4) * Math.cos((f - 30) * 0.8) : 1;
  const zoom = interpolate(f, [45, 60], [1, 7], { ...cl, easing: EZ.in });
  const cardIn = useSpring(0, SP.snappy);
  const hh = Math.floor(interpolate(f, [0, 30], [5 * 60 + 40, 8 * 60], cl));
  const clock = `${String(Math.floor(hh / 60)).padStart(2, "0")}:${String(hh % 60).padStart(2, "0")}`;
  const cur = DATES[idx]!;
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      {/* sun and slow rays */}
      <div
        style={{
          position: "absolute",
          left: 960 - 900,
          top: sunY - 900,
          width: 1800,
          height: 1800,
          borderRadius: "50%",
          background: `repeating-conic-gradient(from ${f * 1.5}deg, rgba(255,240,210,.10) 0deg 6deg, transparent 6deg 18deg)`,
          opacity: ip(f, 6, 30),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 960 - 260,
          top: sunY - 260,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, #fff6e3 0%, #ffd9a0 45%, rgba(255,200,140,0) 72%)",
        }}
      />
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "960px 520px", opacity: interpolate(f, [54, 60], [1, 0], cl) }}>
        <div
          style={{
            position: "absolute",
            left: 960 - 230,
            top: 260,
            width: 460,
            height: 520,
            borderRadius: 26,
            background: C.panel,
            overflow: "hidden",
            boxShadow: "0 60px 120px -40px rgba(0,0,0,.55)",
            transform: `translateY(${(1 - cardIn) * 300}px) scale(${land})`,
          }}
        >
          <div style={{ height: 96, background: C.agent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Kicker color="#fff" size={30}>
              November
            </Kicker>
          </div>
          <div style={{ height: 300, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              style={{
                fontFamily: F.figure,
                fontWeight: 600,
                fontSize: 280,
                lineHeight: 1,
                color: idx === 4 ? C.ink : C.inkSoft,
                transform: `translateY(${roll * 60}%)`,
                opacity: 1 - roll * 0.8,
                filter: `blur(${roll * 8}px)`,
              }}
            >
              {cur.d}
            </div>
          </div>
          <div style={{ textAlign: "center", fontFamily: F.display, fontWeight: 700, fontSize: 64, color: idx === 4 ? C.agent : C.inkSoft }}>{cur.w}</div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 820, textAlign: "center", fontFamily: F.figure, fontWeight: 600, fontSize: 64, color: interpolateColors(f, [0, 38], [C.boardText, C.ink]), opacity: ip(f, 4, 14) }}>
          {clock}
        </div>
      </AbsoluteFill>
      {[0, 6, 12, 18, 24].map((t) => (
        <Sfx key={t} at={t} name="tick-b" volume={0.18} />
      ))}
      <Sfx at={30} name="bell" volume={0.25} />
      <Sfx at={45} name="whoosh" volume={0.25} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ DAY-1: CT 1 goes down */

function D1Title() {
  const f = useCurrentFrame();
  return (
    <Day>
      <Drift seed="d1a" amp={10}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 20 }}>
          <WordSlam text="Visit day" at={0} size={240} color={C.ink} stagger={5} />
          <div style={{ opacity: ip(f, 8, 18) }}>
            <Kicker size={30} color={C.agent}>
              Tuesday · November 17
            </Kicker>
          </div>
        </AbsoluteFill>
      </Drift>
    </Day>
  );
}

function Person({ color }: { color: string }) {
  return (
    <svg width={52} height={62} viewBox="0 0 52 62">
      <circle cx={26} cy={14} r={11} fill={color} />
      <path d="M4 60 C4 36, 48 36, 48 60 Z" fill={color} />
    </svg>
  );
}

function D1Scanners({ len }: { len: number }) {
  const f = useCurrentFrame();
  const DOWN = 45;
  const flick = [0, 0.9, 0.2, 1, 0.5, 1];
  const dark = f < DOWN ? 0 : f - DOWN < flick.length ? flick[f - DOWN]! : 1;
  const xs = ip(f, DOWN + 1, DOWN + 11);
  const push = interpolate(f, [0, len], [1, 1.06], cl);
  const n = Math.floor(interpolate(f, [48, 110], [3, 20], cl));
  const fg = interpolateColors(dark, [0, 1], [C.ink, C.boardText]);
  const signs = [
    { name: "CT 1", x: 300, down: true, at: 0 },
    { name: "CT 2", x: 1080, down: false, at: 4 },
  ];
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{ opacity: 1 - dark }}>
        <Day>{null}</Day>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: C.ink, opacity: dark }}>
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 30% 35%, rgba(180,35,24,.28) 0%, transparent 50%)", opacity: f >= DOWN ? 0.6 + 0.4 * Math.exp(-((f - DOWN) % 15) / 5) : 0 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 40%" }}>
        <Drift seed="d1b" amp={7}>
          {signs.map((s) => {
            const p = useSpring(s.at, SP.snappy);
            const isDown = s.down && f >= DOWN;
            const pulse = isDown ? ((f - DOWN) % 15) / 15 : 0;
            return (
              <div key={s.name} style={{ position: "absolute", left: s.x, top: 180, width: 540, transform: `translateY(${(1 - p) * -80}px)`, opacity: Math.min(1, p * 1.5) }}>
                {isDown && (
                  <div
                    style={{
                      position: "absolute",
                      inset: -10 - 50 * pulse,
                      borderRadius: 26 + 20 * pulse,
                      border: `4px solid ${C.urgent}`,
                      opacity: 1 - pulse,
                    }}
                  />
                )}
                <div
                  style={{
                    position: "relative",
                    height: 300,
                    borderRadius: 20,
                    background: isDown ? "#2a1418" : C.ink,
                    border: `3px solid ${isDown ? C.urgent : "rgba(255,255,255,.08)"}`,
                    padding: "34px 44px",
                    boxShadow: "0 40px 80px -40px rgba(0,0,0,.6)",
                  }}
                >
                  <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 160, color: isDown ? "#ffb4ab" : C.boardText, lineHeight: 1 }}>{s.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 20 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: isDown ? "#ff5a4a" : C.glow, boxShadow: `0 0 16px ${isDown ? "#ff5a4a" : C.glow}`, opacity: isDown && (f >> 2) % 2 ? 0.35 : 1 }} />
                    <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 34, color: isDown ? "#ff8a7e" : C.glow }}>{isDown ? "Down" : "Running"}</span>
                  </div>
                  {s.down && (
                    <svg width={540} height={300} style={{ position: "absolute", inset: 0 }}>
                      <path d="M 330 60 L 470 220 M 470 60 L 330 220" stroke="#ff5a4a" strokeWidth={18} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - xs} opacity={xs > 0 ? 1 : 0} />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
          {/* the queue at CT 2 rises */}
          <div style={{ position: "absolute", left: 1110, top: 520, width: 480, height: 440, display: "flex", flexWrap: "wrap-reverse", alignContent: "flex-start", gap: "10px 18px", padding: 10 }}>
            {Array.from({ length: n }).map((_, i) => {
              const born = 48 + ((i - 3) * 62) / 17;
              const p = i < 3 ? 1 : ip(f, born, born + 6);
              return (
                <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * -30}px)` }}>
                  <Person color={interpolateColors(i, [0, 19], [dark > 0.5 ? "#8fa3c0" : C.inkSoft, "#ff9a5c"])} />
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 1620, top: 900, opacity: ip(f, 50, 60), display: "flex", alignItems: "center", gap: 10 }}>
            <svg width={30} height={40} viewBox="0 0 30 40">
              <path d="M15 38 V6 M4 16 L15 4 L26 16" stroke="#ff9a5c" strokeWidth={5} fill="none" strokeLinecap="round" />
            </svg>
            <Kicker color={dark > 0.5 ? "#ff9a5c" : C.inkSoft}>Queue</Kicker>
          </div>
          <div style={{ position: "absolute", left: 300, top: 560 }}>
            <Pill at={85} tone="red" size={30}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
                <path d="M3 3l18 18" />
              </svg>
              No alert sent
            </Pill>
          </div>
          <div style={{ position: "absolute", left: 300, top: 120, color: fg, opacity: 0.7 }}>
            <Kicker color={fg} size={22}>
              Imaging · Halden Medical Center
            </Kicker>
          </div>
        </Drift>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

function Day1({ dur }: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Seg from={0} len={34} tout="zoom" id="d1a">
        <D1Title />
      </Seg>
      <Seg from={30} len={dur - 30} tin="zoom" id="d1b">
        <D1Scanners len={dur - 30} />
      </Seg>
      <Sfx at={75} name="impact" volume={0.4} />
      <Sfx at={76} name="gate-hold" volume={0.3} />
      <Sfx at={115} name="tick-b" volume={0.2} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ DAY-2: sensing counts heads */

const PEOPLE: [number, number, number, number][] = [
  [375, 745, 155, 265],
  [600, 740, 185, 340],
  [830, 705, 205, 325],
  [1040, 710, 200, 300],
  [1225, 690, 130, 290],
];
const IMG_TOP = -160;

function D2Intro() {
  return (
    <Night light={0.14}>
      <Drift seed="d2a" amp={8}>
        <div style={{ position: "absolute", left: 200, top: 400, display: "flex", alignItems: "center", gap: 44 }}>
          <Node code="WS" at={2} size={150} dark />
          <div>
            <LineReveal lines={["Waiting-room", "sensing"]} at={3} size={120} />
          </div>
        </div>
        <div style={{ position: "absolute", left: 200, top: 300 }}>
          <Pill at={12} tone="glow" size={26}>
            SAM 3.1
          </Pill>
        </div>
      </Drift>
    </Night>
  );
}

function D2Camera({ len }: { len: number }) {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, len], [1, 1.14], { ...cl, easing: EZ.inOut });
  const scan = ip(f, 2, 16, EZ.inOut);
  const count = PEOPLE.filter((_, i) => f >= 8 + i * 5).length;
  const lastPop = 8 + (count - 1) * 5;
  const cBump = count > 0 ? 1 + 0.18 * Math.exp(-(f - lastPop) / 3) : 1;
  const spark = ip(f, 50, 84, EZ.inOut);
  const panel = useSpring(46, SP.snappy);
  const sec = 12 + Math.floor(f / 30);
  const SPARK = "M 30 170 C 110 165, 160 158, 210 140 S 330 90, 380 60 S 440 30, 470 22";
  const sparkPt = getPointAtLength(SPARK, getLength(SPARK) * Math.max(0.001, spark)) ?? { x: 30, y: 170 };
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "865px 640px" }}>
        <Img src={staticFile("assets/waiting.png")} style={{ position: "absolute", left: 0, top: IMG_TOP, width: 1920, height: 1280 }} />
        <AbsoluteFill style={{ background: "rgba(10,16,30,.28)" }} />
        {PEOPLE.map(([x, y, w, h], i) => {
          const at = 8 + i * 5;
          const p = useSpring(at, SP.snappy);
          if (f < at) return null;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y + IMG_TOP,
                width: w,
                height: h,
                border: `3px solid ${C.glow}`,
                background: `${C.glow}2e`,
                borderRadius: 8,
                opacity: Math.min(1, p * 1.6),
                transform: `scale(${1.25 - 0.25 * p})`,
                boxShadow: `0 0 24px ${C.glow}66`,
              }}
            >
              <div style={{ position: "absolute", left: -3, top: -36, background: C.glow, color: C.ink, fontFamily: F.text, fontWeight: 700, fontSize: 20, padding: "4px 10px", borderRadius: "6px 6px 6px 0" }}>
                person
              </div>
            </div>
          );
        })}
        {scan > 0 && scan < 1 && (
          <div style={{ position: "absolute", left: 1920 * scan, top: 0, width: 4, height: 1080, background: C.glow, boxShadow: `0 0 30px 10px ${C.glow}88` }} />
        )}
      </AbsoluteFill>
      {/* camera chrome */}
      <AbsoluteFill style={{ background: "repeating-linear-gradient(0deg, rgba(0,0,0,.08) 0 2px, transparent 2px 5px)" }} />
      <div style={{ position: "absolute", left: 60, top: 50, display: "flex", alignItems: "center", gap: 16, fontFamily: F.figure, fontWeight: 600, fontSize: 30, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: "#ff3b30", opacity: (f >> 3) % 2 ? 0.3 : 1 }} />
        CAM 03 · WAITING ROOM · CT
      </div>
      <div style={{ position: "absolute", right: 60, top: 50, fontFamily: F.figure, fontWeight: 600, fontSize: 30, color: "#fff", textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>
        08:41:{String(sec).padStart(2, "0")}
      </div>
      {/* frame corners */}
      {[
        [40, 30, 1, 1],
        [1880, 30, -1, 1],
        [40, 1050, 1, -1],
        [1880, 1050, -1, -1],
      ].map(([x, y, sx, sy], i) => (
        <div key={i} style={{ position: "absolute", left: x! - (sx! < 0 ? 60 : 0), top: y! - (sy! < 0 ? 60 : 0), width: 60, height: 60, borderLeft: sx! > 0 ? "4px solid #fff" : undefined, borderRight: sx! < 0 ? "4px solid #fff" : undefined, borderTop: sy! > 0 ? "4px solid #fff" : undefined, borderBottom: sy! < 0 ? "4px solid #fff" : undefined, opacity: 0.7 }} />
      ))}
      {/* head count */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 110,
          padding: "18px 30px",
          borderRadius: 16,
          background: "rgba(24,34,58,.82)",
          border: `2px solid ${C.glow}55`,
          opacity: ip(f, 4, 10),
          textAlign: "right",
        }}
      >
        <Kicker color={C.glow} size={20}>
          Heads
        </Kicker>
        <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 120, lineHeight: 1, color: C.boardText, transform: `scale(${cBump})`, transformOrigin: "right center" }}>{count}</div>
      </div>
      {/* the line swells */}
      <div
        style={{
          position: "absolute",
          right: 60,
          bottom: 60,
          width: 520,
          height: 250,
          borderRadius: 18,
          background: "rgba(24,34,58,.86)",
          border: "2px solid rgba(255,154,92,.5)",
          opacity: Math.min(1, panel * 1.5),
          transform: `translateY(${(1 - panel) * 60}px)`,
        }}
      >
        <div style={{ position: "absolute", left: 30, top: 22, display: "flex", alignItems: "center", gap: 12 }}>
          <Kicker color="#ff9a5c" size={20}>
            Waiting line
          </Kicker>
          <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 34, color: "#ff9a5c", opacity: ip(f, 80, 86) }}>↑</span>
        </div>
        <svg width={520} height={250} style={{ position: "absolute", inset: 0 }}>
          <path d={SPARK + " L 470 200 L 30 200 Z"} fill="rgba(255,154,92,.15)" opacity={spark} />
          <path d={SPARK} stroke="#ff9a5c" strokeWidth={5} fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - spark} />
          {spark > 0.01 && <circle cx={sparkPt.x} cy={sparkPt.y} r={9} fill="#ffd2b0" />}
        </svg>
      </div>
    </AbsoluteFill>
  );
}

function Day2({ dur }: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Seg from={0} len={28} tout="zoom" id="d2a">
        <D2Intro />
      </Seg>
      <Seg from={24} len={dur - 24} tin="zoom" id="d2b">
        <D2Camera len={dur - 24} />
      </Seg>
      <Sfx at={24} name="shutter" volume={0.3} />
      {PEOPLE.map((_, i) => (
        <Sfx key={i} at={32 + i * 5} name="tick-b" volume={0.2} />
      ))}
      <Sfx at={70} name="count" volume={0.2} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ HANDOFF-6: whip to the Ops planner */

function Handoff6() {
  const f = useCurrentFrame();
  const camAt = (t: number) => interpolate(t, [24, 46], [0, 2200], { ...cl, easing: EZ.inOut });
  const camX = camAt(f);
  const v = Math.abs(camAt(f) - camAt(f - 1));
  const blur = Math.min(50, v * 0.35);
  const thread = ip(f, 18, 46, EZ.inOut);
  const alert = useSpring(4, SP.snappy);
  return (
    <Night light={0.12}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="h6blur" x="-10%" y="0" width="120%" height="100%">
          <feGaussianBlur stdDeviation={`${blur} 0`} />
        </filter>
      </svg>
      <AbsoluteFill style={{ filter: blur > 0.6 ? "url(#h6blur)" : undefined }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transform: `translateX(${-camX}px)` }}>
          {/* Sensing */}
          <div style={{ position: "absolute", left: 485, top: 465 }}>
            <Node code="WS" at={0} size={150} dark />
          </div>
          <div style={{ position: "absolute", left: 420, top: 650, width: 280, textAlign: "center" }}>
            <Kicker color={C.boardText} size={24}>
              Sensing
            </Kicker>
          </div>
          <div style={{ position: "absolute", left: 380, top: 330, opacity: Math.min(1, alert * 1.5), transform: `scale(${0.8 + 0.2 * alert})` }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "12px 24px", borderRadius: 999, background: "rgba(194,65,12,.18)", border: "2px solid #ff9a5c", color: "#ff9a5c", fontFamily: F.text, fontWeight: 700, fontSize: 30 }}>
              ↑ Line swelling
            </div>
          </div>
          <CometThread d="M 640 540 C 1200 360, 1700 720, 2660 540" progress={thread} color={C.glow} width={7} />
          {/* Ops planner */}
          <div style={{ position: "absolute", left: 2675, top: 455 }}>
            <Node code="OP" at={46} size={170} dark />
          </div>
          <div style={{ position: "absolute", left: 2900, top: 440, whiteSpace: "nowrap" }}>
            <LineReveal lines={["Ops planner"]} at={49} size={150} />
          </div>
          <div style={{ position: "absolute", left: 2906, top: 630 }}>
            <Pill at={60} tone="glow" size={28}>
              Muse Spark Open
            </Pill>
          </div>
        </div>
      </AbsoluteFill>
      <Sfx at={4} name="gate-hold" volume={0.2} />
      <Sfx at={26} name="whoosh" volume={0.38} />
      <Sfx at={46} name="impact" volume={0.3} />
    </Night>
  );
}

/* ------------------------------------------------------------------ DAY-3: twenty futures */

const CX0 = 300;
const CX1 = 1640;
const CY = (m: number) => 880 - m * (600 / 30);
const NPT = 30;
const tAt = (k: number) => k / (NPT - 1);
const fixM = (t: number) => 17.4 - 12.5 * (1 - Math.pow(1 - t, 2.2)) + noise2D("fix", t * 3, 0) * 0.5 * t * (1 - t);
const runM = (i: number, t: number) => {
  const end = 7 + (21 * i) / 19 + noise2D("end", i, 0) * 1.5;
  return 17.4 + (end - 17.4) * Math.pow(t, 0.8) + noise2D("run" + i, t * 3.2, i) * 4 * Math.sin(Math.PI * t);
};

function Day3() {
  const f = useCurrentFrame();
  const axes = ip(f, 4, 20, EZ.inOut);
  const collapse = ip(f, 88, 108, EZ.inOut);
  const fixP = ip(f, 92, 112, EZ.inOut);
  const push = interpolate(f, [0, 120], [1, 1.05], cl);
  const pathFor = (m: (t: number) => number) => Array.from({ length: NPT }, (_, k) => `${k ? "L" : "M"} ${lerp(CX0, CX1, tAt(k)).toFixed(1)} ${CY(m(tAt(k))).toFixed(1)}`).join(" ");
  const fixD = pathFor(fixM);
  const nowPulse = ((f % 30) / 30);
  return (
    <Night light={0.1}>
      <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "50% 55%" }}>
        <Drift seed="d3" amp={6}>
          <div style={{ position: "absolute", left: 300, top: 70 }}>
            <LineReveal lines={["Next 90 min"]} at={0} size={110} />
          </div>
          <div style={{ position: "absolute", left: 1330, top: 66, opacity: ip(f, 58, 64), display: "flex", alignItems: "baseline", gap: 14 }}>
            <Odometer value={20} at={60} frames={26} size={130} color={C.glow} />
            <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 60, color: C.boardText }}>runs</span>
          </div>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            {/* grid */}
            {[5, 10, 15, 20, 25].map((m) => (
              <line key={m} x1={CX0} x2={CX1} y1={CY(m)} y2={CY(m)} stroke="rgba(244,246,242,.07)" strokeWidth={2} opacity={axes} />
            ))}
            <path d={`M ${CX0} ${CY(30)} L ${CX0} ${CY(0)} L ${CX1} ${CY(0)}`} stroke="rgba(244,246,242,.5)" strokeWidth={3} fill="none" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - axes} />
            {/* twenty runs */}
            {Array.from({ length: 20 }, (_, i) => {
              const at = 26 + i * 2.6;
              const p = ip(f, at, at + 20, EZ.inOut);
              if (p <= 0) return null;
              const d = pathFor((t) => lerp(runM(i, t), fixM(t), collapse));
              const hot = interpolateColors(runM(i, 1), [7, 28], ["#9fb7d6", "#ff9a5c"]);
              return <path key={i} d={d} stroke={hot} strokeWidth={3} fill="none" opacity={0.42 * (1 - collapse)} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - p} strokeLinejoin="round" />;
            })}
          </svg>
          {fixP > 0 && <CometThread d={fixD} progress={fixP} color={C.glow} width={7} />}
          {/* now */}
          <div style={{ position: "absolute", left: CX0 - 12, top: CY(17.4) - 12, width: 24, height: 24, borderRadius: 12, background: C.glow, opacity: axes }} />
          <div style={{ position: "absolute", left: CX0 - 12 - 24 * nowPulse, top: CY(17.4) - 12 - 24 * nowPulse, width: 24 + 48 * nowPulse, height: 24 + 48 * nowPulse, borderRadius: "50%", border: `2px solid ${C.glow}`, opacity: axes * (1 - nowPulse) }} />
          <div style={{ position: "absolute", left: CX0 - 260, top: CY(17.4) - 22, width: 230, textAlign: "right", opacity: axes }}>
            <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 40, color: C.boardText }}>17 min</span>
          </div>
          <div style={{ position: "absolute", left: CX0, top: CY(0) + 22, opacity: axes }}>
            <Kicker color="rgba(244,246,242,.7)">Now</Kicker>
          </div>
          <div style={{ position: "absolute", left: CX1 - 200, top: CY(0) + 22, width: 200, textAlign: "right", opacity: axes }}>
            <Kicker color="rgba(244,246,242,.7)">+90 min</Kicker>
          </div>
          <div style={{ position: "absolute", left: CX0 + 20, top: CY(30) - 10, opacity: axes }}>
            <Kicker color="rgba(244,246,242,.7)" size={20}>
              CT wait
            </Kicker>
          </div>
          <div style={{ position: "absolute", left: CX1 + 24, top: CY(fixM(1)) - 30 }}>
            <Pill at={108} tone="glow" size={28}>
              Best fix
            </Pill>
          </div>
        </Drift>
      </AbsoluteFill>
      <Sfx at={26} name="tick-a" volume={0.2} />
      <Sfx at={60} name="count" volume={0.22} />
      <Sfx at={90} name="whoosh" volume={0.2} />
      <Sfx at={108} name="ping" volume={0.25} />
    </Night>
  );
}

/* ------------------------------------------------------------------ DAY-4: the number (breakdown starts) */

const P_CROP = { x: 0, y: 100, w: 760, h: 960 };
const P_W = 620;
const P_K = P_W / P_CROP.w;

function D4Proposal() {
  const f = useCurrentFrame();
  const top = 540 - (P_CROP.h * P_K) / 2;
  const left = 960 - P_W / 2;
  const rect = { x: left + 84 * P_K - 20, y: top + (510 - P_CROP.y) * P_K - 20, w: (716 - 84) * P_K + 40, h: (625 - 510) * P_K + 40 };
  const hi = ip(f, 50, 62);
  return (
    <Day>
      <Camera keys={[{ at: 0, rect: FULL }, { at: 28, rect: FULL }, { at: 50, rect }]} pad={1.25}>
        <TiltScreen at={0} dur={80} width={P_W} from={{ rx: 22, ry: -26 }} to={{ rx: 2, ry: -3 }} glowDark={false}>
          <Shot src="clips/proposal.png" crop={P_CROP} width={P_W}>
            <div
              style={{
                position: "absolute",
                left: 70 * P_K,
                top: (505 - P_CROP.y) * P_K,
                width: (660) * P_K,
                height: 130 * P_K,
                borderRadius: 8,
                border: `3px solid ${C.agent}`,
                opacity: hi,
                boxShadow: `0 0 0 ${8 * hi}px ${C.agent}22`,
              }}
            />
          </Shot>
        </TiltScreen>
      </Camera>
      <div style={{ position: "absolute", left: 120, top: 100, opacity: 1 - ip(f, 34, 44) }}>
        <Pill at={2} tone="teal" size={34}>
          Best fix
        </Pill>
      </div>
    </Day>
  );
}

function Roller({ v, size }: { v: number; size: number }) {
  const u = ((v % 10) + 10) % 10;
  const tens = Math.floor(v / 10) + Math.max(0, u - 9);
  const tOp = interpolate(v, [9, 10], [0, 1], cl);
  const col = (pos: number) => (
    <span style={{ display: "inline-block", height: "1em", overflow: "hidden", verticalAlign: "top" }}>
      <span style={{ display: "block", transform: `translateY(${-(pos * 100) / 11}%)` }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => (
          <span key={i} style={{ display: "block", height: "1em" }}>
            {n}
          </span>
        ))}
      </span>
    </span>
  );
  return (
    <div style={{ display: "flex", fontFamily: F.figure, fontWeight: 600, fontSize: size, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
      <span style={{ display: "inline-block", width: `${0.56 * tOp}em`, opacity: tOp, overflow: "hidden" }}>{col(tens)}</span>
      {col(u)}
    </div>
  );
}

function D4Number({ len }: { len: number }) {
  const f = useCurrentFrame();
  const roll = ip(f, 28, 48, EZ.inOut);
  const v = lerp(17, 5, roll);
  const land = f >= 48 ? 1 + 0.05 * Math.exp(-(f - 48) / 5) : 1;
  const barW = (v / 17) * 1000;
  const barC = interpolateColors(v, [5, 17], [C.agent, C.waitHigh]);
  const push = interpolate(f, [0, len], [1, 1.04], cl);
  return (
    <Day>
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <Drift seed="d4b" amp={8}>
          <div style={{ position: "absolute", left: 460, top: 150 }}>
            <LineReveal lines={["Average CT wait"]} at={0} size={80} color={C.inkSoft} />
          </div>
          <div style={{ position: "absolute", left: 460, top: 270, display: "flex", alignItems: "baseline", gap: 30, color: interpolateColors(roll, [0, 1], [C.ink, C.agent]), transform: `scale(${land})`, transformOrigin: "left center" }}>
            <Roller v={v} size={420} />
            <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 140 }}>min</span>
          </div>
          <div style={{ position: "absolute", left: 1180, top: 330, opacity: ip(f, 50, 60) }}>
            <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 80, color: C.inkSoft, textDecoration: "line-through", textDecorationColor: C.waitHigh }}>17</span>
          </div>
          {/* the CT queue bar */}
          <div style={{ position: "absolute", left: 460, top: 780, width: 1000, height: 48, borderRadius: 24, border: `3px dashed ${C.rule}` }} />
          <div style={{ position: "absolute", left: 460, top: 780, width: barW * ip(f, 2, 18), height: 48, borderRadius: 24, background: barC }} />
          <div style={{ position: "absolute", left: 460, top: 850 }}>
            <Kicker>CT queue</Kicker>
          </div>
        </Drift>
      </AbsoluteFill>
    </Day>
  );
}

function Day4({ dur }: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Seg from={0} len={79} tout="fade" id="d4a">
        <D4Proposal />
      </Seg>
      <Seg from={71} len={dur - 71} tin="fade" id="d4b">
        <D4Number len={dur - 71} />
      </Seg>
      <Sfx at={50} name="tick-a" volume={0.2} />
      <Sfx at={99} name="count" volume={0.18} />
      <Sfx at={120} name="ping" volume={0.22} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ GATE-2: the operations lead approves (slow) */

const G_CROP = { x: 40, y: 500, w: 720, h: 540 };
const G_W = 900;
const G_K = G_W / G_CROP.w;
const gx = (x: number) => (x - G_CROP.x) * G_K;
const gy = (y: number) => (y - G_CROP.y) * G_K;

function G2Approve() {
  const f = useCurrentFrame();
  const CLICK = 45;
  const ok = ip(f, CLICK + 2, CLICK + 16);
  const press = interpolate(f, [CLICK, CLICK + 2, CLICK + 8], [0, 1, 0], cl);
  return (
    <Day>
      <Drift seed="g2a" amp={6}>
        <TiltScreen at={0} dur={64} width={G_W} from={{ rx: 12, ry: -14 }} to={{ rx: 3, ry: -4 }} glowDark={false} style={{ top: 50 }}>
          <Shot src="clips/proposal.png" crop={G_CROP} width={G_W}>
            {/* button press */}
            <div style={{ position: "absolute", left: gx(84), top: gy(934), width: (276 - 84) * G_K, height: 90 * G_K, borderRadius: 20, background: "rgba(0,0,0,.25)", opacity: press }} />
            {/* held becomes approved */}
            <div
              style={{
                position: "absolute",
                left: gx(84),
                top: gy(865),
                width: (348 - 84) * G_K,
                height: 45 * G_K,
                background: C.agentTint,
                color: C.agent,
                fontFamily: F.text,
                fontWeight: 700,
                fontSize: 30,
                display: "flex",
                alignItems: "center",
                gap: 10,
                paddingLeft: 18,
                opacity: ok,
              }}
            >
              ✓ Approved by Sam
            </div>
            <Cursor from={[860, 700]} to={[gx(180), gy(979)]} at={12} travel={30} clickAt={CLICK} />
          </Shot>
        </TiltScreen>
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", justifyContent: "center", opacity: ip(f, 2, 14), transform: `scale(${1 + 0.05 * Math.sin(Math.PI * ok)})` }}>
          <GateTag who="Sam" role="· operations lead" check={ok} />
        </div>
      </Drift>
    </Day>
  );
}

const PHONES = Array.from({ length: 7 }, (_, i) => ({ x: 1280 + 240 * Math.sin((Math.PI * i) / 6), y: 70 + i * 132 }));

function G2Fan() {
  const f = useCurrentFrame();
  const HUB = { x: 400, y: 720 };
  return (
    <Day>
      <Drift seed="g2b" amp={7}>
        <div style={{ position: "absolute", left: 120, top: 150 }}>
          <LineReveal lines={["7 patients", "re-planned"]} at={2} size={130} color={C.ink} />
        </div>
        {PHONES.map((p, i) => {
          const cy = p.y + 56;
          const d = `M ${HUB.x} ${HUB.y} C ${HUB.x + 420} ${HUB.y}, ${p.x - 380} ${cy}, ${p.x - 10} ${cy}`;
          const at = 8 + i * 3;
          return <CometThread key={i} d={d} progress={ip(f, at, at + 20, EZ.inOut)} color={C.agent} width={i === 3 ? 7 : 4} head={i === 3} />;
        })}
        <div style={{ position: "absolute", left: HUB.x - 60, top: HUB.y - 60, width: 120, height: 120, borderRadius: 60, background: C.agent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 14px ${C.agent}22` }}>
          <svg width={64} height={64} viewBox="0 0 24 24" fill="none">
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
          </svg>
        </div>
        {PHONES.map((p, i) => {
          const lit = ip(f, 26 + i * 3, 32 + i * 3);
          const maria = i === 3;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x,
                top: p.y,
                width: 64,
                height: 112,
                borderRadius: 12,
                background: C.ink,
                padding: 5,
                boxShadow: maria && lit > 0.5 ? `0 0 0 8px ${C.agent}33, 0 20px 30px -14px rgba(24,34,58,.6)` : "0 20px 30px -14px rgba(24,34,58,.6)",
                transform: `scale(${maria ? 1.25 : 1})`,
              }}
            >
              <div style={{ width: "100%", height: "100%", borderRadius: 8, background: interpolateColors(lit, [0, 1], ["#2c3852", C.paper]), padding: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ height: 14, borderRadius: 3, background: C.heldBg, borderLeft: `3px solid ${C.held}`, opacity: lit }} />
                <div style={{ height: 5, width: "80%", borderRadius: 3, background: C.rule, opacity: lit }} />
                <div style={{ height: 5, width: "60%", borderRadius: 3, background: C.rule, opacity: lit }} />
              </div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: PHONES[3]!.x + 100, top: PHONES[3]!.y + 36, opacity: ip(f, 40, 50) }}>
          <Kicker color={C.agent}>Maria</Kicker>
        </div>
      </Drift>
    </Day>
  );
}

const PH_W = 460;
const PH_LEFT = 470;
const PH_TOP = 68;
const PH_IN = PH_W - 2 * PH_W * 0.035;
const PH_K = PH_IN / 1170;

function G2Phone() {
  const f = useCurrentFrame();
  const innerTop = PH_TOP + PH_W * 0.035;
  const innerLeft = PH_LEFT + PH_W * 0.035;
  const amber = { x: innerLeft + 54 * PH_K, y: innerTop + (1600 - 420) * PH_K, w: 1050 * PH_K, h: 500 * PH_K };
  const ring = ip(f, 52, 66);
  const sideOut = ip(f, 22, 34);
  return (
    <Day>
      <Camera keys={[{ at: 0, rect: FULL }, { at: 24, rect: FULL }, { at: 62, rect: { x: amber.x - 40, y: amber.y - 60, w: amber.w + 80, h: amber.h + 120 } }]} pad={1.6}>
        <CometThread d={`M -40 560 C 200 560, 300 520, ${PH_LEFT + 6} 520`} progress={ip(f, 0, 18, EZ.inOut)} color={C.agent} width={6} />
        <div style={{ position: "absolute", left: PH_LEFT, top: PH_TOP }}>
          <Phone width={PH_W}>
            <Img src={staticFile("clips/phone-plan.png")} style={{ position: "absolute", left: 0, top: -420 * PH_K, width: PH_IN, maxWidth: "none" }} />
          </Phone>
        </div>
        <div
          style={{
            position: "absolute",
            left: amber.x - 10,
            top: amber.y - 10,
            width: amber.w + 20,
            height: amber.h + 20,
            borderRadius: 10,
            border: `3px solid ${C.held}`,
            opacity: ring,
            boxShadow: `0 0 0 ${10 * ring}px ${C.held}22`,
          }}
        />
      </Camera>
      <div style={{ position: "absolute", left: 1100, top: 380, opacity: ip(f, 4, 14) * (1 - sideOut), display: "flex", flexDirection: "column", gap: 26 }}>
        <Kicker>Maria's phone</Kicker>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 96, color: C.ink, lineHeight: 1 }}>The why, too</div>
      </div>
    </Day>
  );
}

function Gate2({ dur }: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Seg from={0} len={66} tout="zoom" id="g2a">
        <G2Approve />
      </Seg>
      <Seg from={58} len={66} tin="fade" tout="zoom" id="g2b">
        <G2Fan />
      </Seg>
      <Seg from={116} len={dur - 116} tin="fade" id="g2c">
        <G2Phone />
      </Seg>
      <Sfx at={45} name="tick-a" volume={0.3} />
      <Sfx at={47} name="gate-ok" volume={0.4} />
      <Sfx at={84} name="ping" volume={0.2} />
      <Sfx at={170} name="bell" volume={0.18} />
    </AbsoluteFill>
  );
}

export const scenes: Group = {
  "HANDOFF-4": { C: Handoff4, dark: false },
  "HANDOFF-5": { C: Handoff5, dark: false },
  "HIT-2": { C: Hit2, dark: false },
  "DAY-1": { C: Day1, dark: true },
  "DAY-2": { C: Day2, dark: true },
  "HANDOFF-6": { C: Handoff6, dark: true },
  "DAY-3": { C: Day3, dark: true },
  "DAY-4": { C: Day4, dark: false },
  "GATE-2": { C: Gate2, dark: false },
};
