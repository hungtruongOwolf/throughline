import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import timeline from "./timeline.json";
import narration from "../../narration7.json";
import { Finish } from "../v2/fx";
import { sceneFor } from "../v2/Film2";
import { AgentLayer3, type Cue } from "../v3/overlay3";
import { PhoneScreen, Screen, type Row3 } from "../v3/Film3";
import { SCENES } from "./scenes";
import { C } from "../theme";

type Row5 = Omit<Row3, "kind"> & { kind: "v5" | "v2" | "clip" | "phone" };
export const SHOTS5 = timeline.shots as Row5[];
export const TOTAL5 = timeline.total;
const OV = timeline.ov;
const LEAD = timeline.lead;
const TEXT = Object.fromEntries((narration as { id: number; text: string }[]).map((n) => [n.id, n.text]));

/** Which agent's card shows when, by voice line and how far into it. */
const CUES: Cue[] = [
  { line: 12, at: 0.05, code: "IN" },
  { line: 14, at: 0.05, code: "CV" },
  { line: 14, at: 0.35, code: "PA" },
  { line: 16, at: 0.55, code: "CO" },
  { line: 19, at: 0.05, code: "WS" },
  { line: 20, at: 0.0, code: "OP" },
  { line: 24, at: 0.05, code: "DS" },
  { line: 25, at: 0.05, code: "FU" },
  { line: 26, at: 0.0, code: "RW" },
];

function Visual({ row }: { row: Row5 }) {
  const text = TEXT[row.line] ?? "";
  if (row.kind === "clip") return <Screen row={row as Row3} />;
  if (row.kind === "phone") return <PhoneScreen row={row as Row3} />;
  if (row.kind === "v2") {
    // these scenes pace themselves to whatever length they get
    const { C: Scene } = sceneFor(row.name);
    return <Scene dur={row.dur} vo={row.vo} start={row.start} text={text} />;
  }
  const Scene = SCENES[row.name]!;
  return <Scene dur={row.dur} vo={row.vo} text={text} />;
}

/** Every shot fades in over the one before it. */
function Crossfade({ first, children }: { first: boolean; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const o = first ? 1 : interpolate(f, [0, OV], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

const VOICES = SHOTS5.filter((s) => s.vo > 0).map((s) => ({ line: s.line, at: s.start + LEAD, len: s.vo }));
const ducked = (f: number) => {
  let g = 1;
  for (const v of VOICES)
    g = Math.min(g, interpolate(f, [v.at - 8, v.at, v.at + v.len, v.at + v.len + 14], [1, 0.22, 0.22, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return g;
};

export function Film5() {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      {SHOTS5.map((s, i) => (
        <Sequence key={i} from={s.start} durationInFrames={s.dur}>
          <Crossfade first={i === 0}>
            <Visual row={s} />
            <Finish dark={s.kind !== "phone"} />
          </Crossfade>
        </Sequence>
      ))}
      <AgentLayer3 shots={SHOTS5 as Row3[]} cues={CUES} />
      {VOICES.map((v) => (
        <Sequence key={v.line} from={v.at} durationInFrames={v.len + 30} layout="none">
          <Audio src={staticFile(`audio/vo7/v${String(v.line).padStart(2, "0")}.wav`)} />
        </Sequence>
      ))}
      {/* "Mountains" by Andrew Ev (Mixkit License), trimmed to fit */}
      <Audio src={staticFile("audio/mountains-v7.wav")} volume={(f) => 0.35 * ducked(f)} />
    </AbsoluteFill>
  );
}
