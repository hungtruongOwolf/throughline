import { AbsoluteFill, Audio, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import timeline from "./timeline.json";
import narration from "../../narration3.json";
import { Finish, useDrift, useSpring, useT } from "../v2/fx";
import { sceneFor } from "../v2/Film2";
import { Gates, Stages } from "./scenes";
import { AgentLayer3 } from "./overlay3";
import { C } from "../theme";

export type Row3 = { line: number; kind: "anim" | "clip" | "phone" | "still" | "new"; name: string; start: number; dur: number; vo: number; part: string; from?: number; to?: number };
export const SHOTS3 = timeline.shots as Row3[];
export const TOTAL3 = timeline.total;
const TEXT = Object.fromEntries((narration as { id: number; text: string }[]).map((n) => [n.id, n.text]));

/** A real recording at 1x: plays its segment, then holds the last frame. */
function Recording({ src, from, to, dur, phone }: { src: string; from: number; to: number; dur: number; phone: boolean }) {
  const play = Math.round((to - from) * 30);
  const video = (
    <OffthreadVideo src={staticFile(`demo/${src}.mp4`)} trimBefore={Math.round(from * 30)} muted style={{ width: "100%", display: "block" }} />
  );
  return (
    <>
      <Sequence durationInFrames={Math.min(play, dur)} layout="none">
        {video}
      </Sequence>
      {dur > play && (
        <Sequence from={play} layout="none">
          <Freeze frame={Math.max(0, play - 1)}>{video}</Freeze>
        </Sequence>
      )}
    </>
  );
}

/** A desktop recording, framed and gently moving so the screen never feels pasted on. */
function Screen({ row }: { row: Row3 }) {
  const f = useCurrentFrame();
  const enter = useSpring(0, { damping: 200 }, 18);
  const d = useDrift(row.name + row.line, 0.4, 8);
  const push = interpolate(f, [0, row.dur], [1, 1.035]);
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(45,212,191,.10), transparent 65%)" }} />
      <div
        style={{
          width: 1800,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 60px 120px -40px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.08)",
          opacity: enter,
          transform: `translate(${d.x}px, ${d.y + (1 - enter) * 30}px) scale(${push * (0.97 + 0.03 * enter)})`,
        }}
      >
        <Recording src={row.name} from={row.from!} to={row.to!} dur={row.dur} phone={false} />
      </div>
    </AbsoluteFill>
  );
}

/** A phone recording (Maria's app), the staff link at the top cropped away. */
function PhoneScreen({ row }: { row: Row3 }) {
  const enter = useSpring(0, { damping: 200 }, 18);
  const d = useDrift(row.name + row.line, 0.5, 8);
  const W = 470;
  return (
    <AbsoluteFill style={{ background: C.paper, alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(15,118,110,.10), transparent 60%)" }} />
      <div
        style={{
          width: W,
          height: W * 2.05,
          borderRadius: 64,
          background: C.ink,
          padding: 16,
          boxShadow: "0 70px 120px -50px rgba(24,34,58,.7)",
          opacity: enter,
          transform: `translate(${d.x}px, ${d.y + (1 - enter) * 40}px)`,
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", background: C.paper, position: "relative" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: -W * 0.155 }}>
            <Recording src={row.name} from={row.from!} to={row.to!} dur={row.dur} phone />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** The planner's proposal (a sharp still), with the camera on the numbers. */
function Proposal({ row }: { row: Row3 }) {
  const enter = useSpring(0, { damping: 200 }, 20);
  const z = useT(20, 70);
  const ring = useT(60, 74);
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 760, position: "relative", borderRadius: 16, overflow: "hidden", background: "#f4f6f5", opacity: enter, transform: `scale(${(0.9 + 0.1 * enter) * (1 + 0.28 * z)}) translateY(${-z * 140}px)`, boxShadow: "0 60px 120px -40px rgba(0,0,0,.7)" }}>
        <img src={staticFile("clips/proposal.png")} style={{ width: 760, display: "block" }} />
        <div style={{ position: "absolute", left: 70, top: 500, width: 660, height: 140, borderRadius: 10, border: `4px solid ${C.agent}`, opacity: ring, boxShadow: `0 0 0 3000px rgba(24,34,58,${0.18 * ring})` }} />
      </div>
    </AbsoluteFill>
  );
}

function Visual({ row }: { row: Row3 }) {
  if (row.kind === "clip") return <Screen row={row} />;
  if (row.kind === "phone") return <PhoneScreen row={row} />;
  if (row.kind === "still") return <Proposal row={row} />;
  if (row.kind === "new") return row.name === "Gates" ? <Gates dur={row.dur} /> : <Stages dur={row.dur} />;
  const { C: Scene } = sceneFor(row.name);
  return <Scene dur={row.dur} vo={row.vo} start={row.start} text={TEXT[row.line] ?? ""} />;
}

const VO_SPANS = SHOTS3.filter((s) => s.vo > 0).map((s) => [s.start, s.start + s.vo] as const);
const ducked = (f: number) => {
  let g = 1;
  for (const [s, e] of VO_SPANS)
    g = Math.min(g, interpolate(f, [s - 6, s, e, e + 12], [1, 0.28, 0.28, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return g;
};

export function Film3() {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {SHOTS3.map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.dur}>
          <Visual row={s} />
          <Finish dark={s.kind !== "phone"} />
          {s.vo > 0 && <Audio src={staticFile(`audio/vo3/v${String(s.line).padStart(2, "0")}.wav`)} />}
        </Sequence>
      ))}
      <AgentLayer3 shots={SHOTS3} />
      <Audio src={staticFile("audio/music3/music.wav")} volume={(f) => 0.75 * ducked(f)} />
    </AbsoluteFill>
  );
}
