import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { GateTag, PaperGrid, Thread, useEnter, useProgress } from "../components/kit";
import { Sfx } from "../components/frames";
import { Badge } from "./act2";
import { C, E, F } from "../theme";

type S = { dur: number };

const Paper = ({ children, tint = 0 }: { children: React.ReactNode; tint?: number }) => (
  <AbsoluteFill style={{ background: C.paper }}>
    <PaperGrid opacity={0.7} />
    <AbsoluteFill style={{ background: "#f3e2c4", opacity: tint }} />
    {children}
  </AbsoluteFill>
);

function Lines({ n, width, gap, color, h, show }: { n: number; width: number[]; gap: number; color: string; h: number; show: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ height: h, width: `${width[i % width.length]! * Math.min(1, Math.max(0, show * n - i))}%`, background: color, borderRadius: h / 2 }} />
      ))}
    </div>
  );
}

/** [16] Plain words beside the doctor's, a check the next day, and a nurse if she isn't sure. */
export function Discharge({ dur }: S) {
  const f = useCurrentFrame();
  const left = useProgress(4, dur * 0.2);
  const right = useProgress(dur * 0.14, dur * 0.36);
  const sun = useProgress(dur * 0.44, dur * 0.62);
  const ask = useEnter(dur * 0.62);
  const nurse = useProgress(dur * 0.8, dur * 0.92);
  const card = { background: C.panel, borderRadius: 12, padding: 40, boxShadow: "0 40px 80px -40px rgba(24,34,58,.45)" } as const;
  return (
    <Paper tint={0.25 * sun}>
      <div style={{ position: "absolute", left: 150, top: 110, display: "flex", alignItems: "center", gap: 20 }}>
        <Badge code="DS" on={right} size={76} />
        <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.ink }}>Discharge</span>
      </div>
      <div style={{ position: "absolute", left: 150, top: 240, width: 560, height: 520, ...card }}>
        <Lines n={14} width={[96, 88, 92, 70, 95, 84, 90]} gap={16} color="#c9cfcc" h={14} show={left} />
      </div>
      <div style={{ position: "absolute", left: 780, top: 240, width: 560, height: 520, ...card, borderLeft: `8px solid ${C.agent}` }}>
        <Lines n={6} width={[80, 66, 74, 58]} gap={40} color={C.ink} h={26} show={right} />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[300, 420, 540, 660].map((y, i) => (
          <path key={y} d={`M 710 ${y} C 745 ${y}, 745 ${300 + i * 66}, 780 ${300 + i * 66}`} stroke={C.agent} strokeOpacity={0.5 * right} strokeWidth={3} fill="none" />
        ))}
        <path d="M 1430 330 A 170 170 0 0 1 1770 330" stroke={C.waitMid} strokeOpacity={0.35} strokeWidth={4} fill="none" strokeDasharray="10 10" />
        <circle cx={1430 + sun * 340} cy={330 - Math.sin(sun * Math.PI) * 170} r={30} fill={C.waitMid} opacity={sun > 0 ? 1 : 0} />
        <Thread d="M 1450 640 L 1450 820 L 1600 820" progress={nurse} length={340} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 1400,
          top: 480,
          padding: "22px 30px",
          borderRadius: "22px 22px 22px 4px",
          background: C.panel,
          boxShadow: "0 24px 50px -30px rgba(24,34,58,.5)",
          fontFamily: F.display,
          fontWeight: 800,
          fontSize: 60,
          color: C.held,
          opacity: ask,
          transform: `scale(${0.8 + 0.2 * ask})`,
        }}
      >
        ?
      </div>
      <div style={{ position: "absolute", left: 1610, top: 790, opacity: nurse }}>
        <GateTag who="Nurse" role="" check={0} />
      </div>
      <Sfx at={dur * 0.14} name="tick-a" volume={0.3} />
      <Sfx at={dur * 0.62} name="ping" volume={0.4} />
      <Sfx at={dur * 0.8} name="gate-hold" volume={0.35} />
      <div style={{ opacity: f < 0 ? 1 : 0 }} />
    </Paper>
  );
}

/** [17] Results watch stays on the test; Follow-up books the next visit and reports back. */
export function Results({ dur }: S) {
  const f = useCurrentFrame();
  const signed = useProgress(dur * 0.32, dur * 0.42);
  const book = useProgress(dur * 0.5, dur * 0.62);
  const loop = useProgress(dur * 0.66, dur * 0.98);
  const pulse = 1 + 0.08 * Math.sin(f * 0.3) * (1 - signed);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 230, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <Badge code="RW" on={1} size={76} />
        <div
          style={{
            width: 300,
            height: 220,
            borderRadius: 14,
            background: C.panel,
            border: `4px solid ${signed > 0.5 ? C.agent : C.waitMid}`,
            transform: `scale(${pulse})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 30px 60px -30px rgba(24,34,58,.45)",
          }}
        >
          <svg width={110} height={110} viewBox="0 0 24 24" fill="none">
            {signed > 0 ? (
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke={C.agent} strokeWidth="2.6" strokeDasharray="24" strokeDashoffset={24 * (1 - signed)} strokeLinecap="round" />
            ) : (
              <circle cx="12" cy="12" r="7" stroke={C.waitMid} strokeWidth="2.4" strokeDasharray="4 3" />
            )}
          </svg>
        </div>
      </div>
      <div style={{ position: "absolute", left: 780, top: 260, display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        <Badge code="FU" on={book} size={76} />
        <div style={{ width: 380, height: 220, borderRadius: 14, background: C.panel, boxShadow: "0 30px 60px -30px rgba(24,34,58,.45)", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, padding: 24 }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 6, background: i === 7 ? C.agent : C.canvas, opacity: i === 7 ? 0.25 + 0.75 * book : 1, transform: i === 7 ? `scale(${0.6 + 0.4 * book})` : "none" }} />
          ))}
        </div>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Thread d="M 380 540 L 380 700 C 380 900, 1500 900, 1560 600 L 1560 330" progress={loop} length={1900} />
      </svg>
      <div style={{ position: "absolute", left: 1460, top: 140, opacity: loop > 0.85 ? 1 : 0.3, transform: "rotate(3deg)" }}>
        <Img src={staticFile("assets/maria-referral-fax.png")} style={{ width: 200, boxShadow: "0 20px 40px -20px rgba(24,34,58,.5)" }} />
      </div>
      <Sfx at={dur * 0.32} name="gate-ok" volume={0.35} />
      <Sfx at={dur * 0.5} name="tick-b" volume={0.3} />
      <Sfx at={dur * 0.66} name="whoosh" volume={0.3} />
    </Paper>
  );
}

const ROW = ["IN", "CV", "PA", "SC", "VP", "PM", "WS", "IT", "CO", "OP", "RW", "DS", "FU"];
const MODELS = [
  { name: "Muse Spark 1.3", agents: ["IN", "PA", "PM", "CO", "DS"], at: 0.12, x: 620, y: 200 },
  { name: "Muse Spark Open · Baseten", agents: ["OP"], at: 0.36, x: 1440, y: 200 },
  { name: "Muse Voice Transcribe", agents: ["PM"], at: 0.62, x: 640, y: 440 },
  { name: "SAM 3.1", agents: ["WS"], at: 0.76, x: 1180, y: 440 },
];

/** [18] The thinking runs on Meta's models. */
export function Models({ dur }: S) {
  const step = 128;
  const x0 = (1920 - step * (ROW.length - 1)) / 2;
  const ax = (c: string) => x0 + ROW.indexOf(c) * step;
  const rowY = 760;
  return (
    <Paper>
      {ROW.map((c) => {
        const lit = MODELS.some((m) => m.agents.includes(c));
        return (
          <div key={c} style={{ position: "absolute", left: ax(c), top: rowY, transform: "translate(-50%, -50%)", opacity: lit ? 1 : 0.4 }}>
            <Badge code={c} on={lit ? 1 : 0} size={70} />
          </div>
        );
      })}
      {MODELS.map((m, i) => (
        <ModelChip key={m.name} m={m} i={i} dur={dur} ax={ax} rowY={rowY} />
      ))}
      {MODELS.map((m) => (
        <Sfx key={m.name} at={dur * m.at} name="tick-a" volume={0.3} />
      ))}
    </Paper>
  );
}

function ModelChip({ m, i, dur, ax, rowY }: { m: (typeof MODELS)[number]; i: number; dur: number; ax: (c: string) => number; rowY: number }) {
  const e = useEnter(dur * m.at);
  const draw = useProgress(dur * m.at + 6, dur * m.at + 26);
  const cx = m.x;
  const y = m.y + i * 0;
  return (
    <>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {m.agents.map((c) => (
          <path key={c} d={`M ${cx} ${y + 40} C ${cx} ${(y + rowY) / 2}, ${ax(c)} ${(y + rowY) / 2}, ${ax(c)} ${rowY - 44}`} stroke={C.agent} strokeOpacity={0.55} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
        ))}
      </svg>
      <div
        style={{
          position: "absolute",
          left: cx,
          top: y,
          transform: `translate(-50%, 0) translateY(${(1 - e) * 20}px)`,
          opacity: e,
          background: C.ink,
          color: C.boardText,
          borderRadius: 999,
          padding: "16px 30px",
          fontFamily: F.text,
          fontWeight: 700,
          fontSize: 30,
          whiteSpace: "nowrap",
          boxShadow: "0 20px 40px -24px rgba(24,34,58,.7)",
        }}
      >
        {m.name}
      </div>
    </>
  );
}

/** [19] Not built for one building: Northgate's campus. */
export function Campus({ dur }: S) {
  const f = useCurrentFrame();
  const push = interpolate(f, [0, dur], [1, 1.14], { easing: E.draw });
  const drift = interpolate(f, [0, dur], [30, -30]);
  const e = useEnter(0);
  return (
    <AbsoluteFill style={{ background: "#f4f6f5" }}>
      <AbsoluteFill style={{ opacity: e }}>
        <Img
          src={staticFile("clips/campus-northgate.png")}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 2300,
            maxWidth: "none",
            transform: `translate(-50%, -46%) translateX(${drift}px) scale(${push})`,
          }}
        />
      </AbsoluteFill>
      <Sfx at={0} name="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
}

/** [20] Nobody had to hold Maria's thread. Throughline did. Then the end card. */
export function Close({ dur, vo }: S & { vo: number }) {
  const line = useProgress(0, vo * 0.9);
  const word = useEnter(vo * 0.8);
  const card = useEnter(vo + 12);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Thread d="M -20 860 C 260 860, 330 534, 574 534" progress={line} dark length={900} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 455,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 22,
          opacity: word,
        }}
      >
        <span style={{ width: 56, height: 12, background: C.glow, display: "block" }} />
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 130, color: C.boardText }}>Throughline</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 650, textAlign: "center", opacity: card, fontFamily: F.text, color: C.boardText }}>
        <div style={{ fontSize: 30, fontWeight: 700, opacity: 0.85 }}>throughline-zeta-ten.vercel.app</div>
        <div style={{ fontSize: 24, marginTop: 22, opacity: 0.55 }}>Muse Spark · Spark Open · SAM 3.1 · Muse Voice Transcribe</div>
      </div>
      <Sfx at={vo * 0.8} name="bell" volume={0.4} />
      <div style={{ opacity: dur < 0 ? 1 : 0 }} />
    </AbsoluteFill>
  );
}
