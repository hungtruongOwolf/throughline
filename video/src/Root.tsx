import { Composition } from "remotion";
import { Film, TOTAL } from "./Film";
import { Film2, SHOTS, ShotView, TOTAL as TOTAL2 } from "./v2/Film2";
import { FPS, H, W } from "./theme";
import { Film3, TOTAL3 } from "./v3/Film3";
import { Film4, TOTAL4 } from "./v4/Film4";

export const Root = () => (
  <>
    <Composition id="Throughline4" component={Film4} durationInFrames={TOTAL4} fps={FPS} width={W} height={H} />
    <Composition id="Throughline3" component={Film3} durationInFrames={TOTAL3} fps={FPS} width={W} height={H} />
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
    {/* the agent overlay over a short stretch of the film, for previewing */}
    <Composition id="Overlay" component={Film2} durationInFrames={TOTAL2} fps={FPS} width={W} height={H} />
    <Composition id="Throughline" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
  </>
);
