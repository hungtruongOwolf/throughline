import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BigNumber, SignBlade, Thread, useEnter, useProgress } from "../components/kit";
import { Sfx } from "../components/frames";
import { C, E, F } from "../theme";

type S = { dur: number };

const LINKS = [
  { label: "Referral", accent: C.zone.blue },
  { label: "Insurance", accent: C.zone.gold },
  { label: "Visit", accent: C.zone.green },
  { label: "Results", accent: C.zone.rose },
  { label: "Follow-up", accent: C.zone.violet },
];
const BW = 290;
const GAP = 70;
const X0 = (1920 - (LINKS.length * BW + (LINKS.length - 1) * GAP)) / 2;
const bx = (i: number) => X0 + i * (BW + GAP);

/** The broken chain: five sign blades with flickering gaps between them. */
function Chain({ enterAt = () => 0, y = 498, flicker = 1 }: { enterAt?: (i: number) => number; y?: number; flicker?: number }) {
  const f = useCurrentFrame();
  return (
    <>
      {LINKS.map((l, i) => (
        <ChainBlade key={l.label} i={i} at={enterAt(i)} y={y} />
      ))}
      {LINKS.slice(1).map((_, i) => {
        const on = 0.35 + 0.65 * Math.abs(Math.sin(f * 0.21 + i * 1.7)) * (f % 23 > 2 ? 1 : 0.2);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: bx(i) + BW + 12,
              top: y + 40,
              width: GAP - 24,
              borderTop: `4px dashed ${C.urgent}`,
              opacity: on * flicker,
            }}
          />
        );
      })}
    </>
  );
}

function ChainBlade({ i, at, y }: { i: number; at: number; y: number }) {
  const e = useEnter(at);
  const l = LINKS[i]!;
  return (
    <div style={{ position: "absolute", left: bx(i), top: y, opacity: e, transform: `translateX(${(1 - e) * -24}px)` }}>
      <SignBlade label={l.label} accent={l.accent} width={BW} />
    </div>
  );
}

/** 0:00 The fax, before anything else. */
export function ColdOpen({ dur }: S) {
  const f = useCurrentFrame();
  const reveal = useProgress(4, 62);
  const shrink = useProgress(dur - 34, dur - 4);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Sfx at={2} name="fax" volume={0.5} />
      <div
        style={{
          position: "absolute",
          left: 960 - 330,
          top: 80,
          width: 660,
          transform: `translate(${shrink * -560}px, ${shrink * 240}px) rotate(${-7 + shrink * 7}deg) scale(${1 - 0.72 * shrink})`,
          opacity: 1 - shrink * 0.6,
          clipPath: `inset(0 0 ${(1 - reveal) * 100}% 0)`,
        }}
      >
        <Img
          src={staticFile("assets/maria-referral-fax.png")}
          style={{ width: 660, filter: "grayscale(1) contrast(1.15) brightness(.92)", boxShadow: "0 40px 80px rgba(0,0,0,.5)" }}
        />
        {reveal < 1 && (
          <div
            style={{
              position: "absolute",
              left: -20,
              right: -20,
              top: `${reveal * 100}%`,
              height: 3,
              background: C.glow,
              boxShadow: `0 0 24px 6px ${C.glow}88`,
            }}
          />
        )}
      </div>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 45%, transparent 40%, rgba(5,8,16,.55))` }} />
      <div style={{ opacity: f > 0 ? 1 : 0 }} />
    </AbsoluteFill>
  );
}

/** Rows of faint sign blades moving past: the sheer number of visits. */
function Traffic({ speed = 1.4, density = 1 }: { speed?: number; density?: number }) {
  const f = useCurrentFrame();
  const rows = Array.from({ length: 22 });
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", opacity: 0.9 }}>
      {rows.map((_, r) =>
        Array.from({ length: 9 }).map((__, c) => {
          const lane = (r * 9 + c) % 5;
          const y = ((r * 64 - f * speed * (1 + (c % 3) * 0.35)) % (22 * 64) + 22 * 64) % (22 * 64) - 64;
          return (
            <div
              key={`${r}-${c}`}
              style={{
                position: "absolute",
                left: c * 220 + 20,
                top: y,
                width: 160 + ((r + c) % 3) * 22,
                height: 22,
                borderRadius: 4,
                background: C.boardText,
                opacity: (0.035 + (lane === 2 ? 0.035 : 0)) * density,
              }}
            />
          );
        }),
      )}
    </div>
  );
}

/** [1] 155 million emergency visits, and hundreds of millions more. */
export function Scale({ dur }: S) {
  const f = useCurrentFrame();
  const more = useProgress(dur * 0.5, dur * 0.75, E.rise);
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center" }}>
      <Traffic speed={1.2 + more * 3} density={1 + more * 2.2} />
      <Sfx at={8} name="impact" volume={0.5} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, transform: `scale(${1 - more * 0.12})` }}>
        <BigNumber from={0} to={155} start={10} frames={34} size={330} color={C.boardText} format={(n) => `${Math.round(n)}M`} />
        <div
          style={{
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 34,
            color: C.boardText,
            opacity: interpolate(f, [28, 44], [0, 0.75], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          emergency visits a year
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** [2] A referral, the insurance, the visit, the results, the follow-up. Nobody holds the line. */
export function ChainScene({ dur }: S) {
  const f = useCurrentFrame();
  const tryLine = useProgress(dur * 0.62, dur * 0.82);
  const fail = useProgress(dur * 0.84, dur * 0.95);
  const cam = interpolate(f, [0, dur], [1.06, 0.94]);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ transform: `scale(${cam})` }}>
        <Chain enterAt={(i) => 4 + i * dur * 0.055} />
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <path
            d={`M ${X0 - 40} 420 L ${1920 - X0 + 40} 420`}
            stroke={C.boardText}
            strokeOpacity={0.35 * (1 - fail)}
            strokeWidth={3}
            strokeDasharray="14 12"
            fill="none"
            pathLength={1}
            style={{ strokeDasharray: `${tryLine} 1` }}
          />
        </svg>
      </AbsoluteFill>
      {LINKS.map((_, i) => (
        <Sfx key={i} at={4 + i * dur * 0.055} name={i % 2 ? "tick-b" : "tick-a"} volume={0.18} />
      ))}
    </AbsoluteFill>
  );
}

function Stat({ at, big, unit, color }: { at: number; big: string; unit: string; color: string }) {
  const e = useEnter(at);
  return (
    <div
      style={{
        width: 470,
        height: 300,
        background: "#0e1526",
        border: `1px solid rgba(244,246,242,.12)`,
        borderRadius: 8,
        padding: "34px 40px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: e,
        transform: `translateY(${(1 - e) * 40}px)`,
        boxShadow: "0 30px 60px -30px rgba(0,0,0,.8)",
      }}
    >
      <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 150, lineHeight: 0.9, color, letterSpacing: "-0.02em" }}>{big}</div>
      <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.boardText, opacity: 0.78 }}>{unit}</div>
    </div>
  );
}

/** [3] What the gaps cost. */
export function Price({ dur }: S) {
  const f = useCurrentFrame();
  // fourteen results travel the chain; one falls into a gap
  const travel = interpolate(f, [dur * 0.66, dur * 0.98], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <div style={{ position: "absolute", inset: 0, transform: "translateY(-300px) scale(.62)", transformOrigin: "50% 40%" }}>
        <Chain />
        {Array.from({ length: 14 }).map((_, i) => {
          const x = bx(0) + (bx(4) + BW - bx(0)) * Math.min(1, Math.max(0, travel * 1.4 - i * 0.03));
          const lost = i === 9;
          const drop = lost ? Math.max(0, (travel - 0.42) * 900) : 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: lost ? Math.min(x, bx(2) + BW + 22) : x,
                top: 610 + drop,
                width: 22,
                height: 16,
                borderRadius: 3,
                background: lost ? C.urgent : C.boardText,
                opacity: travel > 0 ? (lost ? Math.max(0, 1 - drop / 400) : 0.85) : 0,
              }}
            />
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 480, display: "flex", justifyContent: "center", gap: 46 }}>
        <Stat at={dur * 0.06} big="¼" unit="of US health spending is waste" color={C.urgent} />
        <Stat at={dur * 0.4} big="13 h" unit="a week on prior authorization" color={C.waitMid} />
        <Stat at={dur * 0.66} big="1 in 14" unit="abnormal results never arrive" color={C.urgent} />
      </div>
      <Sfx at={dur * 0.06} name="count" volume={0.4} />
      <Sfx at={dur * 0.4} name="count" volume={0.4} />
      <Sfx at={dur * 0.66} name="count" volume={0.4} />
    </AbsoluteFill>
  );
}

/** [4] It's the gaps between them: push into one gap until it is all there is. */
export function Gap({ dur }: S) {
  const p = useProgress(dur * 0.25, dur);
  const gx = bx(2) + BW + GAP / 2;
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: `${gx}px 540px`, transform: `scale(${1 + p * p * 30})` }}>
        <Chain flicker={1 - p} />
      </AbsoluteFill>
      <Sfx at={dur * 0.3} name="whoosh" volume={0.35} />
    </AbsoluteFill>
  );
}

/** The first thread, and the name. */
export function Title({ dur }: S) {
  const f = useCurrentFrame();
  const dot = useEnter(4);
  const line = useProgress(10, 44);
  const word = useEnter(34);
  const out = useProgress(dur - 10, dur);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Sfx at={10} name="impact" volume={0.55} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 1 - out }}>
        <circle cx={140} cy={540} r={9 * dot} fill={C.glow} />
        <Thread d="M 140 540 L 1780 540" progress={line} dark length={1640} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 600,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 22,
          opacity: word * (1 - out),
          transform: `translateY(${(1 - word) * 26}px)`,
        }}
      >
        <span style={{ width: 56, height: 12, background: C.glow, display: "block" }} />
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 120, color: C.boardText, letterSpacing: "-0.01em" }}>
          Throughline
        </span>
      </div>
      <div style={{ opacity: f >= 0 ? 0 : 1 }} />
    </AbsoluteFill>
  );
}
