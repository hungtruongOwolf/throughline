import { Composition } from "remotion";
import { Film, TOTAL } from "./Film";
import { Film2, SHOTS, ShotView, TOTAL as TOTAL2 } from "./v2/Film2";
import { FPS, H, W } from "./theme";

export const Root = () => (
  <>
    <Composition id="Throughline2" component={Film2} durationInFrames={TOTAL2} fps={FPS} width={W} height={H} />
    {/* one composition per shot, for previewing a scene on its own: S-<BEAT> */}
    {SHOTS.map((s) => (
      <Composition
        key={s.beat}
        id={`S-${s.beat}`}
        component={() => <ShotView shot={s} />}
        durationInFrames={s.dur}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}
    <Composition id="Throughline" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
  </>
);
