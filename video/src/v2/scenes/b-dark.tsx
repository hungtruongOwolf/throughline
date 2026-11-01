import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CometThread, Day, Drift, DropHit, EZ, LineReveal, Night, Odometer, WordSlam } from "../fx";
import { Sfx } from "../../components/frames";
import { C, F } from "../../theme";
import type { SceneProps } from "../types";
import { cl, lerp, Leak } from "./b-kit";

const FAX = "assets/maria-referral-fax.png";
const FAX_W = 1207;
const FAX_H = 1559;

/* ------------------------------------------------------------------ MARIA-1 */
/** "Meet Maria. Seventy-one. Her doctor spotted something on a scan." Dark build, riser. */
export function Maria1({ dur }: SceneProps) {
  const f = useCurrentFrame();
  return (
    <Night light={0.06}>
      {f < 30 && <MariaName />}
      {f >= 30 && f < 75 && <MariaAge />}
      {f >= 75 && <Scan dur={dur} />}
      <Sfx at={0} name="tick-a" volume={0.25} />
      <Sfx at={45} name="tick-b" volume={0.3} />
      <Sfx at={75} name="shutter" volume={0.25} />
      <Sfx at={120} name="ping" volume={0.28} />
    </Night>
  );
}

function MariaName() {
  const f = useCurrentFrame();
  const ring = lerp(f, 0, 16, 0, 1, EZ.out);
  const push = lerp(f, 0, 30, 1, 1.06, EZ.out);
  const ini = lerp(f, 6, 14, 0, 1, EZ.out);
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Drift seed="m1a" amp={8}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <circle cx={560} cy={540} r={150} fill="rgba(244,246,242,.06)" stroke={C.boardText} strokeWidth={5} strokeDasharray={2 * Math.PI * 150} strokeDashoffset={2 * Math.PI * 150 * (1 - ring)} transform="rotate(-90 560 540)" />
        </svg>
        <div style={{ position: "absolute", left: 410, top: 390, width: 300, height: 300, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.display, fontWeight: 700, fontSize: 120, color: C.boardText, opacity: ini }}>MD</div>
        <div style={{ position: "absolute", left: 790, top: 430 }}>
          <LineReveal lines={["Maria Diaz"]} at={3} size={190} />
        </div>
      </Drift>
    </AbsoluteFill>
  );
}

function MariaAge() {
  const f = useCurrentFrame();
  const ring = lerp(f, 30, 44, 0.3, 1, EZ.out);
  const push = lerp(f, 30, 75, 1, 1.08, EZ.inOut);
  const yrs = lerp(f, 46, 56, 0, 1, EZ.out);
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Drift seed="m1b" amp={8}>
        {/* match cut: Maria's avatar ring grows into the ring around her age */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <circle cx={960} cy={540} r={150 + 230 * ring} fill="none" stroke={C.boardText} strokeOpacity={0.35} strokeWidth={3} />
          <circle cx={960} cy={540} r={150 + 260 * ring} fill="none" stroke={C.boardText} strokeOpacity={0.12} strokeWidth={2} />
        </svg>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <Odometer value={71} at={30} frames={15} size={380} />
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 40, color: C.boardText, opacity: 0.75 * yrs, letterSpacing: "0.3em", marginTop: 10, transform: `translateY(${(1 - yrs) * 20}px)` }}>YEARS</div>
        </AbsoluteFill>
      </Drift>
    </AbsoluteFill>
  );
}

// a deterministic speckle for the scan
const SPECK = Array.from({ length: 140 }, (_, i) => {
  const a = (i * 137.508 * Math.PI) / 180;
  const r = 30 + ((i * 53) % 330);
  return { x: 960 + Math.cos(a) * r, y: 540 + Math.sin(a) * r * 0.72, o: 0.05 + ((i * 7) % 10) / 70 };
});
const SPOT = { x: 1094, y: 470 };

function Scan({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const sweep = lerp(f, 78, 112, 0, 1, EZ.inOut);
  const sy = 140 + sweep * 800;
  const mark = lerp(f, 116, 128, 0, 1, EZ.out);
  const cross = lerp(f, 124, 136, 0, 1, EZ.out);
  // camera: slow push, then punch in on the spot, then zoom through it
  const s = Math.exp(interpolate(f, [75, 112, 150, dur], [0, Math.log(1.12), Math.log(2.8), Math.log(7)], { ...cl, easing: EZ.inOut }));
  const toSpot = lerp(f, 112, 150, 0, 1);
  const ox = 960 + (SPOT.x - 960) * toSpot;
  const oy = 540 + (SPOT.y - 540) * toSpot;
  const out = lerp(f, 152, dur, 0, 1, EZ.in);
  const rot = (f - 75) * 0.15;
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <Drift seed="m1c" amp={6}>
        <div style={{ position: "absolute", inset: 0, transformOrigin: `${ox}px ${oy}px`, transform: `translate(${960 - ox}px, ${540 - oy}px) scale(${s})` }}>
          <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
            <defs>
              <clipPath id="b-gantry">
                <circle cx={960} cy={540} r={392} />
              </clipPath>
              <radialGradient id="b-lung" cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#0b1120" />
                <stop offset="100%" stopColor="#1d2943" />
              </radialGradient>
            </defs>
            {/* gantry rings */}
            <circle cx={960} cy={540} r={410} fill="none" stroke={C.boardText} strokeOpacity={0.3} strokeWidth={3} />
            <circle cx={960} cy={540} r={440} fill="none" stroke={C.boardText} strokeOpacity={0.12} strokeWidth={14} strokeDasharray="4 18" transform={`rotate(${rot} 960 540)`} />
            <g clipPath="url(#b-gantry)">
              <rect x={540} y={120} width={840} height={840} fill="#101828" />
              {/* torso cross-section */}
              <ellipse cx={960} cy={560} rx={330} ry={235} fill="#2a3550" stroke={C.boardText} strokeOpacity={0.35} strokeWidth={3} />
              <ellipse cx={960} cy={560} rx={300} ry={208} fill="#202b44" />
              <ellipse cx={830} cy={535} rx={118} ry={160} fill="url(#b-lung)" />
              <ellipse cx={1090} cy={535} rx={118} ry={160} fill="url(#b-lung)" />
              <ellipse cx={945} cy={600} rx={70} ry={58} fill="#3a4766" />
              <circle cx={960} cy={735} r={34} fill="#cfd5dd" fillOpacity={0.7} />
              {SPECK.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={1.6} fill="#fff" fillOpacity={p.o} />
              ))}
              <circle cx={SPOT.x} cy={SPOT.y} r={13} fill="#c9cfd8" fillOpacity={0.55 + 0.3 * sweep} />
              {/* the scan bar */}
              {sweep > 0 && sweep < 1 && (
                <>
                  <rect x={540} y={sy - 60} width={840} height={60} fill="url(#b-bar)" opacity={0.5} />
                  <rect x={540} y={sy - 2} width={840} height={4} fill="#e8edf3" />
                </>
              )}
              <defs>
                <linearGradient id="b-bar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8edf3" stopOpacity={0} />
                  <stop offset="100%" stopColor="#e8edf3" stopOpacity={0.6} />
                </linearGradient>
              </defs>
            </g>
            {/* the doctor's mark */}
            <circle cx={SPOT.x} cy={SPOT.y} r={34} fill="none" stroke={C.waitMid} strokeWidth={4} strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - mark)} transform={`rotate(-90 ${SPOT.x} ${SPOT.y})`} />
            <g stroke={C.waitMid} strokeWidth={3} opacity={cross}>
              <line x1={SPOT.x - 44 - 50 * cross} y1={SPOT.y} x2={SPOT.x - 44} y2={SPOT.y} />
              <line x1={SPOT.x + 44} y1={SPOT.y} x2={SPOT.x + 44 + 50 * cross} y2={SPOT.y} />
              <line x1={SPOT.x} y1={SPOT.y - 44 - 50 * cross} x2={SPOT.x} y2={SPOT.y - 44} />
              <line x1={SPOT.x} y1={SPOT.y + 44} x2={SPOT.x} y2={SPOT.y + 44 + 50 * cross} />
            </g>
          </svg>
        </div>
      </Drift>
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ MARIA-2 */
/** "So Dr. Whitcombe faxes a referral to Halden Medical Center. Yes, a fax." */
export function Maria2({ dur }: SceneProps) {
  const f = useCurrentFrame();
  return (
    <Night light={0.07}>
      {f < 45 && <Doctor />}
      {f >= 45 && f < 105 && <FaxFeed />}
      {f >= 105 && f < 135 && <Route />}
      {f >= 135 && <FaxHeader dur={dur} />}
      <Sfx at={0} name="tick-a" volume={0.22} />
      <Sfx at={45} name="fax" volume={0.4} />
      <Sfx at={96} name="whoosh" volume={0.3} />
      <Sfx at={135} name="shutter" volume={0.3} />
    </Night>
  );
}

function Doctor() {
  const f = useCurrentFrame();
  const sub = lerp(f, 12, 24, 0, 1, EZ.out);
  const bar = lerp(f, 0, 14, 0, 1, EZ.out);
  const sign = lerp(f, 24, 36, 0, 1, EZ.out);
  const push = lerp(f, 0, 45, 1.04, 1, EZ.out);
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Drift seed="m2a" amp={8}>
        <div style={{ position: "absolute", left: 250, top: 330, width: 10, height: 330 * bar, background: C.boardText, opacity: 0.85 }} />
        <div style={{ position: "absolute", left: 300, top: 320 }}>
          <LineReveal lines={["Dr. Hannah Whitcombe"]} at={2} size={150} />
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 40, color: C.boardText, opacity: 0.7 * sub, marginTop: 18, transform: `translateY(${(1 - sub) * 16}px)` }}>Northgate Family Medicine</div>
        </div>
        {/* her outgoing fax line, a plain plate like a door sign */}
        <div
          style={{
            position: "absolute",
            left: 300,
            top: 620,
            opacity: sign,
            transform: `translateX(${(1 - sign) * -40}px)`,
            display: "flex",
            alignItems: "center",
            gap: 18,
            border: `2px solid rgba(244,246,242,.35)`,
            borderRadius: 8,
            padding: "14px 24px",
            fontFamily: F.figure,
            fontWeight: 600,
            fontSize: 34,
            color: C.boardText,
          }}
        >
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="5" y="3" width="14" height="7" />
            <rect x="3" y="10" width="18" height="9" rx="1" />
            <path d="M7 19v2h10v-2" />
          </svg>
          Fax (555) 010-0172
        </div>
      </Drift>
    </AbsoluteFill>
  );
}

function FaxFeed() {
  const f = useCurrentFrame();
  const s = 820 / FAX_W;
  const h = FAX_H * s;
  // the page comes up out of the slot in short mechanical steps
  const raw = lerp(f, 45, 102, 0, 1, (t) => t);
  const steps = Math.floor(raw * 28) / 28;
  const feed = 780 * (steps + (raw - steps) * 0.3);
  const slotY = 930;
  const top = slotY - feed;
  const lineY = top + 255 * s;
  const push = Math.exp(lerp(f, 72, 105, 0, Math.log(1.35)));
  return (
    <AbsoluteFill style={{ transformOrigin: `960px ${lineY}px`, transform: `scale(${push})` }}>
      <Drift seed="m2b" amp={6}>
        <AbsoluteFill style={{ perspective: 1800 }}>
          <AbsoluteFill style={{ transform: "rotateX(14deg)", transformOrigin: "50% 90%" }}>
            <div style={{ position: "absolute", left: 960 - 410, top: 0, width: 820, height: slotY, overflow: "hidden" }}>
              <Img src={staticFile(FAX)} style={{ position: "absolute", left: 0, top, width: 820, height: h, boxShadow: "0 0 80px rgba(0,0,0,.6)" }} />
              {/* falloff light: brighter near the slot */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(24,34,58,.85), rgba(24,34,58,.15) 70%, rgba(24,34,58,0))" }} />
            </div>
            {/* the slot */}
            <div style={{ position: "absolute", left: 960 - 470, top: slotY - 6, width: 940, height: 34, borderRadius: 6, background: "#0b1222", boxShadow: "0 -2px 0 rgba(255,255,255,.12), 0 30px 60px rgba(0,0,0,.6)" }} />
            <div style={{ position: "absolute", left: 960 - 520, top: slotY + 28, width: 1040, height: 200, background: "linear-gradient(#141d31, #18223a)" }} />
          </AbsoluteFill>
        </AbsoluteFill>
      </Drift>
    </AbsoluteFill>
  );
}

function Plate({ label, sub, x, inAt, from }: { label: string; sub: string; x: number; inAt: number; from: number }) {
  const f = useCurrentFrame();
  const p = lerp(f, inAt, inAt + 9, 0, 1, EZ.out);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 450,
        width: 660,
        transform: `translateX(${(1 - p) * from}px)`,
        opacity: p,
        background: C.boardText,
        color: C.ink,
        borderRadius: 8,
        padding: "22px 30px",
        boxShadow: "0 30px 60px -30px rgba(0,0,0,.7)",
      }}
    >
      <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 22, letterSpacing: "0.16em", color: C.inkSoft }}>{sub}</div>
      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 54, lineHeight: 1.05, marginTop: 6, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

function Route() {
  const f = useCurrentFrame();
  const p = lerp(f, 110, 130, 0, 1, EZ.inOut);
  const x = 780 + p * 360;
  const y = 520 - Math.sin(p * Math.PI) * 70;
  return (
    <AbsoluteFill style={{ transform: `scale(${lerp(f, 105, 135, 1.08, 1, EZ.out)})` }}>
      <Drift seed="m2c" amp={6}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <path d="M 780 540 Q 960 400 1140 540" fill="none" stroke={C.boardText} strokeOpacity={0.4} strokeWidth={3} strokeDasharray="10 12" />
        </svg>
        <Plate label="Northgate Family Medicine" sub="FROM" x={110} inAt={105} from={-120} />
        <Plate label="Halden Medical Center" sub="TO" x={1150} inAt={108} from={120} />
        {/* the paper itself travelling */}
        <div style={{ position: "absolute", left: x - 22, top: y - 50, width: 44, height: 58, background: "#fff", borderRadius: 2, transform: `rotate(${-8 + p * 16}deg)`, boxShadow: "0 10px 20px rgba(0,0,0,.5)", padding: 6 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 3, background: "#9aa3b0", marginBottom: 6, width: `${90 - i * 12}%` }} />
          ))}
        </div>
      </Drift>
    </AbsoluteFill>
  );
}

function FaxHeader({ dur }: { dur: number }) {
  const f = useCurrentFrame();
  const s = 3.1;
  const pan = lerp(f, 135, dur, 0, 520, (t) => t);
  const push = lerp(f, 135, dur, 1, 1.08, EZ.out);
  return (
    <AbsoluteFill style={{ background: "#fff", transform: `scale(${push})` }}>
      <Img src={staticFile(FAX)} style={{ position: "absolute", width: FAX_W * s, left: 120 - 40 * s - pan, top: 470 - 46 * s, maxWidth: "none" }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 45% 45%, rgba(24,34,58,0) 30%, rgba(24,34,58,.75) 100%)" }} />
    </AbsoluteFill>
  );
}

/* --------------------------------------------------------------------- DROP */
const SMUDGE = { x: 525, y: 591 };

/** "That fax is where Throughline grabs the thread." Tension; a single teal point in the dark. */
export function Drop({ dur }: SceneProps) {
  const f = useCurrentFrame();
  const s = Math.exp(interpolate(f, [0, 75], [Math.log(0.75), Math.log(1.6)], { ...cl, easing: EZ.inOut }));
  const dx = lerp(f, 0, 60, -120, 0, EZ.inOut);
  const dy = lerp(f, 0, 60, 60, 0, EZ.inOut);
  const dark = interpolate(f, [0, 30, 45, 72], [0.45, 0.55, 0.75, 1], cl);
  const pt = lerp(f, 45, 52, 0, 1, EZ.out);
  const breathe = f >= 75 ? 1 - 0.3 * lerp(f, 75, dur - 1, 0, 1, EZ.inOut) : 1;
  const pulse = f >= 60 ? Math.max(0, 1 - (f - 60) / 14) : 0;
  const tail = lerp(f, 52, 72, 0, 1, EZ.out);
  const tailOut = lerp(f, 72, 80, 1, 0, EZ.in);
  return (
    <AbsoluteFill style={{ background: "#0d1322" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: FAX_W,
          height: FAX_H,
          transformOrigin: "0 0",
          transform: `translate(${960 + dx - SMUDGE.x * s}px, ${540 + dy - SMUDGE.y * s}px) scale(${s}) rotate(${lerp(f, 0, 75, -3, 0)}deg)`,
        }}
      >
        <Img src={staticFile(FAX)} style={{ width: FAX_W, height: FAX_H }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${SMUDGE.x}px ${SMUDGE.y}px, rgba(13,19,34,${dark * 0.6}) 0px, rgba(13,19,34,${Math.min(1, dark + 0.25)}) 520px)` }} />
        <div style={{ position: "absolute", inset: 0, background: "#0d1322", opacity: interpolate(f, [55, 76], [0, 1], cl) }} />
      </div>
      {/* the point appears where the thread will start */}
      {f >= 45 && (
        <>
          {tail > 0 && tailOut > 0 && (
            <div style={{ position: "absolute", inset: 0, opacity: tailOut }}>
              <CometThread d={`M ${960 + dx} ${540 + dy} C ${1010 + dx} ${520 + dy}, ${1060 + dx} ${575 + dy}, ${1120 + dx} ${548 + dy}`} progress={tail * 0.9} width={3} head={false} />
            </div>
          )}
          <div
            style={{
              position: "absolute",
              left: 960 + dx - 70,
              top: 540 + dy - 70,
              width: 140,
              height: 140,
              borderRadius: 70,
              border: `2px solid ${C.glow}`,
              opacity: pulse,
              transform: `scale(${0.3 + (1 - pulse) * 1.2})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 960 + dx - 9,
              top: 540 + dy - 9,
              width: 18,
              height: 18,
              borderRadius: 9,
              background: "#e9fffb",
              transform: `scale(${pt * breathe * (1 + 0.15 * Math.sin(f / 3))})`,
              boxShadow: `0 0 ${20 + 14 * pt}px ${6 * pt}px ${C.glow}, 0 0 80px 24px rgba(45,212,191,.35)`,
            }}
          />
        </>
      )}
      <Sfx at={45} name="ping" volume={0.32} />
    </AbsoluteFill>
  );
}

/* -------------------------------------------------------------------- TITLE */
const BURST = Array.from({ length: 11 }, (_, i) => {
  const a = (i / 11) * Math.PI * 2 + 0.3;
  const r = 1500;
  const ex = 960 + Math.cos(a) * r;
  const ey = 540 + Math.sin(a) * r * 0.75;
  const bend = (i % 2 ? 1 : -1) * 0.35;
  const c1x = 960 + Math.cos(a + bend) * 380;
  const c1y = 540 + Math.sin(a + bend) * 300;
  const c2x = 960 + Math.cos(a - bend * 0.6) * 900;
  const c2y = 540 + Math.sin(a - bend * 0.6) * 650;
  return { d: `M 960 540 C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`, lag: i % 3 };
});

/** Drop 1: the product reveal. The thread explodes across the frame and the wordmark slams. */
export function Title(_: SceneProps) {
  const f = useCurrentFrame();
  const slam = lerp(f, 0, 9, 0, 1, EZ.out);
  const exit = lerp(f, 84, 96, 0, 1, EZ.in);
  const fade = interpolate(f, [30, 60, 84, 98], [1, 0.3, 0.3, 0], cl);
  const line = lerp(f, 84, 100, 0, 1, EZ.inOut);
  const open = lerp(f, 100, 116, 0, 1, EZ.inOut);
  const drift = lerp(f, 10, 84, 1, 1.045, (t) => t);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <DropHit at={0}>
        <Night light={0.16}>
          <AbsoluteFill style={{ opacity: fade }}>
            {BURST.map((b, i) => (
              <CometThread key={i} d={b.d} progress={lerp(f, b.lag, 16 + b.lag * 2, 0, 1, EZ.out)} width={4} head={f < 20} />
            ))}
          </AbsoluteFill>
          <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${drift * (1.35 - 0.35 * slam)}) translateY(${-60 * exit}px)`, opacity: 1 - exit }}>
            <div style={{ display: "flex", alignItems: "center", gap: 40, letterSpacing: `${0.14 - 0.15 * slam}em` }}>
              <span style={{ width: 120 * slam, height: 26, background: C.glow, display: "block", boxShadow: `0 0 30px ${C.glow}` }} />
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 250, lineHeight: 1, color: C.boardText, textShadow: "0 0 60px rgba(45,212,191,.25)" }}>Throughline</span>
            </div>
            <div style={{ marginTop: 34, opacity: 1 - exit }}>
              <WordSlam text="One patient. One thread." at={45} stagger={4} size={58} color="rgba(244,246,242,.8)" accent={["thread"]} style={{ justifyContent: "center", fontWeight: 700 }} />
            </div>
          </AbsoluteFill>
          <Leak at={0} dur={42} />
          <Leak at={56} dur={36} hue="45,212,191" warm="120,220,255" />
        </Night>
      </DropHit>
      {/* the paper world opens out of the thread */}
      {open > 0 && (
        <AbsoluteFill style={{ clipPath: `inset(${540 - 545 * open}px 0 ${540 - 545 * open}px 0)` }}>
          <Day>{null}</Day>
        </AbsoluteFill>
      )}
      {line > 0 && (
        <AbsoluteFill>
          <CometThread d="M -40 540 L 1960 540" progress={line} width={6} color={open > 0.5 ? C.agent : C.glow} />
        </AbsoluteFill>
      )}
      <Sfx at={0} name="impact" volume={0.35} />
      <Sfx at={45} name="tick-a" volume={0.2} />
      <Sfx at={78} name="whoosh" volume={0.3} />
      <Sfx at={100} name="shutter" volume={0.2} />
    </AbsoluteFill>
  );
}
