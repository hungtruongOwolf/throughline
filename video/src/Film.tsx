import type { ComponentType } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile } from "remotion";
import timing from "./timing.json";
import { FPS } from "./theme";
import { ChainScene, ColdOpen, Gap, Price, Scale, Title } from "./scenes/act1";
import { Intake, Maria, PriorAuth, Schedule, ThreadScene, Voice } from "./scenes/act2";
import { Approve, BigNum, Day, Sensing, Simulate } from "./scenes/act3";
import { Campus, Close, Discharge, Models, Results } from "./scenes/act4";

type SceneProps = { dur: number; lead: number; vo: number };
type Shot = {
  vo?: keyof typeof timing;
  /** Seconds before the voice starts, after it ends, or the whole shot when there is no voice. */
  lead?: number;
  tail?: number;
  len?: number;
  C: ComponentType<SceneProps>;
};

const SHOTS: Shot[] = [
  { len: 4, C: ColdOpen },
  { vo: "p01", lead: 0.3, tail: 0.4, C: Scale },
  { vo: "p02", tail: 0.4, C: ChainScene },
  { vo: "p03", tail: 0.4, C: Price },
  { vo: "p04", tail: 0.9, C: Gap },
  { len: 3.6, C: Title },
  { vo: "p05", lead: 0.4, tail: 0.3, C: Maria },
  { vo: "p06", tail: 0.6, C: ThreadScene },
  { vo: "p07", tail: 0.4, C: Intake },
  { vo: "p08", tail: 0.4, C: PriorAuth },
  { vo: "p09", tail: 0.3, C: Schedule },
  { vo: "p10", lead: 1.9, tail: 0.4, C: Voice },
  { vo: "p11", tail: 0.3, C: Day },
  { vo: "p12", tail: 0.3, C: Sensing },
  { vo: "p13", tail: 0.3, C: Simulate },
  { vo: "p14", tail: 1.4, C: BigNum },
  { vo: "p15", tail: 0.4, C: Approve },
  { vo: "p16", tail: 0.4, C: Discharge },
  { vo: "p17", tail: 0.5, C: Results },
  { vo: "p18", tail: 0.4, C: Models },
  { vo: "p19", tail: 0.6, C: Campus },
  { vo: "p20", lead: 0.4, tail: 6, C: Close },
];

const f = (s: number) => Math.round(s * FPS);

export const PLAN = (() => {
  let at = 0;
  return SHOTS.map((s) => {
    const lead = f(s.lead ?? 0);
    const vo = s.vo ? f(timing[s.vo]) : 0;
    const dur = s.vo ? lead + vo + f(s.tail ?? 0) : f(s.len ?? 1);
    const shot = { ...s, at, dur, lead, voFrames: vo };
    at += dur;
    return shot;
  });
})();
export const TOTAL = PLAN.reduce((n, s) => n + s.dur, 0);
// The music changes key where the thread first appears (the title).
const PIVOT = PLAN[5]!.at;

export function Film() {
  return (
    <AbsoluteFill style={{ background: "#18223a" }}>
      {PLAN.map((s, i) => (
        <Sequence key={i} from={s.at} durationInFrames={s.dur}>
          <s.C dur={s.dur} lead={s.lead} vo={s.voFrames} />
          {s.vo && (
            <Sequence from={s.lead} layout="none">
              <Audio src={staticFile(`audio/vo/${s.vo}.wav`)} volume={1} />
            </Sequence>
          )}
        </Sequence>
      ))}
      <Sequence from={0} durationInFrames={PIVOT + f(2)} layout="none">
        <Audio
          src={staticFile("audio/bed-a.wav")}
          volume={(fr) => interpolate(fr, [0, PIVOT - f(5), PIVOT - f(3), PIVOT + f(2)], [0.55, 0.55, 0.12, 0], { extrapolateRight: "clamp" })}
        />
      </Sequence>
      <Sequence from={PIVOT} durationInFrames={TOTAL - PIVOT} layout="none">
        <Audio
          src={staticFile("audio/bed-b.wav")}
          loop
          volume={(fr) => interpolate(fr, [0, f(1.5), TOTAL - PIVOT - f(5), TOTAL - PIVOT], [0, 0.42, 0.42, 0], { extrapolateRight: "clamp" })}
        />
      </Sequence>
    </AbsoluteFill>
  );
}
