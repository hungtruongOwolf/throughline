import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { getLength, getPointAtLength } from "@remotion/paths";
import { EZ } from "../fx";
import { C, F } from "../../theme";

/** Builder B's small helpers (cursor, flat tilt plane, CSS light leak, agent badge that catches the thread). */

export const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const lerp = (f: number, a: number, b: number, from: number, to: number, ease = EZ.inOut) =>
  interpolate(f, [a, b], [from, to], { ...cl, easing: ease });

/** Point along a path at a progress 0..1. */
export const pointAt = (d: string, p: number) => getPointAtLength(d, getLength(d) * Math.min(1, Math.max(0, p))) ?? { x: 0, y: 0 };

/** A drawn cursor travelling on an arc, with a click ripple. */
export function Cursor({ from, to, at, travel = 20, clickAt, scale = 1 }: { from: [number, number]; to: [number, number]; at: number; travel?: number; clickAt: number; scale?: number }) {
  const f = useCurrentFrame();
  const [x0, y0] = from;
  const [x1, y1] = to;
  const mx = (x0 + x1) / 2 - (y1 - y0) * 0.18;
  const my = (y0 + y1) / 2 + (x1 - x0) * 0.18;
  const d = `M ${x0} ${y0} Q ${mx} ${my} ${x1} ${y1}`;
  const p = interpolate(f, [at, at + travel], [0, 1], { ...cl, easing: EZ.inOut });
  const pt = pointAt(d, p);
  const press = interpolate(f, [clickAt, clickAt + 2, clickAt + 6], [1, 0.85, 1], cl);
  const ring = interpolate(f, [clickAt, clickAt + 12], [0, 1], { ...cl, easing: EZ.out });
  const show = interpolate(f, [at - 4, at], [0, 1], cl);
  return (
    <>
      {f >= clickAt && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: x1 - 60 * ring * scale,
            top: y1 - 60 * ring * scale,
            width: 120 * ring * scale,
            height: 120 * ring * scale,
            borderRadius: "50%",
            border: `${3 * scale}px solid rgba(15,118,110,${1 - ring})`,
          }}
        />
      )}
      <svg
        width={40 * scale}
        height={40 * scale}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: pt.x - 4 * scale,
          top: pt.y - 2 * scale,
          opacity: show,
          transform: `scale(${press})`,
          transformOrigin: "4px 2px",
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,.35))",
        }}
      >
        <path d="M4 2l15 10-6.5 1.4L16 21l-3 1.3-3.4-7.7L4 19z" fill="#fff" stroke="#18223a" strokeWidth="1.4" />
      </svg>
    </>
  );
}

/** A product screen on a fixed 3D tilt (no landing), so a screen can continue across a cut. */
export function Plane({ children, rx = 8, ry = -10, width, style, dark = false, at }: { children: ReactNode; rx?: number; ry?: number; width: number; style?: CSSProperties; dark?: boolean; at?: number }) {
  const f = useCurrentFrame();
  const e = at == null ? 1 : interpolate(f, [at, at + 16], [0, 1], { ...cl, easing: EZ.out });
  return (
    <AbsoluteFill style={{ perspective: 2400, alignItems: "center", justifyContent: "center", ...style }}>
      <div
        style={{
          width,
          borderRadius: 18,
          overflow: "hidden",
          position: "relative",
          opacity: Math.min(1, e * 2.5),
          transform: `translateZ(${-320 * (1 - e)}px) rotateX(${rx + 18 * (1 - e) + Math.sin(f / 40) * 0.6}deg) rotateY(${ry - 22 * (1 - e) + Math.cos(f / 47) * 0.8}deg)`,
          boxShadow: dark
            ? "0 80px 140px -40px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08), 0 0 80px rgba(45,212,191,.14)"
            : "0 60px 120px -50px rgba(24,34,58,.55), 0 0 0 1px rgba(24,34,58,.08)",
          background: C.panel,
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

/** A light leak made of moving radial gradients (CSS only, no WebGL). */
export function Leak({ at, dur = 30, hue = "45,212,191", warm = "255,190,120" }: { at: number; dur?: number; hue?: string; warm?: string }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], cl);
  if (p <= 0 || p >= 1) return null;
  const a = Math.sin(p * Math.PI);
  const x1 = -20 + p * 90;
  const x2 = 110 - p * 70;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none", opacity: a }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 55% 75% at ${x1}% 40%, rgba(${hue},.75) 0%, rgba(${hue},0) 70%)` }} />
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 40% 60% at ${x2}% 70%, rgba(${warm},.55) 0%, rgba(${warm},0) 70%)` }} />
    </AbsoluteFill>
  );
}

/** An agent badge that catches the thread at `catchAt`: pop, ripple, label. */
export function Catch({
  code,
  name,
  catchAt,
  size = 84,
  dark = false,
  x,
  y,
  labelSize,
  style,
}: {
  code: string;
  name?: string;
  catchAt: number;
  size?: number;
  dark?: boolean;
  x: number;
  y: number;
  labelSize?: number;
  style?: CSSProperties;
}) {
  const f = useCurrentFrame();
  const t = f - catchAt;
  const on = t >= 0;
  const bump = on ? Math.sin(Math.min(1, t / 9) * Math.PI) : 0;
  const ring = on ? Math.min(1, t / 14) : 0;
  const scale = (on ? 1 : 0.9) + 0.22 * bump;
  const fg = dark ? C.glow : C.agent;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, ...style }}>
      {on && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: -size * (0.5 + ring * 0.6),
            top: -size * (0.5 + ring * 0.6),
            width: size * (1 + ring * 1.2),
            height: size * (1 + ring * 1.2),
            borderRadius: size * 0.3,
            border: `3px solid ${fg}`,
            opacity: 1 - ring,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: size * 0.22,
          background: on ? C.agent : dark ? "rgba(24,34,58,.6)" : C.panel,
          border: `${Math.max(2, size * 0.04)}px solid ${on ? (dark ? C.glow : C.agent) : dark ? "rgba(45,212,191,.45)" : C.agent}`,
          color: on ? "#fff" : fg,
          fontFamily: F.text,
          fontWeight: 700,
          fontSize: size * 0.36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale})`,
          boxShadow: on ? `0 0 0 ${size * 0.12}px ${dark ? "rgba(45,212,191,.18)" : C.agent + "22"}, 0 0 ${dark ? 40 : 0}px rgba(45,212,191,.45)` : "none",
        }}
      >
        {code}
      </div>
      {name && (
        <div
          style={{
            position: "absolute",
            top: size / 2 + 14,
            left: -200,
            width: 400,
            textAlign: "center",
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: labelSize ?? size * 0.32,
            color: dark ? C.boardText : C.ink,
            opacity: on ? 1 : 0.4,
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
}

/** A gate pill in the brand style that turns from amber to a teal check at `okAt`. */
export function Gate({ who, role, okAt, size = 26, x, y, showAt = -999 }: { who: string; role?: string; okAt: number; size?: number; x: number; y: number; showAt?: number }) {
  const f = useCurrentFrame();
  const show = interpolate(f, [showAt, showAt + 8], [0, 1], { ...cl, easing: EZ.out });
  const ok = interpolate(f, [okAt, okAt + 10], [0, 1], cl);
  const done = ok > 0.01;
  const bump = f >= okAt ? Math.sin(Math.min(1, (f - okAt) / 9) * Math.PI) : 0;
  const color = done ? C.agent : C.held;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute",
          transform: `translate(-50%, -50%) scale(${(0.8 + 0.2 * show) * (1 + 0.12 * bump)})`,
          opacity: show,
          display: "flex",
          alignItems: "center",
          gap: size * 0.5,
          background: done ? C.agentTint : C.heldBg,
          border: `${Math.max(2, size * 0.08)}px solid ${color}`,
          color,
          borderRadius: 999,
          padding: `${size * 0.45}px ${size * 0.9}px`,
          fontFamily: F.text,
          fontWeight: 700,
          fontSize: size,
          whiteSpace: "nowrap",
          boxShadow: "0 18px 40px -24px rgba(24,34,58,.5)",
        }}
      >
        <svg width={size * 1.15} height={size * 1.15} viewBox="0 0 24 24" fill="none">
          {done ? (
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeDasharray="24" strokeDashoffset={24 * (1 - ok)} strokeLinecap="round" />
          ) : (
            <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="3" />
          )}
        </svg>
        {who}
        {role && <span style={{ fontWeight: 400, opacity: 0.85 }}>· {role}</span>}
      </div>
    </div>
  );
}

/** Text typed character by character with a caret. */
export function Typed({ text, at, cps = 1.2, style }: { text: string; at: number; cps?: number; style?: CSSProperties }) {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((f - at) * cps)));
  const caret = f >= at && Math.floor(f / 8) % 2 === 0;
  return (
    <span style={style}>
      {text.slice(0, n)}
      <span style={{ opacity: caret ? 1 : 0, borderLeft: "2px solid currentColor", marginLeft: 1 }}>&#8203;</span>
    </span>
  );
}
