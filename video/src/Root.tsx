import { Composition } from "remotion";
import { Film, TOTAL } from "./Film";
import { FPS, H, W } from "./theme";

export const Root = () => (
  <Composition id="Throughline" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} />
);
