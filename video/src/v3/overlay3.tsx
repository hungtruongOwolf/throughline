import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { AGENTS, Card, CARD_LEN, Rail } from "../v2/overlay";
import type { Row3 } from "./Film3";

/** Which agent's card shows when, by voice line and how far into it. */
const CUES: { line: number; at: number; code: string }[] = [
  { line: 12, at: 0.05, code: "IN" },
  { line: 14, at: 0.12, code: "CV" },
  { line: 14, at: 0.55, code: "PA" },
  { line: 17, at: 0.45, code: "CO" },
  { line: 19, at: 0.05, code: "WS" },
  { line: 20, at: 0.0, code: "OP" },
  { line: 24, at: 0.0, code: "DS" },
  { line: 26, at: 0.0, code: "RW" },
  { line: 26, at: 0.55, code: "FU" },
];
const STAGES = [
  { from: 11, to: 16 },
  { from: 16, to: 23 },
  { from: 23, to: 28 },
];

/** Agent cards and the stage rail over the product part of the film. */
export function AgentLayer3({ shots }: { shots: Row3[] }) {
  const f = useCurrentFrame();
  const lineStart = (n: number) => shots.find((s) => s.line === n)!.start;
  const lineLen = (n: number) => shots.filter((s) => s.line === n).reduce((a, s) => a + s.dur, 0);
  const cues = CUES.map((c) => ({ ...c, frame: Math.round(lineStart(c.line) + c.at * lineLen(c.line)) }));
  const stage = STAGES.findIndex((s) => f >= lineStart(s.from) && f < lineStart(s.to));
  const a = lineStart(11);
  const b = lineStart(28);
  const show =
    interpolate(f, [a, a + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(f, [b - 10, b], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const active = cues
    .map((c, i) => ({ ...c, n: Object.keys(AGENTS).indexOf(c.code) + 1, i }))
    .filter((c) => f >= c.frame && f < c.frame + CARD_LEN)
    .slice(-1)[0];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {show > 0 && <Rail stage={Math.max(0, stage)} worked={-1} show={show} />}
      {active && <Card key={active.code} agent={AGENTS[active.code]!} local={f - active.frame} n={active.n} />}
    </AbsoluteFill>
  );
}
