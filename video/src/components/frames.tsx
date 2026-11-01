import type { CSSProperties, ReactNode } from "react";
import { Audio, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { C, E } from "../theme";
import { useEnter } from "./kit";

/** A sound effect at a frame inside the current scene. */
export function Sfx({ at, name, volume = 0.6 }: { at: number; name: string; volume?: number }) {
  return (
    <Sequence from={Math.max(0, Math.round(at))} layout="none">
      {/* sound effects sit well under the voice and the music */}
      <Audio src={staticFile(`audio/sfx/${name}.wav`)} volume={volume * 0.7} />
    </Sequence>
  );
}

/** Part of a screenshot: crop is in the image's own pixels. */
export function Crop({
  src,
  crop,
  width,
  style,
  children,
}: {
  src: string;
  crop: { x: number; y: number; w: number; h: number };
  width: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const scale = width / crop.w;
  return (
    <div style={{ width, height: crop.h * scale, overflow: "hidden", position: "relative", ...style }}>
      <Img
        src={staticFile(src)}
        style={{
          position: "absolute",
          left: -crop.x * scale,
          top: -crop.y * scale,
          transformOrigin: "0 0",
          transform: `scale(${scale})`,
          maxWidth: "none",
        }}
      />
      {children}
    </div>
  );
}

/** A floating browser window around real product footage, with a slow push-in and tilt. */
export function BrowserFrame({
  children,
  at = 0,
  dur = 300,
  tilt = 0,
  style,
}: {
  children: ReactNode;
  at?: number;
  dur?: number;
  tilt?: number;
  style?: CSSProperties;
}) {
  const f = useCurrentFrame();
  const enter = useEnter(at);
  const push = interpolate(f, [at, at + dur], [1, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 14,
        overflow: "hidden",
        background: C.panel,
        boxShadow: "0 50px 90px -40px rgba(24,34,58,.55), 0 0 0 1px rgba(24,34,58,.08)",
        opacity: enter,
        transform: `perspective(2200px) translateY(${(1 - enter) * 60}px) rotateY(${tilt * (1 - 0.4 * enter)}deg) scale(${push})`,
        ...style,
      }}
    >
      <div
        style={{
          height: 38,
          background: C.canvas,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 16px",
          borderBottom: `1px solid ${C.rule}`,
        }}
      >
        {["#e5e7eb", "#e5e7eb", "#e5e7eb"].map((c, i) => (
          <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
        ))}
      </div>
      {children}
    </div>
  );
}

/** A phone around a screenshot of the patient app. */
export function Phone({
  children,
  width = 400,
  style,
}: {
  children: ReactNode;
  width?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width,
        height: width * 2.05,
        borderRadius: width * 0.13,
        background: C.ink,
        padding: width * 0.035,
        boxShadow: "0 60px 100px -50px rgba(24,34,58,.7)",
        position: "relative",
        ...style,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: width * 0.1,
          overflow: "hidden",
          background: C.paper,
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A teal ring that draws around the thing the footage proves, and dims the rest. */
export function FocusRing({
  x,
  y,
  w,
  h,
  at,
  tone = "agent",
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  at: number;
  tone?: "agent" | "held";
}) {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.out,
  });
  const color = tone === "held" ? C.held : C.agent;
  return (
    <div
      style={{
        position: "absolute",
        left: x - 8,
        top: y - 8,
        width: w + 16,
        height: h + 16,
        borderRadius: 10,
        border: `4px solid ${color}`,
        borderColor: p > 0.01 ? color : "transparent",
        transform: `scale(${1.15 - 0.15 * p})`,
        // the rest of the screen dims around the ring
        boxShadow: `0 0 0 ${8 * p}px ${color}33, 0 0 0 3000px rgba(24,34,58,${0.16 * p})`,
      }}
    />
  );
}
