import type { CSSProperties, ReactNode } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, E, F } from "../theme";

/** 0..1 progress between two frames, eased. */
export function useProgress(from: number, to: number, ease = E.draw) {
  const f = useCurrentFrame();
  return interpolate(f, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}

/** Calm spring with no overshoot, starting at `at`. */
export function useEnter(at: number, damping = 200) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config: { damping } });
}

/** The thread: a teal stroke that draws itself along an SVG path. */
export function Thread({
  d,
  progress,
  dark = false,
  width = 6,
  length = 4000,
}: {
  d: string;
  progress: number;
  dark?: boolean;
  width?: number;
  length?: number;
}) {
  const color = dark ? C.glow : C.agent;
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeOpacity={dark ? 0.35 : 0.18}
        strokeWidth={width * 3.2}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - progress)}
        style={{ filter: `blur(${dark ? 6 : 4}px)` }}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - progress)}
      />
    </g>
  );
}

/** A wayfinding sign blade: navy (or amber for a person's gate) with an arrow. */
export function SignBlade({
  label,
  tone = "ink",
  accent,
  width = 300,
  style,
  arrow = true,
}: {
  label: ReactNode;
  tone?: "ink" | "held" | "agent";
  accent?: string;
  width?: number;
  style?: CSSProperties;
  arrow?: boolean;
}) {
  const bg = tone === "held" ? C.heldBg : tone === "agent" ? C.agent : C.ink;
  const fg = tone === "held" ? C.held : C.boardText;
  return (
    <div
      style={{
        width,
        height: 84,
        background: bg,
        color: fg,
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 26px",
        fontFamily: F.display,
        fontWeight: 700,
        fontSize: 34,
        letterSpacing: "-0.01em",
        boxShadow: "0 1px 0 rgba(255,255,255,.12) inset, 0 18px 40px -22px rgba(10,16,30,.7)",
        border: tone === "held" ? `2px solid ${C.held}` : "none",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {accent && (
        <span
          style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 8, background: accent }}
        />
      )}
      <span style={{ flex: 1, whiteSpace: "nowrap" }}>{label}</span>
      {arrow && (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <path d="M4 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.8" strokeLinecap="square" />
        </svg>
      )}
    </div>
  );
}

/** An agent: a ring with the app's two-letter badge, filling and shimmering when it works. */
export function AgentNode({
  badge,
  name,
  active,
  shimmer = 0,
  size = 64,
  dark = false,
  showName = true,
}: {
  badge: string;
  name?: string;
  active: number; // 0..1
  shimmer?: number; // 0..1 sweep
  size?: number;
  dark?: boolean;
  showName?: boolean;
}) {
  const ring = dark ? C.glow : C.agent;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `3px solid ${ring}`,
          background: active > 0.5 ? ring : dark ? C.ink : C.panel,
          color: active > 0.5 ? (dark ? C.ink : "#fff") : ring,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: F.text,
          fontWeight: 700,
          fontSize: size * 0.34,
          transform: `scale(${0.85 + 0.15 * active})`,
          boxShadow: active > 0.5 ? `0 0 0 ${10 * active}px ${ring}22` : "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {badge}
        {shimmer > 0 && shimmer < 1 && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(90deg, transparent, ${C.agentTint}cc, transparent)`,
              transform: `translateX(${-100 + 200 * shimmer}%)`,
            }}
          />
        )}
      </div>
      {showName && name && (
        <div
          style={{
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 20,
            color: dark ? C.boardText : C.ink,
            opacity: active,
            transform: `translateY(${(1 - active) * 6}px)`,
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </div>
      )}
    </div>
  );
}

/** A big tabular number that counts to its value. */
export function BigNumber({
  from,
  to,
  start,
  frames = 24,
  format = (n: number) => Math.round(n).toLocaleString("en-US"),
  size = 220,
  color = C.ink,
  suffix,
  style,
}: {
  from: number;
  to: number;
  start: number;
  frames?: number;
  format?: (n: number) => string;
  size?: number;
  color?: string;
  suffix?: ReactNode;
  style?: CSSProperties;
}) {
  const p = useProgress(start, start + frames, E.out);
  const enter = useEnter(start - 4);
  return (
    <div
      style={{
        fontFamily: F.figure,
        fontWeight: 600,
        fontSize: size,
        lineHeight: 0.9,
        color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.02em",
        opacity: enter,
        transform: `translateY(${(1 - enter) * 30}px)`,
        display: "flex",
        alignItems: "baseline",
        gap: size * 0.08,
        ...style,
      }}
    >
      <span>{format(from + (to - from) * p)}</span>
      {suffix && <span style={{ fontSize: size * 0.32, fontWeight: 500 }}>{suffix}</span>}
    </div>
  );
}

/** A faint 24 px grid on paper. */
export function PaperGrid({ opacity = 1 }: { opacity?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        backgroundImage: `linear-gradient(${C.rule}55 1px, transparent 1px), linear-gradient(90deg, ${C.rule}55 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }}
    />
  );
}

/** A small person-at-a-gate tag. */
export function GateTag({ who, role, check }: { who: string; role: string; check: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: check > 0.5 ? C.agentTint : C.heldBg,
        border: `2px solid ${check > 0.5 ? C.agent : C.held}`,
        color: check > 0.5 ? C.agent : C.held,
        borderRadius: 999,
        padding: "12px 24px",
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: 26,
      }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        {check > 0 ? (
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="24"
            strokeDashoffset={24 * (1 - check)}
            strokeLinecap="round"
          />
        ) : (
          <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="3" />
        )}
      </svg>
      {who}
      <span style={{ fontWeight: 400, opacity: 0.8 }}>{role}</span>
    </div>
  );
}
