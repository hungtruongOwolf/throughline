import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, F } from "../../theme";
import { EZ, SP } from "../fx";

/** Helpers used only by scenes/d.tsx. */
export const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A snappy spring (with overshoot) from `at`. */
export function usePop(at: number, config: { damping: number; stiffness?: number; mass?: number } = SP.snappy) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config });
}

type Fx = "cut" | "whip" | "push" | "fade";

/** A sub-shot inside a scene: its children see local frames; edges can whip, push or fade. */
export function Seg({
  from,
  dur,
  inFx = "cut",
  outFx = "cut",
  dir = 1,
  origin = "50% 50%",
  children,
}: {
  from: number;
  dur: number;
  inFx?: Fx;
  outFx?: Fx;
  dir?: 1 | -1;
  origin?: string;
  children: ReactNode;
}) {
  const f = useCurrentFrame();
  const t = f - from;
  let x = 0;
  let s = 1;
  let blur = 0;
  let op = 1;
  const W = 8;
  if (inFx === "whip" && t < W) {
    const p = interpolate(t, [0, W], [0, 1], { ...cl, easing: EZ.out });
    x += (1 - p) * 1100 * dir;
    blur += (1 - p) * 18;
  }
  if (outFx === "whip" && t > dur - W) {
    const p = interpolate(t, [dur - W, dur], [0, 1], { ...cl, easing: EZ.in });
    x -= p * 1100 * dir;
    blur += p * 18;
  }
  if (inFx === "push" && t < 10) {
    const p = interpolate(t, [0, 10], [0, 1], { ...cl, easing: EZ.out });
    s *= 1.3 - 0.3 * p;
    op *= Math.min(1, t / 3 + 0.2);
  }
  if (outFx === "push" && t > dur - 10) {
    const p = interpolate(t, [dur - 10, dur], [0, 1], { ...cl, easing: EZ.in });
    s *= 1 + 0.8 * p;
    op *= 1 - p * p;
  }
  if (inFx === "fade" && t < 8) op *= Math.max(0, t / 8);
  if (outFx === "fade" && t > dur - 8) op *= Math.max(0, (dur - t) / 8);
  return (
    <Sequence from={from} durationInFrames={dur}>
      <AbsoluteFill
        style={{
          transform: `translateX(${x}px) scale(${s})`,
          transformOrigin: origin,
          filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
          opacity: op,
        }}
      >
        {children}
      </AbsoluteFill>
    </Sequence>
  );
}

export type R = { x: number; y: number; w: number; h: number };

/** An image viewed through a camera that moves between rectangles of the image (image pixels). */
export function ImgCam({
  src,
  iw,
  ih,
  w,
  h,
  keys,
  bg,
  over,
  style,
}: {
  src: string;
  iw: number;
  ih: number;
  w: number;
  h: number;
  keys: { at: number; r: R }[];
  bg?: string;
  over?: (m: (x: number, y: number) => [number, number], s: number) => ReactNode;
  style?: CSSProperties;
}) {
  const f = useCurrentFrame();
  const cs = keys.map((k) => ({ ls: Math.log(Math.min(w / k.r.w, h / k.r.h)), cx: k.r.x + k.r.w / 2, cy: k.r.y + k.r.h / 2 }));
  const fr = keys.map((k) => k.at);
  const o = { ...cl, easing: EZ.inOut };
  const pick = (g: (c: (typeof cs)[number]) => number) => (keys.length > 1 ? interpolate(f, fr, cs.map(g), o) : g(cs[0]!));
  const s = Math.exp(pick((c) => c.ls));
  const cx = pick((c) => c.cx);
  const cy = pick((c) => c.cy);
  const tx = w / 2 - cx * s;
  const ty = h / 2 - cy * s;
  const m = (x: number, y: number): [number, number] => [tx + x * s, ty + y * s];
  return (
    <div style={{ position: "relative", width: w, height: h, overflow: "hidden", background: bg, ...style }}>
      <Img
        src={staticFile(src)}
        style={{ position: "absolute", left: 0, top: 0, width: iw, height: ih, maxWidth: "none", transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}
      />
      {over?.(m, s)}
    </div>
  );
}

/** Agent badge (teal rounded square), readable on navy and on paper. */
export function Tile({
  code,
  on = 1,
  size = 84,
  dark = false,
  textOp = 1,
  muted = false,
  style,
}: {
  code: string;
  on?: number;
  size?: number;
  dark?: boolean;
  textOp?: number;
  muted?: boolean;
  style?: CSSProperties;
}) {
  const lit = on > 0.5;
  const offBorder = dark ? "rgba(244,246,242,.28)" : C.agent;
  const offText = dark ? "rgba(244,246,242,.6)" : C.agent;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: lit ? C.agent : muted ? (dark ? "rgba(255,255,255,.04)" : C.canvas) : dark ? "transparent" : C.panel,
        border: `${Math.max(2, size * 0.04)}px ${muted ? "dashed" : "solid"} ${lit ? (dark ? C.glow : C.agent) : offBorder}`,
        color: lit ? "#fff" : offText,
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: size * 0.36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: lit ? `0 0 0 ${size * 0.12 * on}px ${dark ? "rgba(45,212,191,.16)" : "rgba(15,118,110,.12)"}${dark ? `, 0 0 ${size * 0.5}px rgba(45,212,191,.35)` : ""}` : "none",
        ...style,
      }}
    >
      <span style={{ opacity: textOp }}>{code}</span>
    </div>
  );
}

/** A soft white card on paper. */
export const card: CSSProperties = {
  position: "absolute",
  background: C.panel,
  borderRadius: 18,
  boxShadow: "0 50px 90px -50px rgba(24,34,58,.55), 0 0 0 1px rgba(24,34,58,.06)",
};

/** Expanding rings (on the beat) around a rectangle. */
export function Rings({ x, y, w, h, from, to, every = 15, color, radius = 20 }: { x: number; y: number; w: number; h: number; from: number; to: number; every?: number; color: string; radius?: number }) {
  const f = useCurrentFrame();
  const out: ReactNode[] = [];
  for (let k = from; k < to; k += every) {
    const t = f - k;
    if (t < 0 || t > 24) continue;
    const p = t / 24;
    out.push(
      <div
        key={k}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: radius,
          border: `4px solid ${color}`,
          opacity: 0.7 * (1 - p),
          transform: `scale(${1 + 0.18 * EZ.out(p)})`,
        }}
      />,
    );
  }
  return <>{out}</>;
}
