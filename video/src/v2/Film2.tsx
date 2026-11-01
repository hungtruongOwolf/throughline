import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";
import timeline from "./timeline.json";
import { Finish } from "./fx";
import { AgentLayer } from "./overlay";
import type { Scene, SceneProps } from "./types";
import { scenes as a } from "./scenes/a";
import { scenes as b } from "./scenes/b";
import { scenes as c } from "./scenes/c";
import { scenes as d } from "./scenes/d";
import { fallback } from "./scenes/a";

export type ShotRow = { id: number | string; beat: string; start: number; dur: number; vo: number; text?: string };
export const SHOTS = timeline.shots as ShotRow[];
export const TOTAL = timeline.total;
const REGISTRY: Record<string, Scene> = { ...a, ...b, ...c, ...d };

export const sceneFor = (beat: string): Scene => REGISTRY[beat] ?? { C: fallback, dark: true };
const voFile = (s: ShotRow) => `audio/vo2/l${String(s.id).padStart(2, "0")}.wav`;

/** One shot with its own voice line, as the film plays it. */
export function ShotView({ shot }: { shot: ShotRow }) {
  const { C, dark } = sceneFor(shot.beat);
  const props: SceneProps = { dur: shot.dur, vo: shot.vo, start: shot.start, text: shot.text ?? "" };
  return (
    <AbsoluteFill>
      <C {...props} />
      <Finish dark={dark !== false} />
      {shot.vo > 0 && <Audio src={staticFile(voFile(shot))} />}
    </AbsoluteFill>
  );
}

const VO_SPANS = SHOTS.filter((s) => s.vo > 0).map((s) => [s.start, s.start + s.vo] as const);
const ducked = (f: number) => {
  let g = 1;
  for (const [s, e] of VO_SPANS)
    g = Math.min(g, interpolate(f, [s - 6, s, e, e + 12], [1, 0.33, 0.33, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return g;
};

export function Film2() {
  return (
    <AbsoluteFill style={{ background: "#18223a" }}>
      {SHOTS.map((s) => (
        <Sequence key={String(s.id)} from={s.start} durationInFrames={s.dur}>
          <ShotView shot={s} />
        </Sequence>
      ))}
      <AgentLayer shots={SHOTS} />
      <Audio src={staticFile("audio/music2/music.wav")} volume={(f) => 0.85 * ducked(f)} />
    </AbsoluteFill>
  );
}
