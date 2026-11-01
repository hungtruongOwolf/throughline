import { AbsoluteFill, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import { C, F } from "../../theme";
import { Sfx } from "../../components/frames";
import { Drift, EZ, LineReveal, Night, Odometer, SP, WordSlam } from "../fx";
import type { Group, SceneProps } from "../types";
import { AMBER, Chain, type ChainOpts, flick, gapPoints, Halftone, HBlur, RED, STATIONS, Tag, TrafficWall, World, ramp, track } from "./a-kit";

function Placeholder({ text }: SceneProps) {
  return <AbsoluteFill style={{ background: "#18223a", color: "#fff", fontSize: 40, padding: 80 }}>{text}</AbsoluteFill>;
}

/** Decaying camera shake after an impact. */
const shake = (f: number, at: number, amp = 14, decay = 5) => {
  const t = f - at;
  if (t < 0) return { x: 0, y: 0 };
  const k = amp * Math.exp(-t / decay);
  return { x: noise2D("shx" + at, f * 0.7, 0) * k, y: noise2D("shy" + at, f * 0.7, 5) * k };
};

const flash = (f: number, at: number, tau = 2) => (f < at ? 0 : Math.exp(-(f - at) / tau));

// =================================================================================================
// COLD-OPEN (165): fax scan -> 155M over sign traffic -> each visit is a chain
// =================================================================================================

const FAX_W = 1207;

function FaxScan() {
  const f = useCurrentFrame();
  const scanY = interpolate(f, [0, 27], [20, 760], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.inOut });
  const k = interpolate(f, [0, 30], [1.75, 1.3], { extrapolateRight: "clamp" });
  const tx = 960 - 600 * k + interpolate(f, [0, 30], [80, -30]);
  const ty = 600 - scanY * k;
  const blast = ramp(f, 24, 30, EZ.in);
  return (
    <AbsoluteFill style={{ perspective: 1800, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `rotateX(${16 - 6 * blast}deg) rotateZ(-3deg) scale(${1 + 0.6 * blast})`, transformOrigin: "50% 55%" }}>
        <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
          <div style={{ width: FAX_W, height: 1559, position: "relative", clipPath: `inset(0 0 ${1559 - scanY}px 0)` }}>
            <Img src={staticFile("assets/maria-referral-fax.png")} style={{ width: FAX_W, filter: "grayscale(1) contrast(1.5) brightness(.96)" }} />
            <Halftone size={4} opacity={0.28} />
            {/* fresh thermal print: the last rows still glow */}
            <div style={{ position: "absolute", left: 0, right: 0, top: scanY - 90, height: 90, background: "linear-gradient(180deg, rgba(233,255,251,0), rgba(233,255,251,.35))" }} />
          </div>
          {/* the scan head */}
          <div style={{ position: "absolute", left: -200, width: FAX_W + 400, top: scanY - 3, height: 6, background: "#e9fffb", boxShadow: "0 0 30px 10px rgba(233,255,251,.55), 0 0 90px 30px rgba(45,212,191,.25)" }} />
          {/* line noise ahead of the head */}
          {Array.from({ length: 6 }, (_, i) => {
            const n = noise2D("fx" + i, f * 0.9, i);
            return (
              <div
                key={i}
                style={{ position: "absolute", left: 100 + ((i * 397) % 700) + n * 120, top: scanY + 8 + i * 7, width: 120 + Math.abs(n) * 380, height: 2, background: "rgba(233,255,251,.35)" }}
              />
            );
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#f4f6f2", opacity: ramp(f, 27, 30, EZ.in) * 0.9 }} />
    </AbsoluteFill>
  );
}

function StatShot() {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame: f, fps, config: SP.snappy });
  const sh = shake(f, 30, 18, 5);
  const push = interpolate(f, [0, 75], [1, 1.1]);
  const exit = ramp(f, 66, 75, EZ.in);
  const blur = exit * 80;
  return (
    <AbsoluteFill>
      <HBlur id="co-stat" amount={blur} style={{ transform: `translateX(${-exit * 700}px)` }}>
        <AbsoluteFill style={{ transform: `scale(${push}) translate(${sh.x}px, ${sh.y}px)` }}>
          <TrafficWall speed={interpolate(f, [0, 20, 75], [4, 1.2, 1.6], { extrapolateRight: "clamp" })} />
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(24,34,58,.92) 0%, rgba(24,34,58,.55) 45%, rgba(24,34,58,0) 75%)" }} />
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "flex-end", transform: `scale(${1.35 - 0.35 * slam})`, opacity: Math.min(1, slam * 3), marginTop: -90 }}>
              <Odometer value={155} at={4} frames={26} size={340} />
              <span style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 250, color: C.glow, lineHeight: 1, marginLeft: 12, marginBottom: 18 }}>M</span>
            </div>
            <div style={{ position: "absolute", top: 640, width: 1920, display: "flex", justifyContent: "center" }}>
              <LineReveal lines={[f < 38 ? "" : "US ER visits / year"]} at={38} size={70} weight={700} align="center" color="rgba(244,246,242,.85)" />
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </HBlur>
      <AbsoluteFill style={{ background: "#f4f6f2", opacity: flash(f, 0, 2.5) * 0.6 }} />
      <AbsoluteFill style={{ background: "#f4f6f2", opacity: flash(f, 30, 1.6) * 0.35 }} />
    </AbsoluteFill>
  );
}

const CHAIN5 = ["Referral", "Insurance", "Visit", "Results", "Follow-up"];

function ChainShot() {
  const f = useCurrentFrame();
  const inn = ramp(f, 0, 11);
  const ry = interpolate(f, [0, 60], [20, 6]);
  const s = interpolate(f, [0, 60], [1.12, 1.0]);
  const opts: ChainOpts = {
    labels: CHAIN5,
    w: 286,
    g: 64,
    h: 92,
    fs: 44,
    y: 520,
    enter: (i) => ramp(f, 2 + i * 3, 13 + i * 3),
    link: ramp(f, 20, 32, EZ.inOut),
    gap: ramp(f, 38, 46),
    seed: "co",
  };
  return (
    <HBlur id="co-chain" amount={(1 - inn) * 70}>
      <Drift seed="co-chain" amp={10}>
        <AbsoluteFill style={{ perspective: 1800, transform: `translateX(${(1 - inn) * 600}px)` }}>
          <AbsoluteFill style={{ transform: `rotateY(${-ry}deg) rotateX(6deg) scale(${s})` }}>
            {[-3, -2, -1, 1, 2, 3].map((r) => (
              <AbsoluteFill key={r} style={{ transform: `translate(${((r * 173) % 260) - 130 + f * (r % 2 ? 2 : -2)}px, ${r * 150}px) scale(${1 - Math.abs(r) * 0.08})`, opacity: 0.16 - Math.abs(r) * 0.035 }}>
                <Chain {...opts} gap={0} />
              </AbsoluteFill>
            ))}
            <Chain {...opts} />
          </AbsoluteFill>
        </AbsoluteFill>
      </Drift>
    </HBlur>
  );
}

function ColdOpen(_: SceneProps) {
  return (
    <Night light={0.07}>
      <Sfx at={0} name="fax" volume={0.35} />
      <Sfx at={21} name="whoosh" volume={0.3} />
      <Sfx at={36} name="count" volume={0.25} />
      <Sfx at={60} name="impact" volume={0.42} />
      <Sfx at={96} name="whoosh" volume={0.3} />
      <Sfx at={126} name="tick-a" volume={0.3} />
      <Sfx at={131} name="tick-b" volume={0.3} />
      <Sequence durationInFrames={30}>
        <FaxScan />
      </Sequence>
      <Sequence from={30} durationInFrames={75}>
        <StatShot />
      </Sequence>
      <Sequence from={105} durationInFrames={60}>
        <ChainShot />
      </Sequence>
    </Night>
  );
}

// =================================================================================================
// PROBLEM-1/2 (135, 165): the wall of stations, whip-panned
// =================================================================================================

const HIDE = 99999;
const SHOWN = -999;

function StationPan({ cam, reveal, id, zoomBase = 1, gapBoost = 0 }: { cam: (f: number) => number; reveal: number[]; id: string; zoomBase?: number; gapBoost?: number }) {
  const f = useCurrentFrame();
  const v = cam(f + 0.5) - cam(f - 0.5);
  const zoom = zoomBase * (1 - Math.min(0.12, Math.abs(v) * 0.7));
  return (
    <HBlur id={id} amount={Math.abs(v) * 1250 * 0.4}>
      <Drift seed={id} amp={9}>
        <World cam={cam(f)} zoom={zoom} reveal={reveal} gapBoost={gapBoost} />
      </Drift>
    </HBlur>
  );
}

const p1cam = (f: number) =>
  f < 124
    ? track(f, [
        [0, 0],
        [45, 0],
        [57, 1],
        [75, 1],
        [87, 2],
        [124, 2],
      ])
    : 2 + EZ.inOut(Math.min(1, (f - 124) / 24));

function Problem1(_: SceneProps) {
  const f = useCurrentFrame();
  const zoomBase = interpolate(f, [0, 22], [0.78, 1], { extrapolateRight: "clamp", easing: EZ.out });
  return (
    <Night light={0.08}>
      <StationPan id="p1" cam={p1cam} zoomBase={zoomBase} reveal={[4, 48, 78, 126, HIDE, HIDE, HIDE]} gapBoost={ramp(f, 100, 120)} />
      <Tag text="Before" at={2} />
      <Sfx at={36} name="whoosh" volume={0.3} />
      <Sfx at={66} name="whoosh" volume={0.3} />
      {[98, 104, 110].map((t) => (
        <Sfx key={t} at={t} name="tick-b" volume={0.18} />
      ))}
      <Sfx at={116} name="whoosh" volume={0.3} />
    </Night>
  );
}

const p2cam = (f: number) =>
  f < 12
    ? 2.4 + 0.6 * EZ.out(f / 12)
    : track(f, [
        [12, 3],
        [45, 3],
        [57, 4],
        [90, 4],
        [102, 5],
        [120, 5],
        [132, 6],
      ]);

function Problem2(_: SceneProps) {
  const f = useCurrentFrame();
  const zoomBase = interpolate(f, [140, 165], [1, 0.72], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.in });
  return (
    <Night light={0.08}>
      <StationPan id="p2" cam={p2cam} zoomBase={zoomBase} reveal={[SHOWN, SHOWN, SHOWN, SHOWN, 50, 95, 125]} gapBoost={ramp(f, 140, 160)} />
      <Tag text="During" at={2} out={84} />
      <Tag text="After" at={92} />
      <Sfx at={36} name="whoosh" volume={0.3} />
      <Sfx at={81} name="whoosh" volume={0.3} />
      <Sfx at={111} name="whoosh" volume={0.3} />
      <Sfx at={137} name="ping" volume={0.2} />
      <Sfx at={145} name="ping" volume={0.18} />
    </Night>
  );
}

// =================================================================================================
// PROBLEM-3 (135): every link a different person; the chain snaps
// =================================================================================================

const LABELS7 = STATIONS.map((s) => s.label);
const ROLES = ["Clerk", "Payer", "Scheduler", "Porter", "Nurse", "Lab", "Front desk"];

const chain7 = (f: number, spread: number, gap: number, people = 1): ChainOpts => ({
  labels: LABELS7,
  w: 212,
  g: 38,
  h: 72,
  fs: 29,
  y: 470,
  spread,
  gap,
  roles: ROLES,
  people: (i) => (people >= 1 ? 1 : ramp(f, 8 + i * 6, 18 + i * 6)),
  seed: "p3",
});

const p3spread = (f: number) => (f < 75 ? 0 : ramp(f, 75, 92) + Math.max(0, f - 92) * 0.006);

function Problem3(_: SceneProps) {
  const f = useCurrentFrame();
  const spread = p3spread(f);
  const gap = f < 58 ? 0.55 : interpolate(f, [58, 74], [0.55, 1.4], { extrapolateRight: "clamp" });
  const o = chain7(f, spread, gap, 0);
  const g = gapPoints(o, 3);
  const gx = (g.a.x + g.b.x) / 2;
  const gy = (g.a.y + g.b.y) / 2;
  const intro = interpolate(f, [0, 12], [1.45, 1], { extrapolateRight: "clamp", easing: EZ.out });
  const dolly = interpolate(f, [12, 74, 92], [1, 1.06, 0.92], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.out });
  const end = interpolate(f, [104, 135], [1, 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EZ.in });
  const sh = shake(f, 75, 22, 6);
  const redFlash = flash(f, 75, 4);
  return (
    <Night light={0.06}>
      <AbsoluteFill style={{ transformOrigin: `${gx}px ${gy}px`, transform: `translate(${sh.x}px, ${sh.y}px) scale(${intro * dolly * end})` }}>
        <Drift seed="p3" amp={8}>
          <Chain {...o} />
        </Drift>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${gx}px ${gy}px, rgba(240,82,74,.45) 0%, rgba(240,82,74,0) 50%)`, opacity: redFlash }} />
      <div style={{ position: "absolute", top: 760, width: 1920, display: "flex", justifyContent: "center", opacity: 1 - ramp(f, 118, 130, EZ.in) }}>
        <WordSlam text="Nobody." at={78} size={150} color={C.boardText} />
      </div>
      {[0, 2, 4, 6].map((i) => (
        <Sfx key={i} at={8 + i * 6} name={i % 4 === 0 ? "tick-a" : "tick-b"} volume={0.2} />
      ))}
      <Sfx at={75} name="impact" volume={0.45} />
    </Night>
  );
}

// =================================================================================================
// PRICE-1 (135): a quarter of US health spending is waste
// =================================================================================================

const RCX = 1290;
const RCY = 540;
const RR = 320;
const WASTE = "#f0703a";

function Fraction({ size, color }: { size: number; color: string }) {
  return (
    <div style={{ position: "relative", width: size * 1.05, height: size * 1.25, fontFamily: F.figure, fontWeight: 600, color, lineHeight: 1 }}>
      <span style={{ position: "absolute", left: 0, top: 0, fontSize: size * 0.72 }}>1</span>
      <div style={{ position: "absolute", left: size * 0.12, top: size * 0.62, width: size * 0.9, height: size * 0.06, background: color, transform: "rotate(-52deg)", transformOrigin: "50% 50%", borderRadius: 4 }} />
      <span style={{ position: "absolute", right: 0, bottom: 0, fontSize: size * 0.72 }}>4</span>
    </div>
  );
}

function Price1(_: SceneProps) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const draw = ramp(f, 0, 34, EZ.inOut);
  const hi = ramp(f, 36, 46);
  const detach = ramp(f, 90, 100);
  const rest = 1 - 0.45 * ramp(f, 95, 115);
  const camS = interpolate(f, [0, 40, 135], [1.28, 1, 1.07], { extrapolateRight: "clamp", easing: EZ.out });
  const camR = interpolate(f, [0, 40], [-9, 0], { extrapolateRight: "clamp", easing: EZ.out });
  const camX = interpolate(f, [80, 135], [0, -50], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const slam = spring({ frame: f - 45, fps, config: { damping: 10, stiffness: 180 } });
  const sh = shake(f, 45, 14, 5);
  const bis = (-45 * Math.PI) / 180;
  const ticks = Array.from({ length: 100 }, (_, i) => {
    const a = ((-90 + i * 3.6 + 1.8) * Math.PI) / 180;
    const quarter = i < 25;
    const vis = Math.max(0, Math.min(1, draw * 100 - i));
    let ox = 0;
    let oy = 0;
    let op = vis;
    let rot = 0;
    if (quarter) {
      ox = Math.cos(bis) * 70 * detach;
      oy = Math.sin(bis) * 70 * detach;
      const t0 = 98 + ((i * 7) % 25) * 0.9;
      const t = Math.max(0, f - t0);
      oy += 0.55 * t * t;
      ox += noise2D("wx" + i, i, 0) * 3 * t;
      rot = noise2D("wr" + i, i, 1) * 9 * t;
      op *= 1 - Math.min(1, t / 26);
    } else op *= rest;
    const r0 = RR - 34;
    const r1 = RR + 34;
    return { i, a, quarter, ox, oy, op, rot, x0: RCX + Math.cos(a) * r0, y0: RCY + Math.sin(a) * r0, x1: RCX + Math.cos(a) * r1, y1: RCY + Math.sin(a) * r1 };
  });
  const sector = `M ${RCX} ${RCY} L ${RCX} ${RCY - RR + 34} A ${RR - 34} ${RR - 34} 0 0 1 ${RCX + RR - 34} ${RCY} Z`;
  return (
    <Night light={0.06}>
      <AbsoluteFill style={{ transform: `translate(${camX + sh.x}px, ${sh.y}px) rotate(${camR}deg) scale(${camS})` }}>
        <Drift seed="pr1" amp={8}>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <path d={sector} fill={WASTE} opacity={0.16 * hi * (1 - detach)} />
            {ticks.map((t) => {
              const col = t.quarter ? (hi > 0 ? WASTE : C.boardText) : C.boardText;
              const cx = (t.x0 + t.x1) / 2 + t.ox;
              const cy = (t.y0 + t.y1) / 2 + t.oy;
              return (
                <line
                  key={t.i}
                  x1={t.x0 + t.ox}
                  y1={t.y0 + t.oy}
                  x2={t.x1 + t.ox}
                  y2={t.y1 + t.oy}
                  stroke={col}
                  strokeOpacity={t.op * (t.quarter ? 0.55 + 0.45 * hi : 0.6)}
                  strokeWidth={t.quarter ? 7 : 6}
                  strokeLinecap="round"
                  transform={`rotate(${t.rot} ${cx} ${cy})`}
                />
              );
            })}
            <circle cx={RCX} cy={RCY} r={RR - 60} fill="none" stroke="rgba(244,246,242,.12)" strokeWidth={2} strokeDasharray={`${draw * 1600} 1600`} />
            <text x={RCX} y={RCY + 22} textAnchor="middle" fontFamily={F.figure} fontWeight={600} fontSize={74} fill="rgba(244,246,242,.8)" opacity={ramp(f, 14, 30) * rest}>
              $
            </text>
          </svg>
        </Drift>
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${sh.x * 0.5}px, ${sh.y * 0.5}px)` }}>
        <div style={{ position: "absolute", left: 170, top: 180, transform: `scale(${f < 45 ? 0 : 1.5 - 0.5 * slam})`, transformOrigin: "30% 60%", opacity: f < 45 ? 0 : 1 }}>
          <Fraction size={330} color={WASTE} />
        </div>
        <div style={{ position: "absolute", left: 176, top: 620 }}>
          <LineReveal lines={[f < 58 ? "" : "of US health spending"]} at={58} size={58} weight={700} color="rgba(244,246,242,.85)" />
        </div>
        <div style={{ position: "absolute", left: 176, top: 700 }}>
          <WordSlam text="is waste" at={90} size={120} color={WASTE} />
        </div>
      </AbsoluteFill>
      <Tag text="The price" at={0} out={40} />
      <Sfx at={0} name="count" volume={0.2} />
      <Sfx at={45} name="impact" volume={0.42} />
      <Sfx at={92} name="tick-b" volume={0.25} />
    </Night>
  );
}

// =================================================================================================
// PRICE-2 (105): 13 h / week to prior auth
// =================================================================================================

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const FILLED = [2, 9, 13, 16, 22, 27, 30, 33, 36, 38, 41, 5, 19];

function Price2(_: SceneProps) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fly = ramp(f, 0, 14);
  const ry = interpolate(f, [0, 105], [-34, -14]);
  const tx = interpolate(f, [0, 105], [140, 0]);
  const push = interpolate(f, [60, 105], [1, 1.07], { extrapolateLeft: "clamp" });
  const stamp = spring({ frame: f - 75, fps, config: { damping: 11, stiffness: 220 } });
  const sh = shake(f, 76, 12, 4);
  const numIn = spring({ frame: f - 30, fps, config: SP.snappy });
  return (
    <Night light={0.06}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px) scale(${push})` }}>
        <AbsoluteFill style={{ perspective: 2000 }}>
          <div
            style={{
              position: "absolute",
              left: 1010,
              top: 240,
              transform: `translateX(${tx + (1 - fly) * 600}px) translateZ(${(1 - fly) * -600}px) rotateY(${ry}deg) rotateX(8deg)`,
              opacity: fly,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 124px)", gap: 10 }}>
              {WEEK.map((d) => (
                <div key={d} style={{ fontFamily: F.display, fontWeight: 700, fontSize: 30, color: "rgba(244,246,242,.6)", textAlign: "center", paddingBottom: 6 }}>
                  {d}
                </div>
              ))}
              {Array.from({ length: 45 }, (_, i) => {
                const k = FILLED.indexOf(i);
                const t = k < 0 ? 0 : ramp(f, 12 + k * 3.4, 18 + k * 3.4);
                return (
                  <div
                    key={i}
                    style={{
                      height: 48,
                      borderRadius: 6,
                      background: k < 0 ? "rgba(244,246,242,.06)" : `rgba(224,138,30,${0.06 + 0.84 * t})`,
                      border: `1px solid ${k < 0 ? "rgba(244,246,242,.09)" : AMBER}`,
                      transform: `scale(${k < 0 ? 1 : 1 + 0.25 * (1 - t) * (t > 0 ? 1 : 0)})`,
                      backgroundImage: t > 0.5 ? "repeating-linear-gradient(135deg, rgba(24,34,58,.18) 0 6px, transparent 6px 12px)" : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 140, top: 290, opacity: f < 30 ? 0 : 1, transform: `scale(${1.3 - 0.3 * numIn})`, transformOrigin: "0% 50%" }}>
          <Odometer value={13} at={31} frames={14} size={330} color={AMBER} />
        </div>
        <div style={{ position: "absolute", left: 150, top: 640 }}>
          <LineReveal lines={[f < 44 ? "" : "hours / week"]} at={44} size={84} weight={700} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 1110,
            top: 470,
            opacity: f < 75 ? 0 : Math.min(1, stamp * 2),
            transform: `rotate(-9deg) scale(${f < 75 ? 2 : 2 - stamp})`,
            border: `8px solid ${AMBER}`,
            borderRadius: 14,
            padding: "14px 34px",
            fontFamily: F.display,
            fontWeight: 800,
            fontSize: 96,
            letterSpacing: "0.04em",
            color: AMBER,
            background: "rgba(24,34,58,.88)",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Prior auth
        </div>
      </AbsoluteFill>
      {FILLED.filter((_, k) => k % 2 === 0).map((_, j) => (
        <Sfx key={j} at={12 + j * 2 * 3.4} name={j % 2 ? "tick-b" : "tick-a"} volume={0.16} />
      ))}
      <Sfx at={30} name="count" volume={0.22} />
      <Sfx at={75} name="gate-hold" volume={0.38} />
    </Night>
  );
}

// =================================================================================================
// PRICE-3 (120): one abnormal result in fourteen never reaches the patient
// =================================================================================================

const LOST = 9;
const CW = 94;
const CH = 120;
const cardPos = (i: number) => ({ x: 690 + (i % 7) * (CW + 18), y: 370 + Math.floor(i / 7) * (CH + 22) });
const PX = 1650;
const PY = 500;

function Price3(_: SceneProps) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tilt = ramp(f, 62, 112, EZ.inOut);
  const camY = -tilt * 340;
  const slam = spring({ frame: f - 45, fps, config: SP.snappy });
  const sh = shake(f, 45, 12, 5);
  const fall = ramp(f, 60, 108, EZ.in);
  const lost = cardPos(LOST);
  const order = (i: number) => (i < LOST ? i : i - 1);
  const arrive = (i: number) => 26 + order(i) * 1.5 + 12;
  const lastArrive = arrive(13);
  const pulse = Array.from({ length: 14 }, (_, i) => i)
    .filter((i) => i !== LOST)
    .reduce((m, i) => Math.max(m, flash(f, arrive(i), 4)), 0);
  return (
    <Night light={0.05}>
      <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${camY + sh.y}px)` }}>
        <Drift seed="pr3" amp={7}>
          {/* the patient */}
          <svg width={240} height={240} viewBox="0 0 64 64" style={{ position: "absolute", left: PX - 120, top: PY - 120, opacity: 1 - 0.5 * tilt }}>
            <circle cx={32} cy={32} r={30} fill="none" stroke={C.boardText} strokeOpacity={0.25 + 0.6 * pulse} strokeWidth={1.5} />
            <circle cx={32} cy={32} r={30 + 3 * pulse} fill="none" stroke={C.boardText} strokeOpacity={0.3 * pulse} strokeWidth={1} />
            <circle cx={32} cy={25} r={9} fill={C.boardText} />
            <path d="M15 51c3-9 9-13 17-13s14 4 17 13" fill={C.boardText} />
          </svg>
          {Array.from({ length: 14 }, (_, i) => {
            const p = cardPos(i);
            const inn = ramp(f, i * 1.2, i * 1.2 + 10);
            const isLost = i === LOST;
            let x = p.x;
            let y = p.y - (1 - inn) * 120;
            let s = 1;
            let op = inn;
            let r = 0;
            if (!isLost) {
              const t = ramp(f, arrive(i) - 12, arrive(i), EZ.inOut);
              x = p.x + (PX - CW / 2 - p.x) * t;
              y = y + (PY - CH / 2 - p.y) * t - Math.sin(t * Math.PI) * 70;
              s = 1 - 0.75 * t;
              op = inn * (1 - ramp(f, arrive(i) - 3, arrive(i)));
            } else {
              y = y + fall * 760;
              x = x - fall * 60;
              r = fall * -28;
              op = inn * (1 - ramp(f, 100, 116));
            }
            const warn = isLost ? flick("lost", f, 0.5) * ramp(f, 34, 44) : 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: CW,
                  height: CH,
                  borderRadius: 8,
                  background: C.boardText,
                  opacity: op,
                  transform: `scale(${s}) rotate(${r}deg)`,
                  overflow: "hidden",
                  boxShadow: isLost ? `0 0 ${30 * warn}px ${8 * warn}px rgba(240,82,74,.45)` : "0 20px 30px -16px rgba(0,0,0,.7)",
                  border: isLost ? `3px solid ${RED}` : undefined,
                }}
              >
                <div style={{ height: 22, background: isLost ? RED : C.zone.blue, opacity: isLost ? 1 : 0.85 }} />
                {[0, 1, 2, 3].map((k) => (
                  <div key={k} style={{ margin: "10px 12px 0", height: 7, borderRadius: 4, width: `${70 - k * 12}%`, background: "rgba(24,34,58,.28)" }} />
                ))}
                {isLost && (
                  <div style={{ position: "absolute", right: 10, bottom: 8, fontFamily: F.display, fontWeight: 800, fontSize: 36, color: RED }}>!</div>
                )}
              </div>
            );
          })}
        </Drift>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at ${lost.x + 60}px ${lost.y + 500}px, rgba(5,10,20,0) 0%, rgba(5,10,20,.6) 70%)`, opacity: tilt }} />
      <div style={{ position: "absolute", left: 130, top: 330, opacity: f < 45 ? 0 : 1 - ramp(f, 100, 112, EZ.in), transform: `scale(${f < 45 ? 1.4 : 1.4 - 0.4 * slam})`, transformOrigin: "0% 50%" }}>
        <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 210, lineHeight: 1, color: C.boardText, whiteSpace: "nowrap" }}>
          <span style={{ color: RED }}>1</span> in 14
        </div>
      </div>
      <div style={{ position: "absolute", left: 140, top: 560, opacity: 1 - ramp(f, 100, 112, EZ.in) }}>
        <LineReveal lines={[f < 52 ? "" : "abnormal results"]} at={52} size={60} weight={700} color="rgba(244,246,242,.8)" />
      </div>
      <Sfx at={20} name="whoosh" volume={0.25} />
      <Sfx at={Math.round(lastArrive)} name="tick-a" volume={0.2} />
      <Sfx at={45} name="impact" volume={0.4} />
      <Sfx at={62} name="whoosh" volume={0.2} />
    </Night>
  );
}

// =================================================================================================
// HIT-1 (60): no voice. Push into one dark gap of the broken chain.
// =================================================================================================

function Hit1(_: SceneProps) {
  const f = useCurrentFrame();
  const spread = p3spread(135 + f);
  const o = chain7(f, spread, interpolate(f, [0, 30, 46], [1.3, 1.6, 0], { extrapolateRight: "clamp" }));
  const g = gapPoints(o, 3);
  const gx = (g.a.x + g.b.x) / 2;
  const gy = (g.a.y + g.b.y) / 2;
  const s = Math.exp(interpolate(f, [0, 50], [Math.log(1.2), Math.log(46)], { extrapolateRight: "clamp", easing: EZ.in }));
  const dim = 1 - ramp(f, 20, 46, EZ.in);
  const dot = ramp(f, 46, 56);
  const breathe = 0.75 + 0.25 * Math.sin((f - 46) * 0.5);
  const glowR = 120 + 900 * ramp(f, 14, 48, EZ.in);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ transformOrigin: `${gx}px ${gy}px`, transform: `translate(${960 - gx}px, ${540 - gy}px) scale(${s})`, opacity: dim }}>
        <Chain {...o} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(240,82,74,${0.22 * dim}) 0px, rgba(240,82,74,0) ${glowR}px)` }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(5,10,20,0) 30%, rgba(5,10,20,.7) 100%)" }} />
      <div
        style={{
          position: "absolute",
          left: 960 - 7,
          top: 540 - 7,
          width: 14,
          height: 14,
          borderRadius: 7,
          background: "#e9fffb",
          opacity: dot * breathe,
          boxShadow: `0 0 22px 8px ${C.glow}, 0 0 70px 26px rgba(45,212,191,.35)`,
        }}
      />
      <Sfx at={26} name="whoosh" volume={0.35} />
    </AbsoluteFill>
  );
}


export const scenes: Group = {
  "COLD-OPEN": { C: ColdOpen, dark: true },
  "PROBLEM-1": { C: Problem1, dark: true },
  "PROBLEM-2": { C: Problem2, dark: true },
  "PROBLEM-3": { C: Problem3, dark: true },
  "PRICE-1": { C: Price1, dark: true },
  "PRICE-2": { C: Price2, dark: true },
  "PRICE-3": { C: Price3, dark: true },
  "HIT-1": { C: Hit1, dark: true },
};
export const fallback = Placeholder;
