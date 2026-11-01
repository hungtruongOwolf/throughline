import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import timeline from "./timeline.json";
import narration from "../../narration4.json";
import { Finish } from "../v2/fx";
import { sceneFor } from "../v2/Film2";
import { Gates, Stages } from "../v3/scenes";
import { AgentLayer3 } from "../v3/overlay3";
import { PhoneScreen, Screen, type Row3 } from "../v3/Film3";
import { ANIM } from "./anim";
import { C } from "../theme";

type Row4 = Omit<Row3, "kind"> & { kind: "v4" | "v2" | "new" | "clip" | "phone" };
export const SHOTS4 = timeline.shots as Row4[];
export const TOTAL4 = timeline.total;
const OV = timeline.ov;
const LEAD = timeline.lead;
const TEXT = Object.fromEntries((narration as { id: number; text: string }[]).map((n) => [n.id, n.text]));

function Visual({ row }: { row: Row4 }) {
  const text = TEXT[row.line] ?? "";
  if (row.kind === "clip") return <Screen row={row as Row3} />;
  if (row.kind === "phone") return <PhoneScreen row={row as Row3} />;
  if (row.kind === "new") return row.name === "Gates" ? <Gates dur={row.dur} /> : <Stages dur={row.dur} />;
  if (row.kind === "v2") {
    // these scenes pace themselves to whatever length they get
    const { C: Scene } = sceneFor(row.name);
    return <Scene dur={row.dur} vo={row.vo} start={row.start} text={text} />;
  }
  const Scene = ANIM[row.line]!;
  return <Scene dur={row.dur} vo={row.vo} text={text} />;
}

/** Every shot fades in over the one before it. */
function Crossfade({ first, children }: { first: boolean; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = first ? 1 : interpolate(f, [0, OV], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

const VOICES = SHOTS4.filter((s) => s.vo > 0).map((s) => ({ line: s.line, at: s.start + LEAD, len: s.vo }));
const ducked = (f: number) => {
  let g = 1;
  for (const v of VOICES)
    g = Math.min(g, interpolate(f, [v.at - 8, v.at, v.at + v.len, v.at + v.len + 14], [1, 0.22, 0.22, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return g;
};

export function Film4() {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {SHOTS4.map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.dur}>
          <Crossfade first={i === 0}>
            <Visual row={s} />
            <Finish dark={s.kind !== "phone"} />
          </Crossfade>
        </Sequence>
      ))}
      <AgentLayer3 shots={SHOTS4 as Row3[]} />
      {VOICES.map((v) => (
        <Sequence key={v.line} from={v.at} durationInFrames={v.len + 30} layout="none">
          <Audio src={staticFile(`audio/vo4/v${String(v.line).padStart(2, "0")}.wav`)} />
        </Sequence>
      ))}
      {/* "Mountains" by Andrew Ev (Mixkit License), a middle section repeated to fit */}
      <Audio src={staticFile("audio/mountains-v4.wav")} volume={(f) => 0.35 * ducked(f)} />
    </AbsoluteFill>
  );
}
