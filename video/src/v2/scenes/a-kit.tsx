import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { noise2D } from "@remotion/noise";
import { C, F } from "../../theme";
import { EZ, Shot } from "../fx";

/** Helpers for builder A's scenes (cold open, problem, price, hit). */
export const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const ramp = (f: number, a: number, b: number, ease = EZ.out) => interpolate(f, [a, b], [0, 1], { ...cl, easing: ease });
/** Piecewise camera track: keys are [frame, value]; each segment eased in-out. */
export const track = (f: number, keys: [number, number][], ease = EZ.inOut) =>
  interpolate(
    f,
    keys.map((k) => k[0]),
    keys.map((k) => k[1]),
    { ...cl, easing: ease },
  );
export const vel = (fn: (f: number) => number, f: number) => fn(f + 0.5) - fn(f - 0.5);

export const RED = "#f0524a";
export const AMBER = "#e08a1e";
export const CARD = "#1e2944";
export const ZONES = [C.zone.blue, C.zone.gold, C.zone.green, C.zone.rose, C.zone.violet, "#4aa3c7", "#b0793c"];

/** Directional (horizontal) motion blur for whip pans: an SVG gaussian with stdDeviation "x 0". */
export function HBlur({ id, amount, children, style }: { id: string; amount: number; children: ReactNode; style?: CSSProperties }) {
  const a = Math.min(90, Math.abs(amount));
  return (
    <AbsoluteFill style={style}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          <filter id={id} x="-10%" y="0%" width="120%" height="100%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={`${a.toFixed(2)} 0`} />
          </filter>
        </defs>
      </svg>
      <AbsoluteFill style={{ filter: a > 0.8 ? `url(#${id})` : undefined }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Small uppercase section tag (top-left), masked in and out. */
export function Tag({ text, at, out, color = C.boardText, x = 120, y = 104 }: { text: string; at: number; out?: number; color?: string; x?: number; y?: number }) {
  const f = useCurrentFrame();
  const p = ramp(f, at, at + 12);
  const o = out == null ? 0 : ramp(f, out, out + 8, EZ.in);
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: 18, overflow: "hidden", height: 44 }}>
      <div style={{ width: 56 * p * (1 - o), height: 4, background: color }} />
      <div
        style={{
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: "0.22em",
          color,
          transform: `translateY(${(1 - p) * 110 + o * -110}%)`,
        }}
      >
        {text.toUpperCase()}
      </div>
    </div>
  );
}

/** A paper wayfinding blade (signage on a dark wall) with a masked wipe-in. */
export function Blade({
  label,
  num,
  w,
  h = 120,
  fs = 62,
  accent = C.zone.blue,
  reveal = 1,
  arrow = true,
  dim = 0,
}: {
  label: string;
  num?: string;
  w: number;
  h?: number;
  fs?: number;
  accent?: string;
  reveal?: number;
  arrow?: boolean;
  dim?: number;
}) {
  const r = Math.max(0, Math.min(1, reveal));
  return (
    <div style={{ width: w, height: h, position: "relative", clipPath: `inset(0 ${(1 - r) * 100}% 0 0)` }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: C.boardText,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          gap: h * 0.18,
          padding: `0 ${h * 0.26}px 0 ${h * 0.22}px`,
          boxShadow: "0 30px 60px -30px rgba(0,0,0,.8), inset 0 -3px 0 rgba(24,34,58,.12)",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: h * 0.09, background: accent }} />
        {num && (
          <div
            style={{
              marginLeft: h * 0.08,
              width: h * 0.56,
              height: h * 0.56,
              borderRadius: 6,
              background: C.ink,
              color: C.boardText,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: F.figure,
              fontWeight: 600,
              fontSize: h * 0.28,
              flexShrink: 0,
            }}
          >
            {num}
          </div>
        )}
        <div
          style={{
            flex: 1,
            fontFamily: F.display,
            fontWeight: 800,
            fontSize: fs,
            color: C.ink,
            whiteSpace: "nowrap",
            letterSpacing: "-0.01em",
            marginLeft: num ? 0 : h * 0.1,
            transform: `translateX(${(1 - r) * -40}px)`,
          }}
        >
          {label}
        </div>
        {arrow && (
          <svg width={h * 0.36} height={h * 0.36} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M4 12h14M13 6l6 6-6 6" stroke={C.ink} strokeWidth="2.8" strokeLinecap="square" />
          </svg>
        )}
        {dim > 0 && <div style={{ position: "absolute", inset: 0, background: C.ink, opacity: dim }} />}
      </div>
    </div>
  );
}

/** Flicker for a broken gap: mostly on, with dropouts. */
export const flick = (seed: string, f: number, rate = 0.55) => {
  const n = noise2D(seed, f * rate, 0);
  const drop = noise2D(seed + "d", f * 0.9, 3) > 0.45 ? 0.15 : 1;
  return (0.55 + 0.45 * n) * drop;
};

/** A halftone/dither overlay that turns any image into a fax print. */
export function Halftone({ size = 5, opacity = 0.3 }: { size?: number; opacity?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: "multiply",
        opacity,
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 38%, rgba(20,20,20,.9) 40%, rgba(0,0,0,0) 62%)`,
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

// ------------------------------------------------------------------------------------------------
// The station world: one long wall of wayfinding stations, panned with whips.
// ------------------------------------------------------------------------------------------------

export const SPACING = 1250;
const SW = 900;
const TOP = 250;
const BLADE_H = 120;

type ArtProps = { at: number };

function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        width: SW,
        height: 470,
        borderRadius: 16,
        background: CARD,
        border: "1px solid rgba(255,255,255,.07)",
        overflow: "hidden",
        boxShadow: "0 50px 90px -50px rgba(0,0,0,.9)",
      }}
    >
      {children}
    </div>
  );
}

function ArtReferral({ at }: ArtProps) {
  const f = useCurrentFrame();
  const scan = ramp(f, at, at + 22, EZ.inOut);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", transform: `rotate(-2deg) scale(${1.04 - 0.04 * scan})`, boxShadow: "0 30px 60px -20px rgba(0,0,0,.7)" }}>
        <div style={{ clipPath: `inset(0 0 ${(1 - scan) * 100}% 0)`, filter: "grayscale(1) contrast(1.35)", position: "relative" }}>
          <Shot src="assets/maria-referral-fax.png" crop={{ x: 40, y: 20, w: 1130, h: 450 }} width={800} />
          <Halftone size={4} opacity={0.22} />
        </div>
        {scan > 0 && scan < 1 && (
          <div
            style={{
              position: "absolute",
              left: -20,
              right: -20,
              top: `${scan * 100}%`,
              height: 4,
              background: "#e9fffb",
              boxShadow: "0 0 20px 6px rgba(233,255,251,.6)",
            }}
          />
        )}
      </div>
    </AbsoluteFill>
  );
}

function ArtInsurance({ at }: ArtProps) {
  const f = useCurrentFrame();
  const p = ramp(f, at, at + 16);
  const chip = ramp(f, at + 12, at + 22);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 70, top: 70, transform: `translateX(${(1 - p) * -80}px) rotate(${-5 + 2 * p}deg)`, opacity: p }}>
        <Img src={staticFile("assets/maria-insurance-card.png")} style={{ width: 470, borderRadius: 14, boxShadow: "0 30px 60px -20px rgba(0,0,0,.8)" }} />
      </div>
      <div style={{ position: "absolute", left: 590, top: 150, opacity: chip, transform: `translateY(${(1 - chip) * 20}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(224,138,30,.16)", border: `2px solid ${AMBER}`, borderRadius: 40, padding: "10px 20px", fontFamily: F.display, fontWeight: 700, fontSize: 32, color: AMBER }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: AMBER, opacity: 0.4 + 0.6 * Math.abs(Math.sin(f * 0.25)) }} />
          On hold
        </div>
        {/* hold music: a waveform that never stops */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", height: 120, marginTop: 30 }}>
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              style={{ width: 8, borderRadius: 4, background: "rgba(244,246,242,.5)", height: 16 + 80 * Math.abs(noise2D("hold" + i, f * 0.08, i * 0.3)) * chip }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function ArtSlots({ at }: ArtProps) {
  const f = useCurrentFrame();
  const keep = 17;
  return (
    <AbsoluteFill style={{ padding: "40px 64px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ fontFamily: F.display, fontWeight: 700, fontSize: 28, color: "rgba(244,246,242,.55)", textAlign: "center" }}>
            {d}
          </div>
        ))}
        {Array.from({ length: 24 }, (_, i) => {
          const order = (i * 7) % 24;
          const t = at + 8 + order * 1.6;
          const x = ramp(f, t, t + 5);
          const isKeep = i === keep;
          const pulse = isKeep ? 0.5 + 0.5 * Math.abs(Math.sin(f * 0.3)) : 0;
          return (
            <div
              key={i}
              style={{
                height: 74,
                borderRadius: 8,
                background: isKeep ? `rgba(224,138,30,${0.12 + 0.2 * pulse})` : "rgba(244,246,242,.07)",
                border: isKeep ? `2px solid ${AMBER}` : "1px solid rgba(244,246,242,.1)",
                position: "relative",
                opacity: isKeep ? 1 : 1 - 0.55 * x,
              }}
            >
              {!isKeep && (
                <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
                  <path d="M30 14 L70 46 M70 14 L30 46" stroke={RED} strokeWidth={5} strokeDasharray={60} strokeDashoffset={60 * (1 - x)} fill="none" />
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function ArtHall({ at }: ArtProps) {
  const f = useCurrentFrame();
  const t = f - at;
  const vx = 450;
  const vy = 205;
  return (
    <AbsoluteFill>
      <svg width={SW} height={470}>
        {[
          [0, 0],
          [SW, 0],
          [0, 470],
          [SW, 470],
        ].map(([x, y], i) => (
          <line key={i} x1={x} y1={y} x2={vx} y2={vy} stroke="rgba(244,246,242,.16)" strokeWidth={2} />
        ))}
        {Array.from({ length: 7 }, (_, k) => {
          const z = (((k / 7 + t * 0.013) % 1) + 1) % 1;
          const s = 0.05 + z * z * 1.5;
          return (
            <rect
              key={k}
              x={vx - 470 * s}
              y={vy - 230 * s}
              width={940 * s}
              height={480 * s}
              fill="none"
              stroke="rgba(244,246,242,1)"
              strokeOpacity={0.05 + 0.3 * z * (1 - z) * 4 * 0.5}
              strokeWidth={2}
            />
          );
        })}
      </svg>
      {/* signs pointing every which way */}
      {[
        { x: 120, y: 60, d: -1, l: "Imaging" },
        { x: 560, y: 90, d: 1, l: "Lab" },
        { x: 220, y: 330, d: 1, l: "Radiology" },
        { x: 600, y: 300, d: -1, l: "Admitting" },
      ].map((s, i) => {
        const p = ramp(f, at + 4 + i * 4, at + 14 + i * 4);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: s.x,
              top: s.y,
              opacity: p * (0.65 + 0.35 * flick("h" + i, f)),
              transform: `translateX(${(1 - p) * 30 * s.d}px)`,
              display: "flex",
              flexDirection: s.d < 0 ? "row-reverse" : "row",
              alignItems: "center",
              gap: 10,
              background: "rgba(244,246,242,.9)",
              borderRadius: 6,
              padding: "6px 14px",
              fontFamily: F.display,
              fontWeight: 700,
              fontSize: 28,
              color: C.ink,
            }}
          >
            {s.l}
            <svg width={22} height={22} viewBox="0 0 24 24" style={{ transform: s.d < 0 ? "scaleX(-1)" : undefined }}>
              <path d="M4 12h14M13 6l6 6-6 6" stroke={C.ink} strokeWidth="3" fill="none" />
            </svg>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function ArtWaiting({ at }: ArtProps) {
  const f = useCurrentFrame();
  const push = ramp(f, at - 20, at + 80, EZ.inOut);
  const hand = (f - at) * 14;
  return (
    <AbsoluteFill>
      <Img
        src={staticFile("assets/waiting.png")}
        style={{ position: "absolute", width: SW * 1.2, left: -SW * 0.1 - 40 * push, top: -120 - 20 * push, transform: `scale(${1 + 0.08 * push})`, filter: "brightness(.62) saturate(.55)", maxWidth: "none" }}
      />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(24,34,58,.0) 50%, rgba(24,34,58,.75) 100%)" }} />
      <svg width={120} height={120} viewBox="0 0 100 100" style={{ position: "absolute", right: 40, top: 36 }}>
        <circle cx={50} cy={50} r={44} fill="rgba(24,34,58,.75)" stroke={C.boardText} strokeWidth={5} />
        <line x1={50} y1={50} x2={50 + 30 * Math.sin((hand * Math.PI) / 180)} y2={50 - 30 * Math.cos((hand * Math.PI) / 180)} stroke={C.boardText} strokeWidth={5} strokeLinecap="round" />
        <line x1={50} y1={50} x2={50 + 20 * Math.sin((hand * Math.PI) / 2160)} y2={50 - 20 * Math.cos((hand * Math.PI) / 2160)} stroke={AMBER} strokeWidth={6} strokeLinecap="round" />
      </svg>
    </AbsoluteFill>
  );
}

const RESULTS = [
  { n: "CBC w/ diff", s: "Normal" },
  { n: "CMP", s: "Normal" },
  { n: "CT chest", s: "Abnormal" },
  { n: "Lipid panel", s: "Normal" },
];
function ArtResults({ at }: ArtProps) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: "46px 60px", display: "flex", flexDirection: "column", gap: 16 }}>
      {RESULTS.map((r, i) => {
        const p = ramp(f, at + i * 4, at + i * 4 + 12);
        const bad = r.s === "Abnormal";
        const pulse = bad ? flick("res", f, 0.4) : 0;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              height: 78,
              padding: "0 26px",
              borderRadius: 10,
              background: bad ? `rgba(240,82,74,${0.1 + 0.12 * pulse})` : "rgba(244,246,242,.06)",
              border: bad ? `2px solid ${RED}` : "1px solid rgba(244,246,242,.1)",
              opacity: p,
              transform: `translateX(${(1 - p) * 60}px)`,
              fontFamily: F.text,
              fontSize: 30,
              color: C.boardText,
            }}
          >
            <span>{r.n}</span>
            <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30, color: bad ? RED : "rgba(244,246,242,.5)" }}>{bad ? "Abnormal · unread" : r.s}</span>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

function ArtPhone({ at }: ArtProps) {
  const f = useCurrentFrame();
  const ring = Math.sin(f * 1.6) * 7 * Math.max(0, Math.sin(((f - at) * Math.PI) / 16));
  const rows = ["Missed call", "Missed call", "Voicemail", "Missed call"];
  return (
    <AbsoluteFill>
      <svg width={220} height={220} viewBox="0 0 24 24" style={{ position: "absolute", left: 80, top: 120, transform: `rotate(${ring}deg)` }}>
        <path
          d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"
          fill="none"
          stroke={C.boardText}
          strokeWidth={1.4}
        />
      </svg>
      <div style={{ position: "absolute", left: 390, top: 50, display: "flex", flexDirection: "column", gap: 14 }}>
        {rows.map((r, i) => {
          const p = ramp(f, at + i * 8, at + i * 8 + 10);
          return (
            <div
              key={i}
              style={{
                width: 440,
                height: 78,
                borderRadius: 12,
                background: "rgba(244,246,242,.07)",
                border: "1px solid rgba(244,246,242,.12)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "0 22px",
                opacity: p,
                transform: `translateY(${(1 - p) * -30}px) scale(${0.9 + 0.1 * p})`,
                fontFamily: F.display,
                fontWeight: 700,
                fontSize: 32,
                color: r === "Voicemail" ? AMBER : RED,
              }}
            >
              <div style={{ width: 14, height: 14, borderRadius: 7, background: r === "Voicemail" ? AMBER : RED }} />
              {r}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

export const STATIONS: { label: string; Art: (p: ArtProps) => ReactNode }[] = [
  { label: "Referral", Art: ArtReferral },
  { label: "Insurance", Art: ArtInsurance },
  { label: "Time slot", Art: ArtSlots },
  { label: "Hallways", Art: ArtHall },
  { label: "Waiting room", Art: ArtWaiting },
  { label: "Results", Art: ArtResults },
  { label: "Phone tag", Art: ArtPhone },
];

function Station({ i, at }: { i: number; at: number }) {
  const f = useCurrentFrame();
  const wipe = ramp(f, at, at + 14);
  const panel = ramp(f, at + 5, at + 20);
  const st = STATIONS[i]!;
  return (
    <div style={{ position: "absolute", left: 960 + i * SPACING - SW / 2, top: TOP, width: SW }}>
      <Blade label={st.label} num={String(i + 1).padStart(2, "0")} w={SW} h={BLADE_H} accent={ZONES[i]} reveal={wipe} />
      <div style={{ marginTop: 28, opacity: panel, transform: `translateY(${(1 - panel) * 50}px)`, clipPath: `inset(0 0 ${(1 - panel) * 100}% 0)` }}>
        <Panel>
          <st.Art at={at + 12} />
        </Panel>
      </div>
    </div>
  );
}

/** The wall of stations. `cam` = station index in the center (fractional while whipping). */
export function World({ cam, zoom = 1, reveal, gapBoost = 0 }: { cam: number; zoom?: number; reveal: number[]; gapBoost?: number }) {
  const f = useCurrentFrame();
  const y = TOP + BLADE_H / 2;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          transformOrigin: "960px 540px",
          transform: `scale(${zoom}) translateX(${-cam * SPACING}px)`,
        }}
      >
        <svg width={SPACING * 8} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          {Array.from({ length: STATIONS.length - 1 }, (_, i) => {
            const x0 = 960 + i * SPACING + SW / 2;
            const x1 = x0 + SPACING - SW;
            const mid = (x0 + x1) / 2;
            const k = flick("w" + i, f) * (0.6 + 0.4 * gapBoost);
            const shown = f >= reveal[i + 1]! || reveal[i + 1]! < -100 ? 1 : 0;
            return (
              <g key={i} opacity={shown}>
                <line x1={x0} y1={y} x2={mid - 40} y2={y} stroke="rgba(244,246,242,.55)" strokeWidth={6} />
                <line x1={mid + 40} y1={y} x2={x1} y2={y} stroke="rgba(244,246,242,.55)" strokeWidth={6} />
                <line x1={mid - 36} y1={y} x2={mid + 36} y2={y} stroke={RED} strokeWidth={6} strokeDasharray="10 8" opacity={k} />
                <circle cx={mid} cy={y} r={30} fill={RED} opacity={0.18 * k} />
              </g>
            );
          })}
        </svg>
        {STATIONS.map((_, i) => (
          <Station key={i} i={i} at={reveal[i]!} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

// ------------------------------------------------------------------------------------------------
// The compact chain: a row of small blades joined by stubs, with red gaps; it can snap apart.
// ------------------------------------------------------------------------------------------------

export type ChainOpts = {
  labels: string[];
  w: number;
  g: number;
  y?: number;
  h?: number;
  fs?: number;
  /** 0 = intact, 1 = snapped apart */
  spread?: number;
  /** per-blade wipe 0..1 */
  enter?: (i: number) => number;
  /** connector draw 0..1 */
  link?: number;
  /** red gap intensity */
  gap?: number;
  /** per-blade person chip 0..1 */
  people?: (i: number) => number;
  roles?: string[];
  seed?: string;
};

export function chainPose(o: ChainOpts, i: number) {
  const n = o.labels.length;
  const y = o.y ?? 470;
  const total = n * o.w + (n - 1) * o.g;
  const cx = 960 - total / 2 + i * (o.w + o.g) + o.w / 2;
  const s = o.spread ?? 0;
  const c = i - (n - 1) / 2;
  const DY = [-70, 95, -125, 55, 135, -85, 45];
  const DR = [-12, 9, -6, 14, -10, 7, -15];
  const j = (i + (o.seed === "co" ? 2 : 0)) % 7;
  const dx = c * 34 * s + Math.sign(c) * 24 * s;
  const dy = DY[j]! * s;
  const r = DR[j]! * s;
  return { cx: cx + dx, cy: y + dy, r };
}

const rot = (x: number, y: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
};

/** End points of the gap between blade i and i+1. */
export function gapPoints(o: ChainOpts, i: number) {
  const a = chainPose(o, i);
  const b = chainPose(o, i + 1);
  const stub = o.g / 2 - 9;
  const pa = rot(o.w / 2 + stub, 0, a.r);
  const pb = rot(-o.w / 2 - stub, 0, b.r);
  const ea = rot(o.w / 2, 0, a.r);
  const eb = rot(-o.w / 2, 0, b.r);
  return {
    a0: { x: a.cx + ea.x, y: a.cy + ea.y },
    a: { x: a.cx + pa.x, y: a.cy + pa.y },
    b: { x: b.cx + pb.x, y: b.cy + pb.y },
    b0: { x: b.cx + eb.x, y: b.cy + eb.y },
  };
}

export function Chain(o: ChainOpts) {
  const f = useCurrentFrame();
  const h = o.h ?? 76;
  const fs = o.fs ?? 30;
  const link = o.link ?? 1;
  const gap = o.gap ?? 0;
  const n = o.labels.length;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {Array.from({ length: n - 1 }, (_, i) => {
          const p = gapPoints(o, i);
          const k = flick((o.seed ?? "c") + "g" + i, f) * gap;
          const ax = p.a0.x + (p.a.x - p.a0.x) * link;
          const ay = p.a0.y + (p.a.y - p.a0.y) * link;
          const bx = p.b0.x + (p.b.x - p.b0.x) * link;
          const by = p.b0.y + (p.b.y - p.b0.y) * link;
          return (
            <g key={i}>
              <line x1={p.a0.x} y1={p.a0.y} x2={ax} y2={ay} stroke="rgba(244,246,242,.6)" strokeWidth={5} />
              <line x1={p.b0.x} y1={p.b0.y} x2={bx} y2={by} stroke="rgba(244,246,242,.6)" strokeWidth={5} />
              {gap > 0 && (
                <>
                  <line x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={RED} strokeWidth={5} strokeDasharray="7 6" opacity={k} />
                  <circle cx={(p.a.x + p.b.x) / 2} cy={(p.a.y + p.b.y) / 2} r={16 + 10 * k} fill={RED} opacity={0.22 * k} />
                </>
              )}
            </g>
          );
        })}
      </svg>
      {o.labels.map((l, i) => {
        const pose = chainPose(o, i);
        const e = o.enter ? o.enter(i) : 1;
        const pp = o.people ? o.people(i) : 0;
        return (
          <div key={i} style={{ position: "absolute", left: pose.cx - o.w / 2, top: pose.cy - h / 2, width: o.w, transform: `rotate(${pose.r}deg)` }}>
            <Blade label={l} w={o.w} h={h} fs={fs} accent={ZONES[i % ZONES.length]} reveal={e} arrow={false} />
            {o.roles && pp > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: h + 22,
                  left: 0,
                  width: o.w,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  opacity: Math.min(1, pp * 1.5),
                  transform: `translateY(${(1 - pp) * -16}px) scale(${0.7 + 0.3 * pp})`,
                }}
              >
                <svg width={64} height={64} viewBox="0 0 64 64">
                  <circle cx={32} cy={32} r={30} fill={ZONES[i % ZONES.length]} />
                  <circle cx={32} cy={25} r={10} fill={C.boardText} />
                  <path d="M14 52c3-10 10-14 18-14s15 4 18 14" fill={C.boardText} />
                </svg>
                <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 26, color: "rgba(244,246,242,.8)", whiteSpace: "nowrap" }}>{o.roles[i]}</div>
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** Moving wall of dim sign blades (city-traffic of a hospital): rows sliding at different speeds. */
const WALL = ["Emergency", "Radiology", "Admitting", "Lab", "Pharmacy", "Cardiology", "Imaging", "Billing", "Discharge", "Oncology", "Registration", "Outpatient", "Surgery", "Exit"];
export function TrafficWall({ speed = 1, opacity = 1 }: { speed?: number; opacity?: number }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ perspective: 1600, opacity }}>
      <AbsoluteFill style={{ transform: "rotateY(-16deg) rotateX(8deg) scale(1.35)", transformOrigin: "50% 50%" }}>
        {Array.from({ length: 9 }, (_, r) => {
          const depth = 0.35 + 0.65 * (((r * 5) % 9) / 8);
          const dir = r % 2 === 0 ? -1 : 1;
          const v = (3 + depth * 9) * speed;
          const period = 14 * 330;
          const off = ((((f * v * dir + r * 977) % period) + period) % period) - period;
          return (
            <div key={r} style={{ position: "absolute", top: -60 + r * 136, left: off, display: "flex", gap: 40, opacity: 0.08 + 0.22 * depth }}>
              {[0, 1].flatMap((rep) =>
                WALL.map((l, k) => (
                  <Blade key={rep + "-" + k} label={WALL[(k + r * 3) % WALL.length]!} w={290} h={78} fs={34} accent={ZONES[(k + r) % ZONES.length]} arrow={(k + r) % 3 !== 0} />
                )),
              )}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
