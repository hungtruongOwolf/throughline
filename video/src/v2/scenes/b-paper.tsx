import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Camera, CometThread, Day, Drift, EZ, FULL, LineReveal, Odometer, Shot } from "../fx";
import { Sfx } from "../../components/frames";
import { C, F } from "../../theme";
import type { SceneProps } from "../types";
import { Catch, cl, Cursor, Gate, lerp, Plane, pointAt, Typed } from "./b-kit";

const FAX = "assets/maria-referral-fax.png";
const MONO = "Consolas, 'Courier New', monospace";

/* ===================================================================== IDEA */
type Link = { code: string; name: string } | { gate: string };
const CHAIN: Link[] = [
  { code: "IN", name: "Intake" },
  { code: "CV", name: "Coverage" },
  { code: "PA", name: "Prior auth" },
  { gate: "Coordinator" },
  { code: "SC", name: "Scheduling" },
  { code: "VP", name: "Visit prep" },
  { code: "PM", name: "Messaging" },
  { code: "WS", name: "Waiting room" },
  { code: "IT", name: "Itinerary" },
  { code: "CO", name: "Companion" },
  { code: "OP", name: "Ops planner" },
  { gate: "Operations lead" },
  { code: "RW", name: "Results watch" },
  { code: "DS", name: "Discharge" },
  { gate: "Doctor" },
  { code: "FU", name: "Follow-up" },
];
const NX = (i: number) => 400 + i * 300;
const NY = (i: number) => 540 + Math.sin(i * 0.9) * 70;
const CW = NX(CHAIN.length - 1) + 400;
const CHAIN_D =
  `M -400 540 L ${NX(0)} ${NY(0)}` +
  CHAIN.slice(1)
    .map((_, j) => {
      const i = j + 1;
      return ` C ${NX(i - 1) + 150} ${NY(i - 1)}, ${NX(i) - 150} ${NY(i)}, ${NX(i)} ${NY(i)}`;
    })
    .join("") +
  ` L ${CW + 400} ${NY(CHAIN.length - 1)}`;
const RUN = { from: 30, to: 110 };
const headP = (f: number) => interpolate(f, [RUN.from, RUN.to], [0, 1], cl);
// the frame at which the comet head reaches each link
const CATCH = CHAIN.map((_, i) => {
  for (let fr = RUN.from; fr <= RUN.to; fr++) if (pointAt(CHAIN_D, headP(fr)).x >= NX(i)) return fr;
  return RUN.to;
});

/** "Thirteen agents pass Maria's case hand to hand. People sign off at the gates." */
export function Idea(_: SceneProps) {
  const f = useCurrentFrame();
  return (
    <Day>
      {f < RUN.from ? <Thirteen /> : <Chain />}
      <Sfx at={0} name="count" volume={0.25} />
      {CHAIN.map((c, i) => ("gate" in c ? <Sfx key={i} at={CATCH[i]!} name="gate-hold" volume={0.16} /> : i % 2 === 0 ? <Sfx key={i} at={CATCH[i]!} name="tick-a" volume={0.18} /> : null))}
      <Sfx at={120} name="gate-hold" volume={0.3} />
    </Day>
  );
}

function Thirteen() {
  const f = useCurrentFrame();
  const lab = lerp(f, 8, 18, 0, 1, EZ.out);
  return (
    <AbsoluteFill style={{ transform: `scale(${lerp(f, 0, 30, 1, 1.05)})` }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={-20} y1={540} x2={1940} y2={540} stroke={C.agent} strokeWidth={6} />
      </svg>
      <div style={{ position: "absolute", left: 470, top: 170, display: "flex", alignItems: "flex-end", gap: 36 }}>
        <Odometer value={13} at={0} frames={15} size={340} color={C.ink} />
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 150, color: C.agent, lineHeight: 1, paddingBottom: 30, opacity: lab, transform: `translateX(${(1 - lab) * -30}px)` }}>agents</div>
      </div>
      <div style={{ position: "absolute", left: 480, top: 590, display: "flex", gap: 14, opacity: lerp(f, 14, 24, 0, 1, EZ.out) }}>
        {CHAIN.filter((c): c is { code: string; name: string } => "code" in c).map((c, i) => (
          <div key={c.code} style={{ width: 54, height: 54, borderRadius: 12, border: `3px solid ${C.agent}`, color: C.agent, fontFamily: F.text, fontWeight: 700, fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", transform: `translateY(${(1 - lerp(f, 14 + i, 22 + i, 0, 1, EZ.out)) * 20}px)` }}>
            {c.code}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

function Chain() {
  const f = useCurrentFrame();
  const p = headP(f);
  const head = pointAt(CHAIN_D, p);
  const w = lerp(f, RUN.to, RUN.to + 18, 0, 1, EZ.inOut);
  const sw = 1920 / (CW + 300);
  const follow = { s: 1, tx: Math.min(0, 1150 - head.x), ty: 0 };
  const wide = { s: sw, tx: 960 - ((NX(0) + NX(CHAIN.length - 1)) / 2) * sw, ty: 540 - 540 * sw };
  const s = Math.exp(Math.log(follow.s) * (1 - w) + Math.log(wide.s) * w);
  const tx = follow.tx * (1 - w) + wide.tx * w;
  const ty = follow.ty * (1 - w) + wide.ty * w;
  const card = lerp(f, 126, 138, 0, 1, EZ.out);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: 0, width: CW, height: 1080, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <CometThread d={CHAIN_D} progress={p} width={6} color={C.agent} head={p < 1} />
        {CHAIN.map((c, i) =>
          "gate" in c ? (
            <GatePulse key={i} x={NX(i)} y={NY(i)} label={c.gate} at={CATCH[i]!} grow={w} />
          ) : (
            <Catch key={i} code={c.code} name={c.name} catchAt={CATCH[i]!} x={NX(i)} y={NY(i)} size={84 * (1 + 0.9 * w)} labelSize={26} />
          ),
        )}
      </div>
      {card > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", opacity: card, transform: `translateY(${(1 - card) * 24}px)` }}>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 96, color: C.ink, display: "flex", gap: 34 }}>
            <span>13 agents</span>
            <span style={{ color: C.rule }}>·</span>
            <span style={{ color: C.held }}>3 gates</span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
}

function GatePulse({ x, y, label, at, grow }: { x: number; y: number; label: string; at: number; grow: number }) {
  const f = useCurrentFrame();
  const size = 24 * (1 + 1.3 * grow);
  const lift = -200 * grow;
  const pulse = f >= 118 ? ((f - 118) % 16) / 16 : -1;
  const lit = f >= at ? 1 : 0.45;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: lit }}>
      {grow > 0 && <div style={{ position: "absolute", left: -3, top: lift, width: 6, height: -lift, background: C.held }} />}
      {grow > 0 && <div style={{ position: "absolute", left: -14, top: -14, width: 28, height: 28, borderRadius: 14, background: C.held }} />}
      {pulse >= 0 && (
        <div style={{ position: "absolute", left: -size * 4 * (0.6 + pulse), top: lift - size * 1.4 * (0.6 + pulse), width: size * 8 * (0.6 + pulse), height: size * 2.8 * (0.6 + pulse), borderRadius: 999, border: `${size * 0.12}px solid ${C.held}`, opacity: 1 - pulse }} />
      )}
      <Gate who={label} okAt={99999} size={size} x={0} y={lift} />
    </div>
  );
}

/* ================================================================ HANDOFF-1 */
const FS = 1000 / 1207;
const FX0 = 560;
const FY0 = 40;
const fx = (x: number) => FX0 + x * FS;
const fy = (y: number) => FY0 + y * FS;
const ROWS: [number, number][] = [
  [327, 108],
  [371, 120],
  [415, 120],
  [459, 76],
  [503, 258],
  [547, 418],
  [591, 196],
  [635, 374],
  [679, 76],
];

/** "Intake reads the fax. Smudged member ID? It asks the coordinator instead of guessing." */
export function Handoff1({ dur }: SceneProps) {
  const f = useCurrentFrame();
  return (
    <Day>
      {f < 120 ? <FaxRead /> : null}
      <Sequence from={120} durationInFrames={dur - 120}>
        <InboxQuestion />
      </Sequence>
      <Sfx at={8} name="tick-a" volume={0.3} />
      <Sfx at={15} name="shutter" volume={0.18} />
      <Sfx at={78} name="gate-hold" volume={0.38} />
      <Sfx at={111} name="whoosh" volume={0.3} />
      <Sfx at={150} name="count" volume={0.18} />
      <Sfx at={180} name="ping" volume={0.25} />
    </Day>
  );
}

function FaxRead() {
  const f = useCurrentFrame();
  const entry = lerp(f, 0, 10, 0, 1, EZ.out);
  const scan = lerp(f, 15, 58, 290, 705, EZ.inOut);
  const circle = lerp(f, 64, 76, 0, 1, EZ.out);
  const q = lerp(f, 78, 86, 0, 1, EZ.out);
  const ask = lerp(f, 88, 102, 0, 1, EZ.inOut);
  return (
    <Camera
      keys={[
        { at: 0, rect: FULL },
        { at: 15, rect: { x: 480, y: 210, w: 1040, h: 470 } },
        { at: 56, rect: { x: 520, y: 300, w: 1000, h: 450 } },
        { at: 68, rect: { x: 760, y: 450, w: 540, h: 170 } },
        { at: 86, rect: { x: 760, y: 450, w: 540, h: 170 } },
        { at: 100, rect: { x: 820, y: 260, w: 720, h: 360 } },
        { at: 120, rect: { x: 840, y: 270, w: 680, h: 340 } },
      ]}
    >
      <Day>{null}</Day>
      <Img src={staticFile(FAX)} style={{ position: "absolute", left: FX0, top: FY0, width: 1000, boxShadow: "0 40px 80px -40px rgba(24,34,58,.5)" }} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {/* Intake's reading link to the scan head */}
        {f >= 12 && f < 62 && <line x1={300} y1={540} x2={fx(330)} y2={fy(scan)} stroke={C.agent} strokeWidth={3} strokeOpacity={0.55} strokeDasharray="6 8" />}
        {ROWS.map(([y, w]) => {
          const g = Math.min(1, Math.max(0, (scan - y - 14) / 26));
          const isId = y === 591;
          return <rect key={y} x={fx(360)} y={fy(y) + 14} width={w * FS * g} height={4} fill={isId ? C.held : C.agent} />;
        })}
        {f >= 15 && f < 60 && (
          <>
            <rect x={FX0} y={fy(scan) - 30} width={1000} height={30} fill="url(#b-scan)" />
            <rect x={FX0} y={fy(scan) - 1.5} width={1000} height={3} fill={C.agent} />
          </>
        )}
        <defs>
          <linearGradient id="b-scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.agent} stopOpacity={0} />
            <stop offset="100%" stopColor={C.agent} stopOpacity={0.22} />
          </linearGradient>
        </defs>
        <ellipse cx={fx(521)} cy={fy(591)} rx={56} ry={26} fill="none" stroke={C.held} strokeWidth={4} strokeDasharray={260} strokeDashoffset={260 * (1 - circle)} />
        {ask > 0 && <CometInSvg d={`M ${fx(568)} ${fy(591)} C ${fx(640)} ${fy(591)}, 1040 360, 1150 360`} p={ask} />}
      </svg>
      <div style={{ position: "absolute", left: fx(580), top: fy(591) - 44, fontFamily: F.display, fontWeight: 800, fontSize: 72, color: C.held, transform: `scale(${q < 1 ? 0.4 + 0.75 * q : 1})`, opacity: q, transformOrigin: "0 100%" }}>?</div>
      <Catch code="IN" name="Intake" catchAt={8} x={300} y={540} size={110} style={{ opacity: entry }} />
      {f < 12 && <CometThread d="M -60 540 L 245 540" progress={lerp(f, 0, 8, 0, 1, EZ.out)} color={C.agent} width={6} />}
      {f >= 8 && (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <line x1={-60} y1={540} x2={245} y2={540} stroke={C.agent} strokeWidth={6} />
        </svg>
      )}
      <Gate who="Jordan" role="coordinator" okAt={99999} x={1330} y={360} showAt={90} size={28} />
    </Camera>
  );
}

/** A comet drawn inside an existing svg (no Trail): stroke plus head dot. */
function CometInSvg({ d, p, color = C.agent }: { d: string; p: number; color?: string }) {
  const pt = pointAt(d, p);
  return (
    <>
      <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      {p < 1 && <circle cx={pt.x} cy={pt.y} r={9} fill="#e9fffb" stroke={color} strokeWidth={4} />}
    </>
  );
}

const INBOX = { x: 1184, y: 336, w: 2016, h: 1464 };
const IK = 1400 / INBOX.w;

function InboxQuestion() {
  const f = useCurrentFrame();
  const ring = lerp(f, 22, 34, 0, 1, EZ.out);
  const done = f >= 58;
  return (
    <Camera
      keys={[
        { at: 0, rect: FULL },
        { at: 16, rect: FULL },
        { at: 32, rect: { x: 950, y: 60, w: 660, h: 180 } },
        { at: 75, rect: { x: 930, y: 66, w: 700, h: 190 } },
      ]}
    >
      <Plane width={1400} at={0} rx={4} ry={-5}>
        <Shot src="clips/inbox-question.png" crop={INBOX} width={1400}>
          {/* Maria's own fax in the source panel */}
          <Img src={staticFile(FAX)} style={{ position: "absolute", left: 38 * IK, top: 77 * IK, width: 928 * IK }} />
          {/* the Member ID answer field */}
          <div
            style={{
              position: "absolute",
              left: 1045 * IK + 3,
              top: 238 * IK + 3,
              width: 640 * IK - 6,
              height: 72 * IK - 6,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              paddingLeft: 11,
              fontFamily: MONO,
              fontSize: 23,
              color: "#1d2333",
              borderRadius: 3,
            }}
          >
            <Typed text="LHP-883201-02" at={30} cps={0.62} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 1045 * IK - 8,
              top: 238 * IK - 8,
              width: 640 * IK + 16,
              height: 72 * IK + 16,
              borderRadius: 10,
              border: `4px solid ${done ? C.agent : C.held}`,
              opacity: ring,
              transform: `scale(${1.12 - 0.12 * ring})`,
            }}
          />
          {done && (
            <div style={{ position: "absolute", left: 1045 * IK + 640 * IK - 46, top: 238 * IK + 9, width: 32, height: 32, borderRadius: 16, background: C.agent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${lerp(f, 58, 66, 0.3, 1, EZ.out)})` }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
              </svg>
            </div>
          )}
        </Shot>
      </Plane>
    </Camera>
  );
}

/* ================================================================ HANDOFF-2 */
/** "One answer wakes Coverage, which flags the scan and tosses it to Prior auth." */
export function Handoff2({ dur }: SceneProps) {
  const f = useCurrentFrame();
  return (
    <Day>
      {f < 31 && <AnswerToCoverage />}
      {f >= 30 && f < 90 && <CoverageCheck />}
      {f >= 88 && f < 106 && <CoverageToPA />}
      <Sequence from={105} durationInFrames={dur - 105}>
        <Timeline reveal={[[0, 103], [6, 200], [14, 293]]} />
      </Sequence>
      <Sfx at={4} name="gate-ok" volume={0.4} />
      <Sfx at={20} name="tick-a" volume={0.3} />
      <Sfx at={44} name="tick-b" volume={0.2} />
      <Sfx at={54} name="gate-hold" volume={0.3} />
      <Sfx at={80} name="whoosh" volume={0.3} />
      <Sfx at={99} name="tick-a" volume={0.3} />
      <Sfx at={111} name="tick-b" volume={0.2} />
      <Sfx at={119} name="tick-a" volume={0.2} />
    </Day>
  );
}

function Chip({ x, y, children, tone = "agent" }: { x: number; y: number; children: ReactNode; tone?: "agent" | "held" }) {
  const col = tone === "held" ? C.held : C.agent;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -150%)",
        background: tone === "held" ? C.heldBg : "#fff",
        border: `3px solid ${col}`,
        color: col,
        borderRadius: 999,
        padding: "8px 20px",
        fontFamily: tone === "held" ? F.text : MONO,
        fontWeight: 700,
        fontSize: 26,
        whiteSpace: "nowrap",
        boxShadow: "0 14px 30px -18px rgba(24,34,58,.6)",
      }}
    >
      {children}
    </div>
  );
}

function AnswerToCoverage() {
  const f = useCurrentFrame();
  const d = "M 600 540 C 800 470, 1000 610, 1180 540";
  const p = lerp(f, 6, 20, 0, 1, EZ.inOut);
  const pt = pointAt(d, p);
  const zoom = Math.exp(lerp(f, 23, 31, 0, Math.log(3), EZ.in));
  return (
    <AbsoluteFill style={{ transformOrigin: "1250px 540px", transform: `scale(${zoom * lerp(f, 0, 23, 1, 1.06)})`, opacity: lerp(f, 27, 31, 1, 0) }}>
      <CometThread d={d} progress={p} color={C.agent} width={6} />
      <Gate who="Jordan" role="coordinator" okAt={4} x={380} y={540} size={30} />
      <Catch code="CV" name="Coverage" catchAt={20} x={1250} y={540} size={120} labelSize={34} />
      {p > 0 && p < 1 && <Chip x={pt.x} y={pt.y}>LHP-883201-02</Chip>}
    </AbsoluteFill>
  );
}

const SERVICES = ["CBC w/ diff", "CMP", "CT chest/abdomen/pelvis", "New patient consult"];

function CoverageCheck() {
  const f = useCurrentFrame();
  const enter = lerp(f, 30, 40, 0, 1, EZ.out);
  const card = lerp(f, 31, 43, 0, 1, EZ.out);
  const ck = 720 / 1012;
  const whip = lerp(f, 80, 89, 0, 1, EZ.in);
  return (
    <AbsoluteFill style={{ transform: `translateX(${-whip * 60}%) scale(${(1.12 - 0.12 * enter) * (1 + 0.06 * whip)}, ${1.12 - 0.12 * enter})`, filter: whip > 0 ? `blur(${whip * 18}px)` : undefined }}>
      <Drift seed="h2b" amp={7}>
        <Catch code="CV" catchAt={-99} x={170} y={150} size={72} />
        <div style={{ position: "absolute", left: 230, top: 118, fontFamily: F.display, fontWeight: 800, fontSize: 60, color: C.ink }}>Coverage</div>
        <div style={{ position: "absolute", left: 160, top: 330, transform: `translateY(${(1 - card) * 90}px) rotate(${-3 + 1.5 * card}deg)`, opacity: card }}>
          <Img src={staticFile("assets/maria-insurance-card.png")} style={{ width: 720, borderRadius: 26, boxShadow: "0 50px 90px -40px rgba(24,34,58,.55)" }} />
          <div style={{ position: "absolute", left: 46 * ck, top: 326 * ck, height: 5, width: 270 * ck * lerp(f, 38, 46, 0, 1, EZ.out), background: C.agent }} />
          <div style={{ position: "absolute", left: 46 * ck, top: 428 * ck, height: 5, width: 225 * ck * lerp(f, 42, 50, 0, 1, EZ.out), background: C.agent }} />
          <div style={{ position: "absolute", left: 600, top: -26, width: 92, height: 92, borderRadius: 46, background: C.agent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${lerp(f, 46, 54, 0, 1, EZ.out)})`, boxShadow: "0 0 0 10px rgba(15,118,110,.15)" }}>
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div style={{ position: "absolute", left: 1010, top: 300, width: 760, background: C.panel, borderRadius: 16, padding: "30px 34px", boxShadow: "0 40px 80px -40px rgba(24,34,58,.45)", opacity: lerp(f, 34, 42, 0, 1), transform: `translateY(${(1 - lerp(f, 34, 44, 0, 1, EZ.out)) * 40}px)` }}>
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 24, color: C.inkSoft, letterSpacing: "0.08em", marginBottom: 16 }}>SERVICES REQUESTED</div>
          {SERVICES.map((s, i) => {
            const flag = i === 2;
            const ok = lerp(f, 44 + i * 3, 50 + i * 3, 0, 1, EZ.out);
            const fl = lerp(f, 54, 62, 0, 1, EZ.out);
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 14px", borderTop: i ? `1px solid ${C.rule}` : "none", background: flag && fl > 0 ? C.heldBg : "transparent", borderLeft: `6px solid ${flag && fl > 0 ? C.held : "transparent"}`, borderRadius: 4 }}>
                <div style={{ width: 34, height: 34, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", background: flag ? (fl > 0 ? C.held : C.rule) : ok > 0.5 ? C.agent : C.rule, transform: `scale(${0.7 + 0.3 * (flag ? fl : ok)})` }}>
                  {flag ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M5 3v18h2v-7h9l-2-4 2-4H7V3z" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" /></svg>
                  )}
                </div>
                <div style={{ flex: 1, fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.ink }}>{s}</div>
                {flag && fl > 0 && (
                  <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 22, color: C.held, border: `2px solid ${C.held}`, borderRadius: 999, padding: "6px 14px", transform: `scale(${0.6 + 0.4 * fl})`, opacity: fl, whiteSpace: "nowrap" }}>Needs prior auth</div>
                )}
              </div>
            );
          })}
        </div>
      </Drift>
    </AbsoluteFill>
  );
}

function CoverageToPA() {
  const f = useCurrentFrame();
  const inn = lerp(f, 88, 95, 0, 1, EZ.out);
  const d = "M 470 540 C 800 460, 1100 620, 1430 540";
  const p = lerp(f, 89, 99, 0, 1, EZ.inOut);
  const pt = pointAt(d, p);
  return (
    <AbsoluteFill style={{ transform: `translateX(${(1 - inn) * 55}%)`, filter: inn < 1 ? `blur(${(1 - inn) * 18}px)` : undefined }}>
      <CometThread d={d} progress={p} color={C.agent} width={6} />
      <Catch code="CV" name="Coverage" catchAt={-99} x={400} y={540} size={120} labelSize={34} />
      <Catch code="PA" name="Prior auth" catchAt={99} x={1500} y={540} size={120} labelSize={34} />
      {p > 0 && p < 1 && (
        <Chip x={pt.x} y={pt.y} tone="held">
          CT scan
        </Chip>
      )}
    </AbsoluteFill>
  );
}

/* the r2 record: the agent timeline writing itself */
const R2 = { x: 250, y: 300, w: 1050, h: 400 };
const RK = 1500 / R2.w;
export const R2_ROWS = [103, 200, 293, 393, 486, 557];

function Timeline({ reveal, push }: { reveal: [number, number][]; push?: { at: number; to: number } }) {
  const f = useCurrentFrame();
  const h = interpolate(
    f,
    reveal.map((r) => r[0]),
    reveal.map((r) => r[1]),
    { ...cl, easing: EZ.out },
  );
  const sc = push ? lerp(f, push.at, push.at + 20, 1, push.to, EZ.inOut) : lerp(f, 0, 40, 1, 1.05);
  return (
    <AbsoluteFill style={{ transform: `scale(${sc})`, transformOrigin: "40% 62%" }}>
      <Plane width={1500} at={reveal[0]![0] === 0 && !push ? 0 : undefined} rx={6} ry={-8}>
        <div style={{ width: 1500, height: R2.h * RK, position: "relative", overflow: "hidden", background: "#fff" }}>
          <OffthreadVideo src={staticFile("clips/r2.mp4")} muted startFrom={90} style={{ position: "absolute", width: 1600 * RK, height: 900 * RK, left: -R2.x * RK, top: -R2.y * RK, maxWidth: "none" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: h, bottom: 0, background: "#fff", overflow: "hidden" }}>
            {R2_ROWS.map((y, i) => (
              <div key={i} style={{ position: "absolute", left: 60, top: y - h - 62, display: "flex", gap: 22, alignItems: "center", opacity: 0.55 }}>
                <div style={{ width: 70, height: 12, borderRadius: 6, background: C.rule }} />
                <div style={{ width: 30, height: 30, borderRadius: 8, border: `2px dashed ${C.rule}` }} />
                <div style={{ width: 360 + ((i * 97) % 200), height: 14, borderRadius: 7, background: C.rule }} />
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: h - 2, height: 3, background: C.agent, opacity: 0.6, boxShadow: `0 0 16px ${C.agent}` }} />
        </div>
      </Plane>
    </AbsoluteFill>
  );
}

/* ================================================================ HANDOFF-3 */
const PA = { x: 1200, y: 340, w: 2000, h: 1460 };
const PK = 1400 / PA.w;
// draft field (crop px: value mid-y, top, bottom) -> source row on the fax (crop px y, value end x)
const TETHERS = [
  { fy: 134, t: 92, b: 150, sy: 494, sx: 622 },
  { fy: 242, t: 201, b: 262, sy: 979, sx: 410 },
  { fy: 348, t: 306, b: 410, sy: 742, sx: 418 },
  { fy: 498, t: 455, b: 515, sy: 595, sx: 357 },
  { fy: 602, t: 561, b: 620, sy: 629, sx: 476 },
];

function PriorAuthPlane({ at, tethersAt, children }: { at?: number; tethersAt: number; children?: ReactNode }) {
  const f = useCurrentFrame();
  return (
    <Plane width={1400} at={at} rx={3} ry={-4}>
      <Shot src="clips/prior-auth.png" crop={PA} width={1400}>
        <Img src={staticFile(FAX)} style={{ position: "absolute", left: 22 * PK, top: 73 * PK, width: 928 * PK }} />
        {/* Maria's diagnosis code as her fax states it */}
        <div style={{ position: "absolute", left: 1027 * PK, top: 478 * PK, width: 110 * PK, height: 38 * PK, background: "#fff", fontFamily: F.text, fontSize: 19.5, lineHeight: `${38 * PK}px`, color: "#1f2633" }}>C34.90</div>
        <svg width={1400} height={PA.h * PK} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {TETHERS.map((t, i) => {
            const p = lerp(f, tethersAt + i * 12, tethersAt + i * 12 + 10, 0, 1, EZ.inOut);
            if (p <= 0) return null;
            const x1 = 1012 * PK;
            const y1 = t.fy * PK;
            const x2 = t.sx * PK + 12;
            const y2 = t.sy * PK - 4;
            const d = `M ${x1} ${y1} C ${x1 - 120} ${y1}, ${x2 + 120} ${y2}, ${x2} ${y2}`;
            return (
              <g key={i}>
                <rect x={1008 * PK} y={t.t * PK} width={5} height={(t.b - t.t) * PK * p} fill={C.agent} />
                <rect x={(22 + 362 * 0.7689) * PK} y={y2 + 8} width={(x2 - 12 - (22 + 362 * 0.7689) * PK) * p} height={3} fill={C.agent} />
                <path d={d} fill="none" stroke={C.agent} strokeWidth={3} strokeOpacity={0.85} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
                <circle cx={x1} cy={y1} r={6} fill={C.agent} />
                {p > 0.95 && <circle cx={x2} cy={y2} r={6} fill={C.agent} />}
              </g>
            );
          })}
        </svg>
        {children}
      </Shot>
    </Plane>
  );
}

/** "Prior auth drafts the whole request, with a source next to every line." */
export function Handoff3(_: SceneProps) {
  const f = useCurrentFrame();
  return (
    <Day>
      {f < 30 && (
        <Camera keys={[{ at: 0, rect: FULL }, { at: 26, rect: { x: 220, y: 470, w: 1150, h: 260 } }]}>
          <Timeline reveal={[[0, 293], [6, 393], [16, 486], [24, 557]]} push={{ at: 99, to: 1 }} />
        </Camera>
      )}
      {f >= 30 && (
        <Camera
          keys={[
            { at: 30, rect: FULL },
            { at: 50, rect: FULL },
            { at: 66, rect: { x: 440, y: 60, w: 1250, h: 500 } },
            { at: 120, rect: { x: 440, y: 170, w: 1250, h: 500 } },
          ]}
        >
          <PriorAuthPlane at={30} tethersAt={62} />
        </Camera>
      )}
      <Sfx at={6} name="tick-a" volume={0.28} />
      <Sfx at={16} name="tick-b" volume={0.2} />
      <Sfx at={21} name="whoosh" volume={0.28} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Sfx key={i} at={62 + i * 12 + 9} name={i % 2 ? "tick-b" : "tick-a"} volume={0.18} />
      ))}
    </Day>
  );
}

/* =================================================================== GATE-1 */
/** "The coordinator approves. By hand, that's twenty-four minutes. Here, it's already written." */
export function Gate1({ dur }: SceneProps) {
  const f = useCurrentFrame();
  return (
    <Day>
      {f < 60 && <Approve />}
      {f >= 60 && f < 165 && <Minutes />}
      {f >= 165 && <ToScheduling dur={dur} />}
      <Sfx at={6} name="gate-hold" volume={0.35} />
      <Sfx at={45} name="tick-a" volume={0.4} />
      <Sfx at={47} name="gate-ok" volume={0.45} />
      <Sfx at={84} name="count" volume={0.25} />
      <Sfx at={105} name="impact" volume={0.22} />
      <Sfx at={120} name="whoosh" volume={0.22} />
      <Sfx at={135} name="ping" volume={0.3} />
      <Sfx at={156} name="whoosh" volume={0.28} />
      <Sfx at={190} name="tick-a" volume={0.3} />
    </Day>
  );
}

function Approve() {
  const f = useCurrentFrame();
  const press = f >= 45 && f < 52 ? 1 : 0;
  const glow = lerp(f, 47, 58, 0, 1, EZ.out);
  const go = lerp(f, 48, 60, 0, 1, EZ.inOut);
  // plane coordinates (crop px * PK): Approve button and the gate pill to the right of "Send back"
  const btn = { x: 22 * PK, y: 1356 * PK, w: 282 * PK, h: 72 * PK };
  return (
    <Camera
      keys={[
        { at: 0, rect: { x: 440, y: 170, w: 1250, h: 500 } },
        { at: 20, rect: { x: 250, y: 925, w: 820, h: 150 } },
        { at: 48, rect: { x: 250, y: 925, w: 820, h: 150 } },
        { at: 60, rect: { x: 200, y: 640, w: 1500, h: 440 } },
      ]}
    >
      <PriorAuthPlane tethersAt={-200}>
        <div style={{ position: "absolute", left: btn.x, top: btn.y, width: btn.w, height: btn.h, borderRadius: 6, background: "rgba(0,0,0,.22)", opacity: press }} />
        <div style={{ position: "absolute", left: btn.x - 6, top: btn.y - 6, width: btn.w + 12, height: btn.h + 12, borderRadius: 10, border: `4px solid ${C.glow}`, opacity: glow * (1 - lerp(f, 54, 60, 0, 1)) }} />
        <svg width={1400} height={1100} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          {go > 0 && <CometInSvg d={`M 772 ${btn.y + btn.h / 2} L 1600 ${btn.y + btn.h / 2}`} p={go} />}
        </svg>
        <Gate who="Jordan" role="coordinator" okAt={47} x={610} y={btn.y + btn.h / 2} size={21} showAt={2} />
        <Cursor from={[560, 720]} to={[btn.x + btn.w * 0.55, btn.y + btn.h * 0.55]} at={20} travel={18} clickAt={45} scale={0.75} />
      </PriorAuthPlane>
    </Camera>
  );
}

function Minutes() {
  const f = useCurrentFrame();
  const lab = lerp(f, 60, 70, 0, 1, EZ.out);
  const ring = lerp(f, 62, 104, 0, 1, (t) => t);
  const strike = lerp(f, 120, 130, 0, 1, EZ.out);
  const move = lerp(f, 128, 140, 0, 1, EZ.inOut);
  const zero = lerp(f, 135, 144, 0, 1, EZ.out);
  const arrow = lerp(f, 132, 140, 0, 1, EZ.out);
  const push = lerp(f, 60, 165, 1, 1.06, (t) => t);
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Drift seed="g1m" amp={6}>
        {/* by hand */}
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateX(${-430 * move}px) scale(${1 - 0.25 * move})`, opacity: 1 - 0.5 * move }}>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <svg width={560} height={560} style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -280, marginTop: -250, overflow: "visible" }}>
              <circle cx={280} cy={280} r={250} fill="none" stroke={C.rule} strokeWidth={10} />
              <circle cx={280} cy={280} r={250} fill="none" stroke={C.held} strokeWidth={10} strokeDasharray={2 * Math.PI * 250} strokeDashoffset={2 * Math.PI * 250 * (1 - ring * 0.4)} transform="rotate(-90 280 280)" strokeLinecap="round" />
            </svg>
            <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 40, color: C.held, letterSpacing: "0.14em", opacity: lab, transform: `translateY(${(1 - lab) * 16}px)` }}>BY HAND</div>
            <div style={{ position: "relative" }}>
              <Odometer value={24} at={84} frames={21} size={300} color={C.ink} suffix="min" />
              {strike > 0 && (
                <div style={{ position: "absolute", left: -20, top: "52%", height: 10, width: `calc(${strike * 100}% + 40px)`, background: C.agent, borderRadius: 5, boxShadow: `0 0 18px ${C.glow}` }} />
              )}
            </div>
          </div>
        </AbsoluteFill>
        {arrow > 0 && (
          <div style={{ position: "absolute", left: 900, top: 470, fontFamily: F.display, fontWeight: 800, fontSize: 140, color: C.agent, opacity: arrow, transform: `translateX(${(1 - arrow) * -40}px)` }}>→</div>
        )}
        {zero > 0 && (
          <div style={{ position: "absolute", left: 1150, top: 330, display: "flex", flexDirection: "column", alignItems: "center", opacity: zero, transform: `scale(${1.3 - 0.3 * zero})`, filter: zero < 1 ? `blur(${(1 - zero) * 10}px)` : undefined }}>
            <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 40, color: C.agent, letterSpacing: "0.14em" }}>ALREADY WRITTEN</div>
            {/* the draft is done; the coordinator only reads and approves */}
            <svg width={300} height={300} viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke={C.agent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" strokeDashoffset={24 * (1 - zero)} />
            </svg>
          </div>
        )}
      </Drift>
    </AbsoluteFill>
  );
}

function ToScheduling({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const d = "M 760 540 C 1000 460, 1200 620, 1420 540";
  const p = lerp(f, 168, 190, 0, 1, EZ.inOut);
  const push = lerp(f, 165, dur, 1, 1.07, EZ.out);
  return (
    <AbsoluteFill style={{ transform: `scale(${push})`, transformOrigin: "75% 50%" }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={-20} y1={540} x2={330} y2={540} stroke={C.agent} strokeWidth={6} />
      </svg>
      <CometThread d={d} progress={p} color={C.agent} width={6} />
      <Gate who="Jordan" role="coordinator" okAt={-99} x={540} y={540} size={30} />
      <Catch code="SC" name="Scheduling" catchAt={190} x={1500} y={540} size={120} labelSize={34} />
    </AbsoluteFill>
  );
}
