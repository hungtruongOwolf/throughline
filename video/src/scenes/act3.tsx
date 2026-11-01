import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { GateTag, PaperGrid, SignBlade, Thread, useEnter, useProgress } from "../components/kit";
import { BrowserFrame, Crop, FocusRing, Phone, Sfx } from "../components/frames";
import { Badge } from "./act2";
import { C, E, F } from "../theme";

type S = { dur: number };

const Paper = ({ children }: { children: React.ReactNode }) => (
  <AbsoluteFill style={{ background: C.paper }}>
    <PaperGrid opacity={0.7} />
    {children}
  </AbsoluteFill>
);

const waitColor = (m: number) => (m >= 20 ? C.waitHigh : m >= 10 ? C.waitMid : C.agent);

const STOPS = [
  { label: "Labs", accent: C.zone.green, wait: 6 },
  { label: "CT scan", accent: C.zone.violet, wait: 0 },
  { label: "Clinic", accent: C.zone.blue, wait: 8 },
  { label: "Infusion", accent: C.zone.rose, wait: 7 },
];

/** [11] Every stop is its own line; when one backs up, everyone behind it waits. */
export function Day({ dur }: S) {
  const f = useCurrentFrame();
  const backup = useProgress(dur * 0.35, dur * 0.95, E.rise);
  return (
    <Paper>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Thread d="M 120 800 L 1800 800" progress={useProgress(0, 24)} length={1700} />
      </svg>
      {STOPS.map((s, i) => {
        const e = useEnterLocal(4 + i * 5);
        const x = 190 + i * 410;
        const ct = i === 1;
        const wait = ct ? 4 + backup * 36 : s.wait;
        const behind = i > 1;
        const h = 40 + wait * 11;
        return (
          <div key={s.label} style={{ position: "absolute", left: x, top: 0, opacity: e * (behind ? 1 - backup * 0.45 : 1) }}>
            <div
              style={{
                position: "absolute",
                left: 70,
                top: 760 - h,
                width: 150,
                height: h * e,
                transformOrigin: "bottom",
                background: waitColor(wait),
                borderRadius: "8px 8px 0 0",
                opacity: 0.9,
              }}
            />
            <div style={{ position: "absolute", left: 70, top: 760 - h - 70, width: 150, textAlign: "center", fontFamily: F.figure, fontWeight: 600, fontSize: 52, color: waitColor(wait) }}>
              {Math.round(wait)}
              <span style={{ fontSize: 26 }}> min</span>
            </div>
            <div style={{ position: "absolute", top: 820 }}>
              <SignBlade label={s.label} accent={s.accent} width={290} />
            </div>
          </div>
        );
      })}
      <div style={{ opacity: f < 0 ? 1 : 0 }} />
    </Paper>
  );
}
// enter helper usable inside map without breaking hook order (fixed count of stops)
function useEnterLocal(at: number) {
  return useEnter(at);
}

// People in the waiting-room frame (frame pixels, 1920x1280).
const PEOPLE = [
  [375, 745, 155, 265],
  [600, 740, 185, 340],
  [830, 705, 205, 325],
  [1040, 710, 200, 300],
  [1225, 690, 130, 290],
];

/** [12] One scanner is down; the waiting-room agent counts people and tells the planner. */
export function Sensing({ dur }: S) {
  const f = useCurrentFrame();
  const down = useEnter(dur * 0.06);
  const cam = useEnter(dur * 0.22);
  const k = 1040 / 1920;
  const handoff = useProgress(dur * 0.78, dur * 0.92);
  const counted = PEOPLE.filter((_, i) => f > dur * (0.36 + i * 0.07)).length;
  return (
    <Paper>
      <div style={{ position: "absolute", left: 150, top: 200, display: "flex", flexDirection: "column", gap: 34 }}>
        {["CT 1", "CT 2"].map((n, i) => (
          <div
            key={n}
            style={{
              width: 300,
              height: 170,
              borderRadius: 14,
              background: i === 0 ? interpolateColor(down) : C.zone.violet,
              color: "#fff",
              fontFamily: F.display,
              fontWeight: 800,
              fontSize: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              boxShadow: "0 24px 40px -26px rgba(24,34,58,.6)",
            }}
          >
            {n}
            {i === 0 && (
              <svg width={70} height={70} style={{ position: "absolute", right: -22, top: -22, opacity: down }}>
                <circle cx={35} cy={35} r={32} fill={C.urgent} />
                <path d="M 22 22 L 48 48 M 48 22 L 22 48" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 640,
          top: 140,
          width: 1040,
          height: 1280 * k,
          borderRadius: 12,
          overflow: "hidden",
          opacity: cam,
          transform: `translateY(${(1 - cam) * 40}px)`,
          boxShadow: "0 50px 90px -40px rgba(24,34,58,.6)",
        }}
      >
        <Img
          src={staticFile("assets/waiting.png")}
          style={{ width: 1040 * 1.06, transform: `translateX(${interpolate(f, [0, dur], [0, -40])}px)` }}
        />
        {PEOPLE.map(([x, y, w, h], i) => {
          const at = dur * (0.36 + i * 0.07);
          const p = interpolate(f, [at, at + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: (x! - 20) * k * 1.06 - interpolate(f, [0, dur], [0, 40]),
                top: y! * k * 1.06 - 10,
                width: w! * k * 1.06,
                height: h! * k * 1.06,
                border: `3px solid ${C.glow}`,
                background: `${C.glow}26`,
                borderRadius: 6,
                opacity: p,
                transform: `scale(${1.2 - 0.2 * p})`,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 24,
            top: 24,
            background: "rgba(24,34,58,.82)",
            color: "#fff",
            borderRadius: 8,
            padding: "10px 18px",
            fontFamily: F.figure,
            fontWeight: 600,
            fontSize: 44,
            opacity: counted > 0 ? 1 : 0,
          }}
        >
          {counted}
        </div>
      </div>
      <div style={{ position: "absolute", left: 660, top: 880, display: "flex", alignItems: "center", gap: 20 }}>
        <Badge code="WS" on={counted > 0 ? 1 : 0} size={72} />
        <svg width={260} height={20}>
          <Thread d="M 0 10 L 260 10" progress={handoff} length={270} width={6} />
        </svg>
        <Badge code="OP" on={handoff} size={72} />
        <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 28, color: C.ink, opacity: 0.3 + 0.7 * handoff }}>Ops planner</span>
      </div>
      <Sfx at={dur * 0.06} name="gate-hold" volume={0.35} />
      {PEOPLE.map((_, i) => (
        <Sfx key={i} at={dur * (0.36 + i * 0.07)} name="ping" volume={0.35} />
      ))}
      <Sfx at={dur * 0.78} name="tick-a" volume={0.3} />
    </Paper>
  );
}
function interpolateColor(p: number) {
  return p > 0.5 ? "#9aa3b2" : C.zone.violet;
}

/** A wait curve over the next ninety minutes. */
function curve(seed: number, fixed: boolean) {
  const pts: string[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const peak = fixed ? 0.18 : 0.55 + ((seed * 37) % 40) / 100;
    const c = 0.35 + ((seed * 13) % 30) / 100;
    const y = peak * Math.exp(-((t - c) ** 2) / 0.03) + 0.06 * Math.sin(t * 9 + seed);
    pts.push(`${i * 36} ${360 - Math.max(0.02, y) * 330}`);
  }
  return `M ${pts.join(" L ")}`;
}

/** [13] The planner plays the next ninety minutes out twenty times, once per fix, and keeps one. */
export function Simulate({ dur }: S) {
  const f = useCurrentFrame();
  const pick = useProgress(dur * 0.62, dur * 0.8);
  const tag = useEnter(dur * 0.1);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 150, top: 120, display: "flex", alignItems: "center", gap: 22 }}>
        <Badge code="OP" on={1} size={80} />
        <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.ink }}>Ops planner</span>
        <span style={{ marginLeft: 18, fontFamily: F.figure, fontWeight: 600, fontSize: 44, color: C.ink, opacity: tag }}>20 runs · 90 min</span>
      </div>
      <svg width={1100} height={400} viewBox="0 0 1080 380" style={{ position: "absolute", left: 410, top: 330, overflow: "visible" }}>
        <line x1={0} y1={362} x2={1080} y2={362} stroke={C.rule} strokeWidth={3} />
        {Array.from({ length: 20 }).map((_, i) => {
          const at = dur * 0.06 + i * dur * 0.02;
          const show = interpolate(f, [at, at + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const keep = i === 13;
          const flicker = 0.75 + 0.25 * Math.sin(f * 0.4 + i);
          return (
            <path
              key={i}
              d={keep && pick > 0 ? curve(i, true) : curve(i, false)}
              stroke={keep && pick > 0.5 ? C.agent : waitColor(20)}
              strokeOpacity={keep ? show : show * (1 - pick) * 0.55 * flicker}
              strokeWidth={keep && pick > 0.5 ? 8 : 3}
              fill="none"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 790,
          opacity: pick,
          transform: `translateY(${(1 - pick) * 20}px)`,
        }}
      >
        <SignBlade label="Extra slot on CT 2" tone="agent" width={480} />
      </div>
      <Sfx at={dur * 0.62} name="gate-ok" volume={0.3} />
    </Paper>
  );
}

/** [14] The average CT wait goes from seventeen minutes to five; only seven patients move. */
export function BigNum({ dur }: S) {
  const f = useCurrentFrame();
  const fall = useProgress(10, 10 + dur * 0.38, E.out);
  const wait = 17.4 - fall * 12.5;
  const seven = useEnter(dur * 0.42);
  const move = useProgress(dur * 0.48, dur * 0.7);
  const shot = dur * 0.7;
  return (
    <Paper>
      <Sfx at={8} name="impact" volume={0.5} />
      <div style={{ position: "absolute", left: 160, top: 170, display: "flex", alignItems: "flex-end", gap: 60, transform: `translateX(${interpolate(f, [shot, shot + 20], [0, -40], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` }}>
        <div
          style={{
            width: 180,
            height: 60 + wait * 22,
            background: waitColor(wait),
            borderRadius: "10px 10px 0 0",
          }}
        />
        <div>
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 32, color: C.inkSoft }}>CT wait</div>
          <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 300, lineHeight: 0.85, color: waitColor(wait), fontVariantNumeric: "tabular-nums" }}>
            {Math.round(wait)}
            <span style={{ fontSize: 90 }}> min</span>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 160, top: 720, opacity: seven }}>
        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                background: C.agent,
                transform: `translateY(${-Math.sin(Math.min(1, Math.max(0, move * 1.6 - i * 0.1)) * Math.PI) * 60}px)`,
              }}
            />
          ))}
          <span style={{ marginLeft: 20, fontFamily: F.figure, fontWeight: 600, fontSize: 64, color: C.ink }}>7 patients move</span>
        </div>
      </div>
      {f > shot - 2 && (
        <BrowserFrame at={shot} dur={dur - shot} tilt={-6} style={{ left: 1130, top: 90 }}>
          <Crop src="clips/proposal.png" crop={{ x: 0, y: 100, w: 760, h: 900 }} width={600}>
            <FocusRing x={70 * (600 / 760)} y={(510 - 100) * (600 / 760)} w={270 * (600 / 760)} h={50 * (600 / 760)} at={shot + 16} />
          </Crop>
        </BrowserFrame>
      )}
      {Array.from({ length: 8 }).map((_, i) => (
        <Sfx key={i} at={12 + i * 3} name="count" volume={0.25} />
      ))}
    </Paper>
  );
}

/** [15] The operations lead approves; everyone affected hears; a lost patient photographs a sign. */
export function Approve({ dur }: S) {
  const f = useCurrentFrame();
  const ok = useProgress(4, 16);
  const fan = useProgress(dur * 0.14, dur * 0.34);
  const phones = useEnter(dur * 0.2);
  const flash = interpolate(f, [dur * 0.62, dur * 0.64, dur * 0.7], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sign = useEnter(dur * 0.64);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 140, top: 140 }}>
        <GateTag who="Sam" role="operations lead" check={ok} />
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {[560, 960, 1360].map((x, i) => (
          <Thread key={x} d={`M 300 240 C 300 420, ${x} 300, ${x} 460`} progress={fan} length={1300} width={i === 1 ? 6 : 4} />
        ))}
      </svg>
      {[560, 1360].map((x) => (
        <div key={x} style={{ position: "absolute", left: x - 120, top: 470, opacity: phones * 0.45, transform: `scale(${0.6})`, transformOrigin: "top center" }}>
          <Phone width={240}>
            <div style={{ position: "absolute", left: 20, right: 20, top: 120, height: 90, background: C.heldBg, borderLeft: `6px solid ${C.held}`, borderRadius: 6 }} />
          </Phone>
        </div>
      ))}
      <div style={{ position: "absolute", left: 960 - 190, top: 440, opacity: phones, transform: `translateY(${(1 - phones) * 60}px)` }}>
        <Phone width={380}>
          <Crop src="clips/phone-plan.png" crop={{ x: 0, y: 1000, w: 1170, h: 1500 }} width={354} />
        </Phone>
      </div>
      <div style={{ position: "absolute", left: 1330, top: 200, opacity: sign, transform: `translateX(${(1 - sign) * 40}px) rotate(-2deg)` }}>
        <SignBlade label="Elevator A" width={380} />
      </div>
      <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash * 0.85 }} />
      <Sfx at={4} name="gate-ok" volume={0.45} />
      <Sfx at={dur * 0.14} name="whoosh" volume={0.3} />
      <Sfx at={dur * 0.62} name="shutter" volume={0.5} />
    </Paper>
  );
}
