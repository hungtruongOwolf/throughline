import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CometThread, Day, EZ, LineReveal, useSpring } from "../v2/fx";
import { GateTag } from "../components/kit";
import { Sfx } from "../components/frames";
import { Badge } from "../scenes/act2";
import { C, F } from "../theme";

const CHAIN = ["IN", "CV", "PA", "G1", "SC", "VP", "PM", "WS", "IT", "CO", "OP", "G2", "RW", "DS", "FU"];
const GATES: Record<string, string> = { G1: "Insurance request", G2: "Schedule change" };

/** The agents pass the work along by themselves; people stand at two gates. */
export function Gates({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const step = 118;
  const x0 = (1920 - step * (CHAIN.length - 1)) / 2;
  const y = 560;
  const d = `M ${x0 - 80} ${y} L ${x0 + step * (CHAIN.length - 1) + 80} ${y}`;
  const p = interpolate(f, [10, dur * 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.inOut });
  const head = x0 - 80 + p * (step * (CHAIN.length - 1) + 160);
  return (
    <Day>
      <div style={{ position: "absolute", left: 160, top: 170 }}>
        <LineReveal lines={["Agents pass the work along.", "People decide at the gates."]} at={6} size={64} color={C.ink} />
      </div>
      <CometThread d={d} progress={p} color={C.agent} width={7} />
      {CHAIN.map((c, i) => {
        const x = x0 + i * step;
        const on = Math.min(1, Math.max(0, (head - x) / 40));
        if (GATES[c]) {
          const lift = useSpring(Math.round(10 + (dur * 0.7 - 10) * ((x - x0 + 80) / (step * (CHAIN.length - 1) + 160))), { damping: 18, stiffness: 160 });
          return (
            <div key={c} style={{ position: "absolute", left: x, top: y - 150 - 30 * lift, transform: "translateX(-50%)", opacity: 0.35 + 0.65 * on, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <GateTag who={GATES[c]!} role="" check={on > 0.99 ? 1 : 0} />
              <div style={{ width: 3, height: 70, background: C.held, opacity: 0.6 }} />
            </div>
          );
        }
        return (
          <div key={c} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>
            <Badge code={c} on={on} size={64} />
          </div>
        );
      })}
      {CHAIN.map((c, i) => {
        const at = 10 + (dur * 0.7 - 10) * ((i * step + 80) / (step * (CHAIN.length - 1) + 160));
        return <Sfx key={c} at={at} name={GATES[c] ? "gate-ok" : i % 2 ? "tick-b" : "tick-a"} volume={GATES[c] ? 0.3 : 0.15} />;
      })}
    </Day>
  );
}

const STAGES = ["Before the visit", "The visit day", "After the visit"];

/** "Let me show you": the three parts of the demo, then into the product. */
export function Stages({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const out = interpolate(f, [dur - 14, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.in });
  return (
    <AbsoluteFill style={{ background: C.ink, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: 36, transform: `scale(${1 + out * 0.6})`, opacity: 1 - out }}>
        {STAGES.map((s, i) => {
          const e = useSpring(6 + i * 8, { damping: 18, stiffness: 160 });
          return (
            <div
              key={s}
              style={{
                width: 440,
                height: 150,
                borderRadius: 10,
                background: i === 0 ? C.agent : "#0e1526",
                border: `1px solid ${i === 0 ? C.glow : "rgba(244,246,242,.15)"}`,
                display: "flex",
                alignItems: "center",
                gap: 22,
                padding: "0 34px",
                opacity: e,
                transform: `translateY(${(1 - e) * 40}px)`,
                boxShadow: "0 30px 60px -30px rgba(0,0,0,.8)",
              }}
            >
              <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 64, color: i === 0 ? "#fff" : C.glow }}>{i + 1}</span>
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 46, color: C.boardText, lineHeight: 1 }}>{s}</span>
            </div>
          );
        })}
      </div>
      <Sfx at={6} name="tick-a" volume={0.25} />
      <Sfx at={14} name="tick-b" volume={0.25} />
      <Sfx at={22} name="tick-a" volume={0.25} />
      <Sfx at={dur - 12} name="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
}
