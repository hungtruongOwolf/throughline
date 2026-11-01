import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { evolvePath, getLength, getPointAtLength } from "@remotion/paths";
import { Trail } from "@remotion/motion-blur";
import { C, F } from "../theme";

/**
 * Shared motion vocabulary for the film (see the motion playbook). 120 BPM: a beat is 15 frames,
 * a bar is 60. Every scene builds from these so the film has one hand.
 */
export const BEAT = 15;
export const BAR = 60;
export const EZ = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
};
export const SP = {
  snappy: { damping: 20, stiffness: 200 },
  heavy: { damping: 15, stiffness: 80, mass: 2 },
  calm: { damping: 200 },
};
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0..1 between two frames. */
export function useT(from: number, to: number, ease = EZ.inOut) {
  const f = useCurrentFrame();
  return interpolate(f, [from, to], [0, 1], { ...clamp, easing: ease });
}

/** A spring starting at `at`. */
export function useSpring(at: number, config: Partial<typeof SP.snappy & { mass: number }> = SP.calm, durationInFrames?: number) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: f - at, fps, config, ...(durationInFrames ? { durationInFrames } : {}) });
}

/** Organic handheld drift, so nothing is ever perfectly still. */
export function useDrift(seed: string, depth = 1, amp = 12) {
  const f = useCurrentFrame();
  return {
    x: noise2D(seed + "x", f * 0.008, 0) * amp * depth,
    y: noise2D(seed + "y", f * 0.008, 10) * amp * 0.6 * depth,
    r: noise2D(seed + "r", f * 0.005, 20) * 0.35 * depth,
  };
}

export function Drift({ seed, depth = 1, amp = 12, children, style }: { seed: string; depth?: number; amp?: number; children: ReactNode; style?: CSSProperties }) {
  const d = useDrift(seed, depth, amp);
  return <AbsoluteFill style={{ transform: `translate(${d.x}px, ${d.y}px) rotate(${d.r}deg)`, ...style }}>{children}</AbsoluteFill>;
}

/** Headline lines rising from behind a mask. */
export function LineReveal({
  lines,
  at,
  size = 140,
  color = C.boardText,
  exitAt,
  align = "left",
  font = F.display,
  weight = 800,
}: {
  lines: ReactNode[];
  at: number;
  size?: number;
  color?: string;
  exitAt?: number;
  align?: "left" | "center";
  font?: string;
  weight?: number;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontFamily: font, fontWeight: weight, fontSize: size, color, letterSpacing: "-0.02em", textAlign: align }}>
      {lines.map((line, i) => {
        const p = spring({ frame: f - at - i * 5, fps, config: SP.calm, durationInFrames: 16 });
        const out = exitAt == null ? 0 : interpolate(f, [exitAt + i * 2, exitAt + i * 2 + 9], [0, 1], { ...clamp, easing: EZ.in });
        return (
          <div key={i} style={{ overflow: "hidden", lineHeight: 1.02, paddingBottom: "0.08em" }}>
            <div style={{ transform: `translateY(${(1 - p) * 105 - out * 105}%)` }}>{line}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Words landing one by one: blur-in, scale settle, tracking settle. */
export function WordSlam({
  text,
  at,
  stagger = 3,
  size = 160,
  color = C.boardText,
  accent,
  style,
}: {
  text: string;
  at: number;
  stagger?: number;
  size?: number;
  color?: string;
  /** words to color teal (exact match) */
  accent?: string[];
  style?: CSSProperties;
}) {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: "0.24em", fontFamily: F.display, fontWeight: 800, fontSize: size, lineHeight: 1, color, ...style }}>
      {text.split(" ").map((w, i) => {
        const p = interpolate(f, [at + i * stagger, at + i * stagger + 10], [0, 1], { ...clamp, easing: EZ.out });
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              filter: `blur(${(1 - p) * 14}px)`,
              transform: `scale(${1.18 - 0.18 * p})`,
              letterSpacing: `${0.08 - 0.1 * p}em`,
              color: accent?.includes(w.replace(/[.,!?]/g, "")) ? C.glow : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}

/** A product screen floating on a tilted 3D plane, with one specular sweep. */
export function TiltScreen({
  children,
  at = 0,
  dur,
  width = 1440,
  from = { rx: 28, ry: -30 },
  to = { rx: 10, ry: -14 },
  glowDark = true,
  style,
}: {
  children: ReactNode;
  at?: number;
  dur: number;
  width?: number;
  from?: { rx: number; ry: number };
  to?: { rx: number; ry: number };
  glowDark?: boolean;
  style?: CSSProperties;
}) {
  const f = useCurrentFrame();
  const land = useSpring(at, SP.heavy);
  const drift = interpolate(f, [at, Math.max(at + 1, dur)], [0, 1], clamp);
  const rx = from.rx + (to.rx - from.rx) * land + 3 * drift;
  const ry = from.ry + (to.ry - from.ry) * land + 4 * drift;
  const z = -400 * (1 - land);
  const sweep = interpolate(f, [at + 26, at + 46], [-60, 160], clamp);
  return (
    <AbsoluteFill style={{ perspective: 2400, alignItems: "center", justifyContent: "center", ...style }}>
      <div
        style={{
          width,
          borderRadius: 18,
          overflow: "hidden",
          position: "relative",
          opacity: Math.min(1, land * 2),
          transform: `translateZ(${z}px) rotateX(${rx}deg) rotateY(${ry}deg)`,
          boxShadow: glowDark
            ? "0 80px 140px -40px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08), 0 0 80px rgba(45,212,191,.14)"
            : "0 60px 120px -50px rgba(24,34,58,.55), 0 0 0 1px rgba(24,34,58,.08)",
          background: C.panel,
        }}
      >
        {children}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `linear-gradient(105deg, transparent ${sweep - 20}%, rgba(255,255,255,.2) ${sweep}%, transparent ${sweep + 20}%)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

/** A part of a screenshot (crop in the image's own pixels), drawn at `width`. */
export function Shot({ src, crop, width, children }: { src: string; crop: { x: number; y: number; w: number; h: number }; width: number; children?: ReactNode }) {
  const k = width / crop.w;
  return (
    <div style={{ width, height: crop.h * k, position: "relative", overflow: "hidden" }}>
      <Img
        src={staticFile(src)}
        style={{ position: "absolute", left: -crop.x * k, top: -crop.y * k, transformOrigin: "0 0", transform: `scale(${k})`, maxWidth: "none" }}
      />
      {children}
    </div>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
const camFor = (r: Rect, pad = 1.3) => {
  const s = Math.min(1920 / (r.w * pad), 1080 / (r.h * pad));
  return { s, tx: 960 - (r.x + r.w / 2) * s, ty: 540 - (r.y + r.h / 2) * s };
};

/** Camera moves between rectangles of a 1920x1080 stage (zoom in log space). */
export function Camera({ keys, pad = 1.3, children }: { keys: { at: number; rect: Rect }[]; pad?: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const cams = keys.map((k) => camFor(k.rect, pad));
  const frames = keys.map((k) => k.at);
  const o = { ...clamp, easing: EZ.inOut };
  const logS = keys.length > 1 ? interpolate(f, frames, cams.map((c) => Math.log(c.s)), o) : Math.log(cams[0]!.s);
  const tx = keys.length > 1 ? interpolate(f, frames, cams.map((c) => c.tx), o) : cams[0]!.tx;
  const ty = keys.length > 1 ? interpolate(f, frames, cams.map((c) => c.ty), o) : cams[0]!.ty;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${Math.exp(logS)})` }}>
        {children}
      </div>
    </AbsoluteFill>
  );
}
export const FULL: Rect = { x: 0, y: 0, w: 1920 / 1.3, h: 1080 / 1.3 };

/** The thread drawing itself, with a glowing comet head. */
export function CometThread({ d, progress, color = C.glow, width = 6, head = true }: { d: string; progress: number; color?: string; width?: number; head?: boolean }) {
  const len = getLength(d);
  const p = Math.min(1, Math.max(0.0001, progress));
  const { strokeDasharray, strokeDashoffset } = evolvePath(p, d);
  const pt = getPointAtLength(d, len * p) ?? { x: 0, y: 0 };
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={d} fill="none" stroke={color} strokeWidth={width * 3} strokeOpacity={0.3} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} style={{ filter: "blur(8px)" }} strokeLinecap="round" />
        <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {head && progress > 0.001 && progress < 0.999 && (
        <Trail layers={5} lagInFrames={1} trailOpacity={0.6}>
          <div
            style={{
              position: "absolute",
              left: pt.x - 10,
              top: pt.y - 10,
              width: 20,
              height: 20,
              borderRadius: 10,
              background: "#e9fffb",
              boxShadow: `0 0 18px 6px ${color}, 0 0 50px 16px ${color}80`,
            }}
          />
        </Trail>
      )}
    </>
  );
}

/** Rolling odometer digits for a number that counts to `value` between two frames. */
export function Odometer({ value, at, frames = 22, size = 260, color = C.boardText, decimals = 0, suffix }: { value: number; at: number; frames?: number; size?: number; color?: string; decimals?: number; suffix?: ReactNode }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + frames], [0, 1], { ...clamp, easing: EZ.out });
  const v = value * p;
  const digits = Math.max(1, Math.floor(Math.log10(Math.max(1, value))) + 1);
  const cols = Array.from({ length: digits }, (_, i) => digits - 1 - i);
  const land = interpolate(f, [at + frames, at + frames + 8], [1.06, 1], clamp);
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontFamily: F.figure, fontWeight: 600, fontSize: size, lineHeight: 1, color, fontVariantNumeric: "tabular-nums", transform: `scale(${f > at + frames ? land : 1})` }}>
      {cols.map((k) => {
        const raw = v / 10 ** k;
        const col = k === 0 ? raw % 10 : Math.floor(raw) % 10;
        return (
          <span key={k} style={{ display: "inline-block", height: "1em", overflow: "hidden", verticalAlign: "top" }}>
            <span style={{ display: "block", transform: `translateY(${-(col % 10) * (100 / 11)}%)` }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, i) => (
                <span key={i} style={{ display: "block", height: "1em" }}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
      {decimals > 0 && <span>.{Math.floor((v % 1) * 10 ** decimals)}</span>}
      {suffix && <span style={{ fontSize: "0.4em", marginLeft: "0.08em" }}>{suffix}</span>}
    </div>
  );
}

/** Drop hit: flash, RGB split, decaying shake, scale bump. Use three times in the film. */
export function DropHit({ at, children }: { at: number; children: ReactNode }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f - at;
  const k = t < 0 ? 0 : Math.exp(-t / 4);
  const shake = t < 0 ? 0 : 16 * Math.exp(-t / 5);
  const sx = noise2D("sx", f * 0.6, 0) * shake;
  const sy = noise2D("sy", f * 0.6, 0) * shake;
  const bump = t < 0 ? 1 : 1 + 0.08 * (1 - spring({ frame: t, fps, config: SP.snappy }));
  const split = 10 * k;
  return (
    <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(${bump})` }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id="keepRed">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
        </filter>
      </svg>
      {split > 0.3 && <AbsoluteFill style={{ transform: `translateX(${-split}px)`, mixBlendMode: "screen", opacity: 0.6, filter: "url(#keepRed)" }}>{children}</AbsoluteFill>}
      <AbsoluteFill>{children}</AbsoluteFill>
      <AbsoluteFill style={{ background: "#e9fffb", opacity: t < 0 ? 0 : 0.85 * Math.exp(-t / 1.5), pointerEvents: "none" }} />
    </AbsoluteFill>
  );
}

/** Global finish: film grain every 2 frames and a vignette. */
export function Finish({ dark }: { dark: boolean }) {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2) % 12;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: dark ? 0.07 : 0.035, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(5,10,20,${dark ? 0.55 : 0.18}) 100%)` }} />
    </AbsoluteFill>
  );
}

/** A dark stage with a dim teal light behind the subject. */
export function Night({ children, light = 0.12 }: { children: ReactNode; light?: number }) {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(45,212,191,${light}) 0%, transparent 60%)` }} />
      {children}
    </AbsoluteFill>
  );
}

/** A paper stage with the faint grid. */
export function Day({ children }: { children: ReactNode }) {
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
