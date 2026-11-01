import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { AgentNode, GateTag, PaperGrid, Thread, useEnter, useProgress } from "../components/kit";
import { BrowserFrame, Crop, FocusRing, Phone, Sfx } from "../components/frames";
import { C, E, F } from "../theme";

type S = { dur: number };

const Paper = ({ children }: { children: React.ReactNode }) => (
  <AbsoluteFill style={{ background: C.paper }}>
    <PaperGrid opacity={0.7} />
    {children}
  </AbsoluteFill>
);

/** A teal rounded-square badge, as agents appear in the app. */
export function Badge({ code, on, size = 56 }: { code: string; on: number; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: on > 0.5 ? C.agent : C.panel,
        border: `3px solid ${C.agent}`,
        color: on > 0.5 ? "#fff" : C.agent,
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: size * 0.36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${0.88 + 0.12 * on})`,
        boxShadow: on > 0.5 ? `0 0 0 ${10 * on}px ${C.agent}1f` : "none",
      }}
    >
      {code}
    </div>
  );
}

/** [5] Take Maria. */
export function Maria({ dur }: S) {
  const wipe = useProgress(0, 20);
  const card = useEnter(10);
  const fax = useEnter(dur * 0.42);
  return (
    <Paper>
      <Sfx at={0} name="whoosh" volume={0.3} />
      <div
        style={{
          position: "absolute",
          left: 220,
          top: 330,
          width: 620,
          padding: "44px 48px",
          background: C.panel,
          borderRadius: 10,
          boxShadow: "0 40px 80px -40px rgba(24,34,58,.45)",
          opacity: card,
          transform: `translateY(${(1 - card) * 40}px)`,
          display: "flex",
          gap: 34,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 128,
            height: 128,
            borderRadius: 64,
            background: C.agentTint,
            color: C.agent,
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 54,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          MD
        </div>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 96, color: C.ink, lineHeight: 1 }}>Maria, 71</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1060,
          top: 120,
          opacity: fax,
          transform: `translateY(${(1 - fax) * -80}px) rotate(${2 - fax}deg)`,
        }}
      >
        <Img
          src={staticFile("assets/maria-referral-fax.png")}
          style={{ width: 640, boxShadow: "0 50px 90px -40px rgba(24,34,58,.55)", borderRadius: 4 }}
        />
      </div>
      {/* the navy of act one wiping away along the thread */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${wipe * 100}%`, right: 0, background: C.ink }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${wipe * 100}% - 3px)`, width: 6, background: C.glow, opacity: wipe < 1 ? 1 : 0 }} />
    </Paper>
  );
}

const CHAIN: ({ code: string; name: string } | { gate: string })[] = [
  { code: "IN", name: "Intake" },
  { code: "CV", name: "Coverage" },
  { code: "PA", name: "Prior auth" },
  { gate: "Coordinator" },
  { code: "SC", name: "Scheduling" },
  { code: "VP", name: "Visit prep" },
  { code: "PM", name: "Messaging" },
  { code: "WS", name: "Sensing" },
  { code: "IT", name: "Itinerary" },
  { code: "CO", name: "Companion" },
  { code: "OP", name: "Ops planner" },
  { gate: "Operations" },
  { code: "RW", name: "Results watch" },
  { code: "DS", name: "Discharge" },
  { gate: "Doctor" },
  { code: "FU", name: "Follow-up" },
];

/** [6] One thread, thirteen agents carrying it, and people only at the gates. */
export function ThreadScene({ dur }: S) {
  const f = useCurrentFrame();
  const step = 230;
  const x0 = 260;
  const width = x0 * 2 + step * (CHAIN.length - 1);
  const pan = interpolate(f, [dur * 0.08, dur * 0.92], [0, width - 1920], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: E.draw,
  });
  const head = pan + 1920 * 0.62; // where the thread has reached, in content space
  const y = (i: number) => 560 + Math.sin(i * 0.9) * 46;
  const pts = CHAIN.map((_, i) => `${x0 + i * step} ${y(i)}`);
  const d = `M 0 ${y(0)} L ${pts.join(" L ")} L ${width} ${y(CHAIN.length - 1)}`;
  return (
    <Paper>
      <div style={{ position: "absolute", top: 0, left: -pan, width, height: 1080 }}>
        <svg width={width} height={1080} style={{ position: "absolute", inset: 0 }}>
          <Thread d={d} progress={Math.min(1, head / width)} length={width * 1.05} />
        </svg>
        {CHAIN.map((c, i) => {
          const x = x0 + i * step;
          const on = Math.min(1, Math.max(0, (head - x) / 60));
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y(i), transform: "translate(-50%, -50%)" }}>
              {"gate" in c ? (
                <div style={{ opacity: 0.35 + 0.65 * on }}>
                  <GateTag who={c.gate} role="" check={on > 0.99 ? 1 : 0} />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, transform: "translateY(26px)" }}>
                  <Badge code={c.code} on={on} size={74} />
                  <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 24, color: C.ink, opacity: 0.25 + 0.75 * on, whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {CHAIN.map((c, i) => {
        const x = x0 + i * step;
        // the frame at which the thread reaches this item
        const at = interpolate(x - 1920 * 0.62 + 30, [0, width - 1920], [dur * 0.08, dur * 0.92], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <Sfx key={i} at={at} name={"gate" in c ? "gate-hold" : i % 2 ? "tick-b" : "tick-a"} volume={"gate" in c ? 0.35 : 0.22} />;
      })}
    </Paper>
  );
}

// Field rows on Maria's fax (fax pixels), for the reading pass.
const FIELDS = [327, 371, 415, 459, 503, 547, 591, 635, 679, 723];
const SMUDGE = { x: 525, y: 591 };

/** [7] Intake reads the fax, stops at the smudge, and asks the coordinator. */
export function Intake({ dur }: S) {
  const f = useCurrentFrame();
  const s = 700 / 1207; // fax display scale
  const scan = useProgress(6, dur * 0.42, E.draw);
  const scanY = 260 * s + scan * 520 * s;
  const ask = useEnter(dur * 0.4);
  const shot = dur * 0.5;
  const sent = dur * 0.84;
  return (
    <Paper>
      <div style={{ position: "absolute", left: 120, top: 70, transform: `scale(${interpolate(f, [shot, shot + 20], [1, 0.82], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: E.draw })})`, transformOrigin: "0 0" }}>
        <Img src={staticFile("assets/maria-referral-fax.png")} style={{ width: 700, boxShadow: "0 40px 80px -40px rgba(24,34,58,.5)" }} />
        {FIELDS.map((fy, i) => {
          const reached = scanY > fy * s + 10;
          const isId = fy === 591;
          return (
            <div
              key={fy}
              style={{
                position: "absolute",
                left: 362 * s,
                top: fy * s + 14,
                height: 4,
                width: reached ? (isId ? 118 : 250) * s * 1.4 : 0,
                background: isId ? C.held : C.agent,
                opacity: 0.85,
                transition: "none",
              }}
            />
          );
        })}
        {scan < 1 && <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 3, background: C.agent, boxShadow: `0 0 18px 4px ${C.agent}55` }} />}
        <div
          style={{
            position: "absolute",
            left: SMUDGE.x * s - 46,
            top: SMUDGE.y * s - 30,
            width: 92,
            height: 60,
            borderRadius: 30,
            border: `4px solid ${C.held}`,
            opacity: ask,
            transform: `scale(${1.4 - 0.4 * ask})`,
          }}
        />
        <div style={{ position: "absolute", left: SMUDGE.x * s + 56, top: SMUDGE.y * s - 40, fontFamily: F.display, fontWeight: 800, fontSize: 64, color: C.held, opacity: ask }}>
          ?
        </div>
      </div>
      <div style={{ position: "absolute", left: 800, top: 120, opacity: ask, transform: `translateY(${(1 - ask) * 20}px)` }}>
        <GateTag who="Jordan" role="coordinator" check={useProgress(sent, sent + 12)} />
      </div>
      <BrowserFrame at={shot} dur={dur - shot} tilt={-5} style={{ left: 800, top: 230 }}>
        <Crop src="clips/inbox-question.png" crop={{ x: 1184, y: 336, w: 2016, h: 1464 }} width={1000}>
          <FocusRing x={(2229 - 1184) * (1000 / 2016)} y={(574 - 336) * (1000 / 2016)} w={640 * (1000 / 2016)} h={72 * (1000 / 2016)} at={shot + 18} />
        </Crop>
      </BrowserFrame>
      <Sfx at={dur * 0.4} name="gate-hold" volume={0.4} />
      <Sfx at={sent} name="gate-ok" volume={0.45} />
    </Paper>
  );
}

/** [8] The answer wakes Coverage, Prior auth drafts, the coordinator approves. */
export function PriorAuth({ dur }: S) {
  const f = useCurrentFrame();
  const cv = useProgress(dur * 0.04, dur * 0.1);
  const pa = useProgress(dur * 0.16, dur * 0.22);
  const swap = dur * 0.46;
  const approve = dur * 0.68;
  const crop = { x: 1200, y: 340, w: 2000, h: 1460 };
  const k = 1180 / crop.w;
  const chip = useEnter(dur * 0.8);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 120, top: 120, display: "flex", flexDirection: "column", gap: 70 }}>
        {[
          { code: "CV", name: "Coverage", on: cv },
          { code: "PA", name: "Prior auth", on: pa },
        ].map((a) => (
          <div key={a.code} style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Badge code={a.code} on={a.on} size={80} />
            <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.ink, opacity: 0.3 + 0.7 * a.on }}>{a.name}</span>
          </div>
        ))}
        <div style={{ opacity: f > approve - 10 ? 1 : 0.4 }}>
          <GateTag who="Jordan" role="approves" check={useProgress(approve, approve + 12)} />
        </div>
        <div style={{ opacity: chip, transform: `translateY(${(1 - chip) * 20}px)`, fontFamily: F.figure, fontWeight: 600, fontSize: 92, color: C.ink, lineHeight: 1 }}>
          24 min
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 26, color: C.inkSoft, marginTop: 8 }}>by hand</div>
        </div>
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Thread d="M 160 160 L 160 310" progress={pa} length={160} />
      </svg>
      {f < swap + 12 && (
        <BrowserFrame at={4} dur={swap} tilt={-4} style={{ left: 620, top: 150, opacity: interpolate(f, [swap, swap + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <div style={{ width: 1180, height: 640, overflow: "hidden", position: "relative" }}>
            <OffthreadVideo
              src={staticFile("clips/r2.mp4")}
              muted
              startFrom={60}
              style={{ position: "absolute", width: 1600 * 1.1, left: -250 * 1.1, top: -255 * 1.1 }}
            />
          </div>
        </BrowserFrame>
      )}
      {f >= swap && (
        <BrowserFrame at={swap} dur={dur - swap} tilt={-4} style={{ left: 620, top: 100 }}>
          <Crop src="clips/prior-auth.png" crop={crop} width={1180}>
            <FocusRing x={(1222 - crop.x) * k} y={(1696 - crop.y) * k} w={282 * k} h={72 * k} at={approve - 16} />
          </Crop>
        </BrowserFrame>
      )}
      <Sfx at={dur * 0.04} name="tick-a" volume={0.3} />
      <Sfx at={dur * 0.16} name="tick-b" volume={0.3} />
      <Sfx at={approve} name="gate-ok" volume={0.45} />
    </Paper>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const APPTS = [
  { label: "Labs", color: C.zone.green, from: [0, 1], to: 0 },
  { label: "CT scan", color: C.zone.violet, from: [3, 3], to: 1 },
  { label: "Clinic", color: C.zone.blue, from: [2, 0], to: 2 },
  { label: "Infusion", color: C.zone.rose, from: [4, 2], to: 3 },
];

/** [9] Scheduling fits everything into as few trips as it can. A Rust engine, not a model. */
export function Schedule({ dur }: S) {
  const colW = 250;
  const rowH = 120;
  const gx = 520;
  const gy = 250;
  const on = useProgress(4, 16);
  const rust = useEnter(dur * 0.55);
  return (
    <Paper>
      <div style={{ position: "absolute", left: 160, top: 120, display: "flex", alignItems: "center", gap: 22 }}>
        <Badge code="SC" on={on} size={80} />
        <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.ink }}>Scheduling</span>
        <span
          style={{
            marginLeft: 14,
            padding: "8px 18px",
            borderRadius: 6,
            background: C.ink,
            color: C.boardText,
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 24,
            opacity: rust,
            transform: `translateX(${(1 - rust) * -16}px)`,
          }}
        >
          Rust engine
        </span>
      </div>
      {DAYS.map((d, i) => (
        <div key={d}>
          <div style={{ position: "absolute", left: gx + i * colW, top: gy - 56, width: colW, textAlign: "center", fontFamily: F.text, fontWeight: 700, fontSize: 26, color: C.inkSoft }}>
            {d}
          </div>
          <div
            style={{
              position: "absolute",
              left: gx + i * colW + 8,
              top: gy,
              width: colW - 16,
              height: rowH * 5,
              borderRadius: 8,
              background: i === 1 ? C.agentTint : C.panel,
              border: `1px solid ${C.rule}`,
            }}
          />
        </div>
      ))}
      {APPTS.map((a, i) => (
        <Appt key={a.label} a={a} i={i} dur={dur} gx={gx} gy={gy} colW={colW} rowH={rowH} />
      ))}
      {APPTS.map((_, i) => (
        <Sfx key={i} at={dur * (0.2 + i * 0.08) + 14} name={i % 2 ? "tick-b" : "tick-a"} volume={0.22} />
      ))}
    </Paper>
  );
}

function Appt({ a, i, dur, gx, gy, colW, rowH }: { a: (typeof APPTS)[number]; i: number; dur: number; gx: number; gy: number; colW: number; rowH: number }) {
  const show = useEnter(6 + i * 4);
  const p = useProgress(dur * (0.2 + i * 0.08), dur * (0.2 + i * 0.08) + 16);
  const fx = gx + a.from[0]! * colW + 18;
  const fy = gy + a.from[1]! * rowH + 14;
  const tx = gx + colW + 18;
  const ty = gy + a.to * rowH + 14;
  return (
    <div
      style={{
        position: "absolute",
        left: fx + (tx - fx) * p,
        top: fy + (ty - fy) * p,
        width: colW - 36,
        height: rowH - 28,
        borderRadius: 8,
        background: a.color,
        color: "#fff",
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: 26,
        display: "flex",
        alignItems: "center",
        paddingLeft: 20,
        opacity: show,
        boxShadow: "0 16px 30px -18px rgba(24,34,58,.6)",
      }}
    >
      {a.label}
    </div>
  );
}

function Wheelchair({ size = 120, color = C.agent }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="26" cy="9" r="5" fill={color} stroke="none" />
      <path d="M26 17v18h16l6 14" />
      <path d="M26 26h13" />
      <path d="M20 30a14 14 0 1 0 20 16" />
    </svg>
  );
}

/** [10] A voice note: she'll need a wheelchair. A chair waits; every route skips the stairs. */
export function Voice({ dur, lead }: S & { lead: number }) {
  const f = useCurrentFrame();
  const talking = f < lead;
  const chair = useEnter(lead + dur * 0.32);
  const route = useProgress(lead + dur * 0.48, lead + dur * 0.78);
  const stairsX = useEnter(lead + dur * 0.52);
  return (
    <Paper>
      <Sequence from={4} durationInFrames={lead + 10} layout="none">
        <Audio src={staticFile("assets/maria-reply.wav")} volume={0.6} />
      </Sequence>
      <div style={{ position: "absolute", left: 230, top: 120 }}>
        <Phone width={360}>
          <div style={{ position: "absolute", left: 30, right: 30, top: 300, height: 120, display: "flex", alignItems: "center", gap: 7 }}>
            {Array.from({ length: 22 }).map((_, i) => {
              const h = talking ? 18 + Math.abs(Math.sin(f * 0.5 + i * 0.8)) * 70 * (0.5 + 0.5 * Math.sin(i)) : 14;
              return <div key={i} style={{ flex: 1, height: h, borderRadius: 4, background: C.agent, opacity: 0.85 }} />;
            })}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", justifyContent: "center", opacity: chair, transform: `scale(${0.7 + 0.3 * chair})` }}>
            <div style={{ background: C.agentTint, borderRadius: 999, padding: 26 }}>
              <Wheelchair size={110} />
            </div>
          </div>
        </Phone>
      </div>
      <div style={{ position: "absolute", left: 720, top: 150, display: "flex", alignItems: "center", gap: 20 }}>
        <Badge code="PM" on={chair} size={74} />
        <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 28, color: C.ink, opacity: 0.3 + 0.7 * chair }}>Messaging</span>
        <span style={{ width: 40 }} />
        <Badge code="IT" on={route} size={74} />
        <span style={{ fontFamily: F.text, fontWeight: 700, fontSize: 28, color: C.ink, opacity: 0.3 + 0.7 * route }}>Itinerary</span>
      </div>
      {/* entrance to clinic: the stairs are crossed out, the route takes the elevator */}
      <svg width={1100} height={700} style={{ position: "absolute", left: 720, top: 300 }}>
        <rect x={20} y={500} width={1040} height={14} rx={7} fill={C.rule} />
        <rect x={20} y={170} width={1040} height={14} rx={7} fill={C.rule} />
        {/* stairs */}
        <path d="M 330 500 L 330 455 L 380 455 L 380 410 L 430 410 L 430 365 L 480 365 L 480 320 L 530 320 L 530 275 L 580 275 L 580 230 L 630 230 L 630 184" stroke={C.inkSoft} strokeWidth={8} fill="none" opacity={1 - 0.55 * stairsX} />
        <g opacity={stairsX} transform="translate(480 340)">
          <path d="M -50 -50 L 50 50 M 50 -50 L -50 50" stroke={C.urgent} strokeWidth={12} strokeLinecap="round" />
        </g>
        {/* elevator shaft */}
        <rect x={820} y={160} width={110} height={360} rx={8} fill={C.ink} opacity={0.1} stroke={C.ink} strokeOpacity={0.35} strokeWidth={3} />
        <Thread d="M 60 470 L 875 470 L 875 150 L 1040 150" progress={route} length={1350} />
        <g transform="translate(40 380)" opacity={chair}>
          <foreignObject width={110} height={110}>
            <Wheelchair size={90} />
          </foreignObject>
        </g>
      </svg>
      <Sfx at={lead + dur * 0.32} name="ping" volume={0.5} />
      <Sfx at={lead + dur * 0.48} name="tick-a" volume={0.3} />
    </Paper>
  );
}
