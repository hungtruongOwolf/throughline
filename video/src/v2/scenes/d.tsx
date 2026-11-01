import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { getLength, getPointAtLength } from "@remotion/paths";
import { C, F } from "../../theme";
import { Sfx } from "../../components/frames";
import { GateTag } from "../../components/kit";
import { Camera, CometThread, Day, Drift, DropHit, EZ, LineReveal, Night, Odometer, SP, Shot, TiltScreen, useDrift, useSpring, useT } from "../fx";
import type { Group, SceneProps } from "../types";
import { card, cl, ImgCam, lerp, Rings, Seg, Tile, usePop } from "./d-kit";

/* ------------------------------------------------------------------ */
/* Shared data                                                         */
/* ------------------------------------------------------------------ */

type Kind = "model" | "rules" | "rust";
const AGENTS: { code: string; name: string; kind: Kind }[] = [
  { code: "IN", name: "Intake", kind: "model" },
  { code: "CV", name: "Coverage", kind: "rules" },
  { code: "PA", name: "Prior auth", kind: "model" },
  { code: "SC", name: "Scheduling", kind: "rust" },
  { code: "VP", name: "Visit prep", kind: "rules" },
  { code: "PM", name: "Messaging", kind: "model" },
  { code: "WS", name: "Waiting-room sensing", kind: "model" },
  { code: "IT", name: "Itinerary", kind: "rust" },
  { code: "CO", name: "Companion", kind: "model" },
  { code: "OP", name: "Ops planner", kind: "model" },
  { code: "RW", name: "Results watch", kind: "rules" },
  { code: "DS", name: "Discharge", kind: "model" },
  { code: "FU", name: "Follow-up", kind: "rust" },
];
const STEP = 136;
/** the identity framing for fx Camera (its FULL is off-center) */
const WIDE_R = { x: 222, y: 125, w: 1477, h: 831 };
const X0 = 960 - 6 * STEP;
const ax = (code: string) => X0 + AGENTS.findIndex((a) => a.code === code) * STEP;

/* ------------------------------------------------------------------ */
/* DROP2: the release after the human-gate breakdown                   */
/* ------------------------------------------------------------------ */

const LIFT = ["RW", "DS", "FU"];
const LIFT_NAME: Record<string, string> = { RW: "Results watch", DS: "Discharge", FU: "Follow-up" };

function DropTile({ i, lift, zoom }: { i: number; lift: number; zoom: number }) {
  const a = AGENTS[i]!;
  const on = usePop(Math.abs(i - 6) * 1.5);
  const k = LIFT.indexOf(a.code);
  const fromX = X0 + i * STEP;
  const fromY = 700;
  const x = k < 0 ? fromX : lerp(fromX, 960 + (k - 1) * 300, lift);
  const y = k < 0 ? fromY : lerp(fromY, 540, lift);
  const sc = k < 0 ? 1 : 1 + 1.1 * lift;
  const op = k < 0 ? 1 - lift : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${sc * (0.7 + 0.3 * Math.min(1, on))})`, opacity: op }}>
      <Tile code={a.code} on={on} size={84} dark textOp={a.code === "DS" ? 1 - Math.min(1, zoom * 3) : 1} />
      {k >= 0 && (
        <div
          style={{
            position: "absolute",
            top: 98,
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 14,
            color: C.boardText,
            opacity: interpolate(lift, [0.6, 1], [0, 1], cl) * (1 - Math.min(1, zoom * 4)),
          }}
        >
          {LIFT_NAME[a.code]}
        </div>
      )}
    </div>
  );
}

function Drop2(_: SceneProps) {
  const f = useCurrentFrame();
  const thread = useT(0, 16, EZ.out);
  const lift = useT(30, 46, EZ.out);
  const zoom = interpolate(f, [46, 58], [0, 1], { ...cl, easing: EZ.in });
  const S = Math.exp(Math.log(20) * zoom);
  return (
    <Night light={0.22}>
      <DropHit at={0}>
        <Drift seed="drop2" amp={8}>
          <AbsoluteFill style={{ transform: `scale(${S})`, transformOrigin: "960px 540px" }}>
            <AbsoluteFill style={{ opacity: 1 - lift }}>
              <CometThread d="M -60 700 L 1980 700" progress={thread} width={5} />
            </AbsoluteFill>
            <div style={{ position: "absolute", left: 0, right: 0, top: 230 }}>
              <LineReveal lines={["After the visit"]} at={6} exitAt={30} size={200} align="center" />
            </div>
            {AGENTS.map((_, i) => (
              <DropTile key={i} i={i} lift={lift} zoom={zoom} />
            ))}
          </AbsoluteFill>
        </Drift>
      </DropHit>
      <Sfx at={30} name="tick-a" volume={0.3} />
      <Sfx at={51} name="whoosh" volume={0.35} />
    </Night>
  );
}

/* ------------------------------------------------------------------ */
/* AFTER-1: Discharge, the doctor's note in plain words, signed        */
/* ------------------------------------------------------------------ */

const JARGON = [
  "Pt tolerated CT abd/pelvis w/ IV contrast, no complications.",
  "Resume home meds. Encourage PO fluids.",
  "Final read pending; RW to track and notify.",
  "F/u w/ PCP for results review.",
  "RTC / ED prn fever, worsening abd pain, N/V.",
];
const PLAIN = ["Your scan went smoothly.", "Take your usual medicines. Drink water.", "We'll watch for your results.", "See Dr. Whitcombe to go over them.", "Fever or worse pain? Call us."];
const LINE_Y = (i: number) => 330 + i * 100;
const LINE_AT = (i: number) => 38 + i * 12;

function NoteLine({ i }: { i: number }) {
  const at = LINE_AT(i);
  const hl = useT(at - 8, at, EZ.out);
  const q = useT(at + 3, at + 13, EZ.out);
  const jIn = useT(at - 1, at + 3);
  const link = useT(at - 4, at + 6, EZ.out);
  const linkOut = useT(at + 16, at + 26);
  const y = LINE_Y(i);
  return (
    <>
      <div style={{ position: "absolute", left: 200, top: y, width: 650, fontFamily: F.text, fontSize: 27, lineHeight: 1.35, color: C.inkSoft }}>
        <div style={{ position: "absolute", left: -10, top: -6, bottom: -6, width: `${hl * 104}%`, background: C.agentTint, borderRadius: 8, opacity: 1 - 0.6 * linkOut }} />
        <span style={{ position: "relative" }}>{JARGON[i]}</span>
      </div>
      <AbsoluteFill style={{ opacity: 1 - linkOut }}>
        <CometThread d={`M 875 ${y + 20} C 950 ${y + 20}, 980 ${y + 24}, 1050 ${y + 24}`} progress={link} width={4} color={C.agent} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 1080, top: y - 4, width: 660, height: 90 }}>
        <div style={{ position: "absolute", inset: 0, fontFamily: F.text, fontSize: 24, color: C.inkSoft, opacity: jIn * (1 - q), filter: `blur(${q * 6}px)` }}>{JARGON[i]}</div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 36,
            lineHeight: 1.2,
            color: C.ink,
            opacity: q,
            filter: `blur(${(1 - q) * 6}px)`,
            transform: `translateY(${(1 - q) * 12}px)`,
          }}
        >
          {PLAIN[i]}
        </div>
      </div>
    </>
  );
}

function After1(_: SceneProps) {
  const f = useCurrentFrame();
  const m = useT(0, 14, EZ.out);
  const label = useT(22, 32, EZ.out);
  const home = useT(8, 18, EZ.out);
  const cardsIn = useSpring(0, SP.calm);
  const gate = usePop(118);
  const signed = useT(136, 146, EZ.out);
  const stamp = usePop(146);
  const hdr = 1 - useT(108, 118);
  const BOTH = { x: 110, y: 170, w: 1700, h: 800 };
  const signR = { x: 1040, y: 730, w: 760, h: 230 };
  return (
    <Day>
      <Drift seed="after1" amp={10}>
        <Camera
          keys={[
            { at: 0, rect: { x: 130, y: 200, w: 800, h: 460 } },
            { at: 30, rect: { x: 140, y: 210, w: 780, h: 450 } },
            { at: 56, rect: BOTH },
            { at: 110, rect: { ...BOTH, x: 130, w: 1660 } },
            { at: 128, rect: signR },
            { at: 165, rect: { ...signR, x: 1060, w: 680 } },
          ]}
        >
          <div style={{ ...card, left: 150, top: 220, width: 740, height: 720, opacity: cardsIn, transform: `translateY(${(1 - cardsIn) * 40}px)` }}>
            <div style={{ position: "absolute", left: 50, top: 36, fontFamily: F.text, fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkSoft }}>
              Discharge note · Dr. Okafor
            </div>
          </div>
          <div style={{ ...card, left: 1030, top: 220, width: 740, height: 720, borderLeft: `10px solid ${C.agent}`, opacity: cardsIn }}>
            <div style={{ position: "absolute", left: 50, top: 36, fontFamily: F.text, fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: C.agent }}>
              In plain words
            </div>
          </div>
          {JARGON.map((_, i) => (
            <NoteLine key={i} i={i} />
          ))}
          <div style={{ position: "absolute", left: 1080, top: 838, transform: `scale(${0.6 + 0.4 * gate})`, transformOrigin: "0 50%", opacity: Math.min(1, gate * 2) }}>
            <GateTag who="Dr. Okafor" role="signs off" check={signed} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 1500,
              top: 826,
              padding: "6px 22px",
              border: `5px solid ${C.agent}`,
              borderRadius: 10,
              fontFamily: F.display,
              fontWeight: 800,
              fontSize: 52,
              letterSpacing: "0.08em",
              color: C.agent,
              opacity: Math.min(1, stamp * 1.5),
              transform: `rotate(-8deg) scale(${2.2 - 1.2 * Math.min(1.2, stamp)})`,
            }}
          >
            SIGNED
          </div>
        </Camera>
      </Drift>
      {/* fixed header: Discharge badge, landed by the match cut from the drop */}
      <div style={{ position: "absolute", left: 928, top: 64, opacity: hdr }}>
        <Tile code="DS" size={64} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 1010,
          top: 66,
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          borderRadius: 12,
          background: C.panel,
          boxShadow: "0 12px 30px -18px rgba(24,34,58,.5)",
          fontFamily: F.display,
          fontWeight: 800,
          fontSize: 40,
          color: C.ink,
          clipPath: `inset(0 ${(1 - label) * 100}% 0 0)`,
          opacity: hdr,
        }}
      >
        Discharge
      </div>
      <div
        style={{
          position: "absolute",
          right: 1920 - 905,
          top: 74,
          height: 44,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 18px",
          borderRadius: 999,
          background: C.ink,
          color: C.boardText,
          fontFamily: F.text,
          fontWeight: 700,
          fontSize: 22,
          opacity: home * hdr,
          transform: `translateX(${(1 - home) * 30}px)`,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.glow} strokeWidth="2.4" strokeLinejoin="round">
          <path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z" />
        </svg>
        Maria · home
      </div>
      {/* match cut: the teal of the zoomed badge shrinks back into the header badge */}
      {m < 1 && (
        <div
          style={{
            position: "absolute",
            left: lerp(0, 928, m),
            top: lerp(0, 64, m),
            width: lerp(1920, 64, m),
            height: lerp(1080, 64, m),
            borderRadius: lerp(0, 14, m),
            background: C.agent,
          }}
        />
      )}
      {JARGON.map((_, i) => (
        <Sfx key={i} at={LINE_AT(i) + 3} name="tick-b" volume={0.2} />
      ))}
      <Sfx at={118} name="gate-hold" volume={0.3} />
      <Sfx at={138} name="gate-ok" volume={0.4} />
      <div style={{ display: f < 0 ? "block" : "none" }} />
    </Day>
  );
}

/* ------------------------------------------------------------------ */
/* AFTER-2: next-day check-in, unsure, handed to a nurse               */
/* ------------------------------------------------------------------ */

function Bubble({ at, side, children, tone }: { at: number; side: "l" | "r"; children: ReactNode; tone?: "held" }) {
  const p = usePop(at);
  return (
    <div
      style={{
        position: "absolute",
        [side === "l" ? "left" : "right"]: 0,
        maxWidth: 560,
        padding: "22px 30px",
        borderRadius: side === "l" ? "26px 26px 26px 6px" : "26px 26px 6px 26px",
        background: side === "l" ? C.agentTint : C.ink,
        color: side === "l" ? C.ink : C.boardText,
        border: tone === "held" ? `4px solid ${C.waitMid}` : "4px solid transparent",
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: 32,
        lineHeight: 1.25,
        opacity: Math.min(1, p * 2),
        transform: `scale(${0.6 + 0.4 * p})`,
        transformOrigin: side === "l" ? "0% 100%" : "100% 100%",
      }}
    >
      {children}
    </div>
  );
}

function After2(_: SceneProps) {
  const f = useCurrentFrame();
  const day = useT(0, 26, EZ.out);
  const typing = f >= 18 && f < 34;
  const unsure = usePop(48);
  const thread = useT(52, 74, EZ.inOut);
  const gate = usePop(72, SP.heavy);
  const handed = usePop(100);
  const held = f >= 48;
  return (
    <Day>
      <Drift seed="after2" amp={10}>
        <Camera
          keys={[
            { at: 0, rect: { x: 230, y: 150, w: 860, h: 640 } },
            { at: 50, rect: { x: 250, y: 170, w: 840, h: 620 } },
            { at: 74, rect: { x: 190, y: 140, w: 1620, h: 800 } },
            { at: 96, rect: { x: 1170, y: 330, w: 660, h: 500 } },
            { at: 120, rect: { x: 1190, y: 350, w: 620, h: 470 } },
          ]}
        >
          <div style={{ ...card, left: 260, top: 170, width: 800, height: 720 }}>
            <div style={{ position: "absolute", left: 40, top: 32, display: "flex", alignItems: "center", gap: 16 }}>
              <Tile code="DS" size={52} />
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 38, color: C.ink }}>Check-in</span>
            </div>
            <div
              style={{
                position: "absolute",
                right: 40,
                top: 38,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 18px",
                borderRadius: 999,
                background: C.heldBg,
                color: C.held,
                fontFamily: F.text,
                fontWeight: 700,
                fontSize: 24,
              }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30">
                <path d="M3 22 A12 12 0 0 1 27 22" fill="none" stroke={C.waitMid} strokeOpacity={0.4} strokeWidth="2" strokeDasharray="3 3" />
                <circle cx={15 - 12 * Math.cos(Math.PI * day)} cy={22 - 12 * Math.sin(Math.PI * day)} r="5" fill={C.waitMid} />
              </svg>
              Next day
            </div>
            <div style={{ position: "absolute", left: 40, right: 40, top: 150, height: 130 }}>
              <Bubble at={6} side="l">
                How are you feeling today?
              </Bubble>
            </div>
            <div style={{ position: "absolute", left: 40, right: 40, top: 320, height: 130 }}>
              {typing && (
                <div style={{ position: "absolute", right: 0, padding: "26px 30px", borderRadius: 26, background: C.ink, display: "flex", gap: 10 }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: 14, height: 14, borderRadius: 7, background: C.boardText, opacity: 0.35 + 0.65 * Math.max(0, Math.sin((f - 18) * 0.5 - i)) }} />
                  ))}
                </div>
              )}
              {f >= 34 && (
                <Bubble at={34} side="r" tone={held ? "held" : undefined}>
                  Not sure. Is this normal?
                </Bubble>
              )}
            </div>
            <div
              style={{
                position: "absolute",
                right: 40,
                top: 470,
                padding: "8px 18px",
                borderRadius: 999,
                background: C.heldBg,
                border: `2px solid ${C.held}`,
                color: C.held,
                fontFamily: F.text,
                fontWeight: 700,
                fontSize: 22,
                opacity: Math.min(1, unsure * 2),
                transform: `scale(${0.6 + 0.4 * unsure})`,
              }}
            >
              Unsure
            </div>
          </div>
          <CometThread d="M 1000 560 C 1120 560, 1140 600, 1270 600" progress={thread} color={C.waitMid} width={5} />
          <Rings x={1270} y={430} w={470} h={330} from={84} to={120} color={C.waitMid} radius={22} />
          <div
            style={{
              ...card,
              left: 1270,
              top: 430,
              width: 470,
              height: 330,
              background: C.heldBg,
              border: `4px solid ${C.held}`,
              padding: 36,
              boxSizing: "border-box",
              opacity: Math.min(1, gate * 2),
              transform: `scale(${0.7 + 0.3 * gate})`,
            }}
          >
            <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 20, letterSpacing: "0.1em", textTransform: "uppercase", color: C.held }}>Gate</div>
            <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 92, lineHeight: 1, color: C.held, marginTop: 6 }}>Nurse</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 34 }}>
              <div style={{ width: 62, height: 62, borderRadius: 31, background: C.held, color: "#fff", fontFamily: F.text, fontWeight: 700, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>RA</div>
              <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.ink }}>Renee Alvarez, RN</div>
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              left: 1270,
              top: 790,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 24px",
              borderRadius: 999,
              background: C.ink,
              color: C.boardText,
              fontFamily: F.text,
              fontWeight: 700,
              fontSize: 26,
              opacity: Math.min(1, handed * 2),
              transform: `translateY(${(1 - handed) * 20}px)`,
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 6, background: C.waitMid }} />
            Handed to nurse
          </div>
        </Camera>
      </Drift>
      <Sfx at={6} name="ping" volume={0.3} />
      <Sfx at={34} name="tick-a" volume={0.3} />
      <Sfx at={72} name="gate-hold" volume={0.35} />
      <Sfx at={100} name="ping" volume={0.3} />
    </Day>
  );
}

/* ------------------------------------------------------------------ */
/* AFTER-3: Results watch, Follow-up, and the loop back to the fax      */
/* ------------------------------------------------------------------ */

function Header({ code, name, at = 0, dark = false }: { code: string; name: string; at?: number; dark?: boolean }) {
  const p = usePop(at);
  return (
    <div style={{ position: "absolute", left: 140, top: 110, display: "flex", alignItems: "center", gap: 22, opacity: Math.min(1, p * 2), transform: `translateX(${(1 - p) * -40}px)` }}>
      <Tile code={code} size={76} dark={dark} />
      <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 64, color: dark ? C.boardText : C.ink }}>{name}</span>
    </div>
  );
}

function ResultsShot() {
  const f = useCurrentFrame();
  const ack = useT(28, 36, EZ.out);
  const tile = usePop(2);
  const push = interpolate(f, [0, 45], [1, 1.1], cl);
  const done = f >= 30;
  return (
    <Day>
      <Header code="RW" name="Results watch" />
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        {!done && <Rings x={550} y={320} w={820} h={440} from={0} to={30} color={C.waitMid} radius={20} />}
        <div
          style={{
            ...card,
            left: 550,
            top: 320,
            width: 820,
            height: 440,
            padding: 56,
            boxSizing: "border-box",
            border: `5px solid ${done ? C.agent : C.waitMid}`,
            transform: `scale(${0.8 + 0.2 * tile})`,
          }}
        >
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 28, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkSoft }}>Maria Diaz</div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 130, color: C.ink, lineHeight: 1.05, marginTop: 6 }}>CT result</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 30, fontFamily: F.text, fontWeight: 700, fontSize: 42, color: done ? C.agent : C.held }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
              {done ? (
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke={C.agent} strokeWidth="3" strokeDasharray="24" strokeDashoffset={24 * (1 - ack)} strokeLinecap="round" />
              ) : (
                <circle cx="12" cy="12" r="7" stroke={C.waitMid} strokeWidth="3" strokeDasharray="4 3" transform={`rotate(${f * 8} 12 12)`} />
              )}
            </svg>
            {done ? "Acknowledged" : "Watching"}
          </div>
        </div>
      </AbsoluteFill>
      <Sfx at={30} name="gate-ok" volume={0.35} />
    </Day>
  );
}

const CAL_TARGET = 17;
function FollowShot() {
  const f = useCurrentFrame();
  const fly = usePop(14, { damping: 14, stiffness: 160 });
  const landed = f >= 26;
  const ripple = useT(26, 40, EZ.out);
  const push = interpolate(f, [0, 50], [1, 1.08], cl);
  const cols = 7;
  const cw = 150;
  const chh = 100;
  const gx = 960 - (cols * cw) / 2;
  const gy = 350;
  const tx = gx + (CAL_TARGET % cols) * cw;
  const ty = gy + Math.floor(CAL_TARGET / cols) * chh;
  return (
    <Day>
      <Header code="FU" name="Follow-up" />
      <AbsoluteFill style={{ transform: `scale(${push})` }}>
        <div style={{ ...card, left: gx - 40, top: gy - 110, width: cols * cw + 80, height: 5 * chh + 150 }} />
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ position: "absolute", left: gx + i * cw, top: gy - 64, width: cw, textAlign: "center", fontFamily: F.text, fontWeight: 700, fontSize: 22, color: C.inkSoft }}>
            {d}
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => {
          const hit = i === CAL_TARGET && landed;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: gx + (i % cols) * cw + 4,
                top: gy + Math.floor(i / cols) * chh + 4,
                width: cw - 8,
                height: chh - 8,
                borderRadius: 10,
                background: hit ? C.agentTint : C.canvas,
                border: `2px solid ${hit ? C.agent : "transparent"}`,
                fontFamily: F.figure,
                fontWeight: 600,
                fontSize: 24,
                color: C.inkSoft,
                padding: "6px 10px",
                boxSizing: "border-box",
                opacity: i < 31 ? 1 : 0.3,
              }}
            >
              {i < 31 ? i + 1 : ""}
            </div>
          );
        })}
        {landed && (
          <div
            style={{
              position: "absolute",
              left: tx + 4 - 30 * ripple,
              top: ty + 4 - 30 * ripple,
              width: cw - 8 + 60 * ripple,
              height: chh - 8 + 60 * ripple,
              borderRadius: 14,
              border: `4px solid ${C.agent}`,
              opacity: 1 - ripple,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            left: lerp(1500, tx + 8, fly),
            top: lerp(160, ty + 46, fly),
            transform: `rotate(${(1 - fly) * 12}deg) scale(${lerp(1.8, 1, Math.min(1, fly))})`,
            transformOrigin: "0 0",
            padding: "6px 10px",
            borderRadius: 8,
            background: C.agent,
            color: "#fff",
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 22,
            whiteSpace: "nowrap",
            boxShadow: "0 14px 30px -14px rgba(15,118,110,.8)",
          }}
        >
          Next visit
        </div>
      </AbsoluteFill>
      <Sfx at={26} name="tick-b" volume={0.35} />
    </Day>
  );
}

/** The six stops of Maria's thread, around a loop. */
const LOOP = { cx: 960, cy: 570, rx: 690, ry: 320, a0: -150 };
const loopPt = (deg: number): [number, number] => [LOOP.cx + LOOP.rx * Math.cos((deg * Math.PI) / 180), LOOP.cy + LOOP.ry * Math.sin((deg * Math.PI) / 180)];
const LOOP_D = (() => {
  const pts: string[] = [];
  for (let k = 0; k <= 72; k++) {
    const [x, y] = loopPt(LOOP.a0 + k * 5);
    pts.push(`${k === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
})();
const STOPS: { label: string; img?: { src: string; crop: { x: number; y: number; w: number; h: number } }; code?: string }[] = [
  { label: "Referral", img: { src: "assets/maria-referral-fax.png", crop: { x: 0, y: 0, w: 1207, h: 780 } } },
  { label: "Prior auth", img: { src: "clips/prior-auth.png", crop: { x: 1200, y: 340, w: 2000, h: 1300 } } },
  { label: "Visit day", img: { src: "assets/waiting.png", crop: { x: 0, y: 0, w: 1920, h: 1248 } } },
  { label: "Discharge", code: "DS" },
  { label: "Results", code: "RW" },
  { label: "Follow-up", code: "FU" },
];

function LoopShot() {
  const f = useCurrentFrame();
  const p = interpolate(f, [4, 40], [0, 1], { ...cl, easing: EZ.inOut });
  const zoom = interpolate(f, [0, 22], [1.35, 1], { ...cl, easing: EZ.out });
  const closed = useT(40, 48, EZ.out);
  return (
    <Day>
      <AbsoluteFill style={{ transform: `scale(${zoom}) rotate(${(1 - zoom) * 8}deg)` }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <path d={LOOP_D} fill="none" stroke={C.rule} strokeWidth={4} strokeDasharray="10 12" />
        </svg>
        <CometThread d={LOOP_D} progress={p} color={C.agent} width={7} />
        {STOPS.map((s, k) => {
          const [x, y] = loopPt(LOOP.a0 + k * 60);
          const th = k / 6;
          const pop = k === 0 ? Math.max(interpolate(p, [0, 0.04], [0, 1], cl), 0) : interpolate(p, [th - 0.02, th + 0.05], [0, 1], cl);
          const isFax = k === 0;
          const big = isFax ? 1 + 0.25 * closed : 1;
          return (
            <div key={k} style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${(0.55 + 0.45 * pop) * big})`, opacity: 0.35 + 0.65 * pop }}>
              <div
                style={{
                  width: 230,
                  height: 150,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: C.panel,
                  border: `4px solid ${pop > 0.5 ? C.agent : C.rule}`,
                  boxShadow: isFax && closed > 0 ? `0 0 0 ${12 * closed}px rgba(15,118,110,.18), 0 30px 60px -30px rgba(24,34,58,.6)` : "0 30px 60px -30px rgba(24,34,58,.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {s.img ? <Shot src={s.img.src} crop={s.img.crop} width={230} /> : <Tile code={s.code!} size={84} on={pop} />}
              </div>
              <div style={{ textAlign: "center", marginTop: 10, fontFamily: F.text, fontWeight: 700, fontSize: 24, color: C.ink }}>{s.label}</div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: 470 }}>
          <LineReveal lines={["Loop closed"]} at={40} size={130} color={C.ink} align="center" />
        </div>
      </AbsoluteFill>
      {STOPS.map((_, k) => (k > 0 ? <Sfx key={k} at={4 + Math.round(36 * (k / 6))} name="tick-a" volume={0.18} /> : null))}
      <Sfx at={40} name="bell" volume={0.3} />
    </Day>
  );
}

function After3(_: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Seg from={0} dur={45} outFx="whip">
        <ResultsShot />
      </Seg>
      <Seg from={45} dur={50} inFx="whip" outFx="push">
        <FollowShot />
      </Seg>
      <Seg from={95} dur={55} inFx="push">
        <LoopShot />
      </Seg>
      <Sfx at={36} name="whoosh" volume={0.3} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* TECH-1 / TECH-2: Meta models plugging into the agents they power    */
/* ------------------------------------------------------------------ */

type Chip = { name: string; agents: string[]; at: number; x: number; y: number; icon?: "wave" | "box" | "open" };
const RAIL_Y = 640;

function ChipView({ c, focus }: { c: Chip; focus: number }) {
  const f = useCurrentFrame();
  const p = usePop(c.at);
  const drop = (1 - Math.min(1, p)) * -80;
  return (
    <div
      style={{
        position: "absolute",
        left: c.x,
        top: c.y,
        transform: `translate(-50%, -50%) translateY(${drop}px) scale(${0.7 + 0.3 * p})`,
        opacity: Math.min(1, p * 2) * (0.45 + 0.55 * focus),
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px 28px",
        borderRadius: 999,
        background: "#0f1930",
        border: `3px solid ${C.glow}`,
        boxShadow: `0 0 ${30 * focus}px rgba(45,212,191,.35)`,
        color: C.boardText,
        fontFamily: F.text,
        fontWeight: 700,
        fontSize: 32,
        whiteSpace: "nowrap",
      }}
    >
      {c.icon === "wave" && (
        <div style={{ display: "flex", gap: 4, alignItems: "center", height: 30 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ width: 5, borderRadius: 3, background: C.glow, height: 8 + 20 * Math.abs(Math.sin(f * 0.35 + i * 1.3)) }} />
          ))}
        </div>
      )}
      {c.icon === "box" && (
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke={C.glow} strokeWidth="3">
          <path d="M3 10V3h7M20 3h7v7M27 20v7h-7M10 27H3v-7" />
        </svg>
      )}
      {c.icon !== "wave" && c.icon !== "box" && <span style={{ width: 14, height: 14, borderRadius: 7, background: C.glow }} />}
      {c.name}
    </div>
  );
}

function Cables({ chips }: { chips: Chip[] }) {
  const f = useCurrentFrame();
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
      {chips.flatMap((c) =>
        c.agents.map((code, j) => {
          const x2 = ax(code);
          const y1 = c.y + 30;
          const y2 = RAIL_Y - 50;
          const d = `M ${c.x} ${y1} C ${c.x} ${(y1 + y2) / 2 + 30}, ${x2} ${(y1 + y2) / 2 - 30}, ${x2} ${y2}`;
          const s = c.at + 6 + j * 3;
          const p = interpolate(f, [s, s + 10], [0, 1], { ...cl, easing: EZ.out });
          return (
            <g key={c.name + code}>
              <path d={d} fill="none" stroke={C.glow} strokeOpacity={0.18} strokeWidth={12} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} strokeLinecap="round" />
              <path d={d} fill="none" stroke={C.glow} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} strokeLinecap="round" />
            </g>
          );
        }),
      )}
    </svg>
  );
}

function RailTile({ i, chips, tagsAt, slotOP }: { i: number; chips: Chip[]; tagsAt: number; slotOP: boolean }) {
  const f = useCurrentFrame();
  const a = AGENTS[i]!;
  let plugAt = Infinity;
  for (const c of chips) {
    const j = c.agents.indexOf(a.code);
    if (j >= 0) plugAt = Math.min(plugAt, c.at + 6 + j * 3 + 10);
  }
  const on = Number.isFinite(plugAt) ? interpolate(f, [plugAt - 1, plugAt + 2], [0, 1], cl) : 0;
  const bump = Number.isFinite(plugAt) && f >= plugAt ? 1 + 0.18 * Math.exp(-(f - plugAt) / 4) * Math.cos((f - plugAt) * 0.6) : 1;
  const tag = useT(tagsAt + Math.abs(i - 6), tagsAt + Math.abs(i - 6) + 8, EZ.out);
  const isSlot = slotOP && a.code === "OP" && on < 0.5;
  const x = X0 + i * STEP;
  return (
    <div style={{ position: "absolute", left: x, top: RAIL_Y, transform: "translate(-50%, -50%)", width: 130, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ transform: `scale(${bump})` }}>
        <Tile code={a.code} on={on} size={84} dark muted={isSlot || (a.kind !== "model" && tag > 0.5)} />
      </div>
      <div style={{ position: "absolute", top: 98, width: 130, textAlign: "center", fontFamily: F.text, fontWeight: 700, fontSize: 18, lineHeight: 1.15, color: C.boardText, opacity: a.kind === "model" ? 0.55 + 0.45 * on : 0.55 }}>
        {a.name}
      </div>
      {a.kind !== "model" && (
        <div
          style={{
            position: "absolute",
            top: 160,
            padding: "5px 12px",
            borderRadius: 999,
            border: `2px solid ${a.kind === "rust" ? "#d9a35b" : "rgba(244,246,242,.45)"}`,
            color: a.kind === "rust" ? "#e8b56f" : "rgba(244,246,242,.75)",
            fontFamily: F.text,
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: "nowrap",
            opacity: tag,
            transform: `translateY(${(1 - tag) * 14}px)`,
          }}
        >
          {a.kind === "rust" ? "Rust engine" : "Rules"}
        </div>
      )}
    </div>
  );
}

function ModelRail({ chips, tagsAt, slotOP, focusOf }: { chips: Chip[]; tagsAt: number; slotOP: boolean; focusOf: (c: Chip) => number }) {
  return (
    <>
      <Cables chips={chips} />
      {AGENTS.map((_, i) => (
        <RailTile key={i} i={i} chips={chips} tagsAt={tagsAt} slotOP={slotOP} />
      ))}
      {chips.map((c) => (
        <ChipView key={c.name} c={c} focus={focusOf(c)} />
      ))}
    </>
  );
}

const SPARK: Chip = { name: "Muse Spark 1.3", agents: ["IN", "PA", "PM", "CO", "DS"], at: 10, x: 960, y: 250, icon: "open" };
const VOICE: Chip = { name: "Muse Voice Transcribe", agents: ["PM"], at: 82, x: 520, y: 420, icon: "wave" };
const SAM: Chip = { name: "SAM 3.1", agents: ["WS"], at: 128, x: 1250, y: 420, icon: "box" };
const BOXES = [
  [375, 745, 155, 265],
  [600, 740, 185, 340],
  [830, 705, 205, 325],
  [1040, 710, 200, 300],
  [1225, 690, 130, 290],
] as const;

function SamThumb({ at }: { at: number }) {
  const f = useCurrentFrame();
  const p = usePop(at);
  const k = 380 / 1920;
  return (
    <div style={{ position: "absolute", left: 1400, top: 300, width: 380, height: 253, borderRadius: 12, overflow: "hidden", border: `3px solid ${C.glow}`, opacity: Math.min(1, p * 2), transform: `scale(${0.8 + 0.2 * p})`, transformOrigin: "0 50%" }}>
      <Img src={staticFile("assets/waiting.png")} style={{ width: 380, height: 253 }} />
      {BOXES.map(([x, y, w, h], i) => {
        const b = interpolate(f, [at + 8 + i * 3, at + 12 + i * 3], [0, 1], cl);
        return <div key={i} style={{ position: "absolute", left: x * k, top: y * k, width: w * k, height: h * k, border: `2px solid ${C.glow}`, background: "rgba(45,212,191,.15)", opacity: b, transform: `scale(${1.3 - 0.3 * b})` }} />;
      })}
    </div>
  );
}

function Tech1(_: SceneProps) {
  const f = useCurrentFrame();
  const chips = [SPARK, VOICE, SAM];
  const focusOf = (c: Chip) => (c === SAM ? 1 : c === VOICE ? (f < 125 ? 1 : 0.5) : f < 80 ? 1 : 0.5);
  const WIDE = WIDE_R;
  return (
    <Night light={0.14}>
      <Drift seed="tech1" amp={8}>
        <Camera
          keys={[
            { at: 0, rect: { x: 400, y: 300, w: 1120, h: 480 } },
            { at: 12, rect: { x: 380, y: 280, w: 1160, h: 500 } },
            { at: 44, rect: WIDE },
            { at: 80, rect: WIDE },
            { at: 98, rect: { x: 300, y: 320, w: 820, h: 540 } },
            { at: 122, rect: { x: 320, y: 330, w: 800, h: 530 } },
            { at: 142, rect: { x: 860, y: 260, w: 980, h: 620 } },
            { at: 180, rect: { x: 760, y: 220, w: 1100, h: 680 } },
          ]}
        >
          <ModelRail chips={chips} tagsAt={52} slotOP focusOf={focusOf} />
          <SamThumb at={136} />
        </Camera>
      </Drift>
      {SPARK.agents.map((_, j) => (
        <Sfx key={j} at={SPARK.at + 16 + j * 3} name="tick-a" volume={0.18} />
      ))}
      <Sfx at={SPARK.at} name="ping" volume={0.3} />
      <Sfx at={VOICE.at} name="ping" volume={0.3} />
      <Sfx at={VOICE.at + 16} name="tick-b" volume={0.3} />
      <Sfx at={SAM.at} name="ping" volume={0.3} />
      <Sfx at={SAM.at + 16} name="tick-b" volume={0.3} />
    </Night>
  );
}

const OPEN: Chip = { name: "Muse Spark Open", agents: ["OP"], at: 34, x: 1560, y: 330, icon: "open" };

function RailFinal() {
  const f = useCurrentFrame();
  const done = [
    { ...SPARK, at: -200 },
    { ...VOICE, at: -200 },
    { ...SAM, at: -200 },
  ];
  const ow = usePop(72);
  return (
    <Night light={0.14}>
      <Drift seed="tech2" amp={8}>
        <Camera
          keys={[
            { at: 0, rect: WIDE_R },
            { at: 30, rect: { x: 1000, y: 250, w: 820, h: 620 } },
            { at: 90, rect: { x: 1040, y: 270, w: 760, h: 580 } },
          ]}
        >
          <ModelRail chips={[...done, OPEN]} tagsAt={-100} slotOP focusOf={(c) => (c === OPEN ? 1 : 0.35)} />
          <div
            style={{
              position: "absolute",
              left: 1560,
              top: 392,
              transform: `translate(-50%, 0) scale(${0.6 + 0.4 * ow})`,
              opacity: Math.min(1, ow * 2),
              padding: "8px 20px",
              borderRadius: 999,
              background: C.glow,
              color: C.ink,
              fontFamily: F.text,
              fontWeight: 700,
              fontSize: 24,
              whiteSpace: "nowrap",
            }}
          >
            open weights
          </div>
        </Camera>
      </Drift>
      <div style={{ display: f < 0 ? "block" : "none" }} />
    </Night>
  );
}

function AgentsProof() {
  const ring = useT(20, 30, EZ.out);
  return (
    <Night light={0.18}>
      <TiltScreen dur={45} width={1500} from={{ rx: 16, ry: -18 }} to={{ rx: 5, ry: -7 }}>
        <ImgCam
          src="clips/agents.png"
          iw={3200}
          ih={1800}
          w={1500}
          h={844}
          bg={C.panel}
          keys={[
            { at: 0, r: { x: 480, y: 330, w: 2720, h: 1470 } },
            { at: 20, r: { x: 500, y: 1330, w: 1180, h: 280 } },
            { at: 45, r: { x: 540, y: 1350, w: 1100, h: 260 } },
          ]}
          over={(m) => {
            const [x1, y1] = m(525, 1418);
            const [x2, y2] = m(1470, 1522);
            return (
              <div
                style={{
                  position: "absolute",
                  left: x1,
                  top: y1,
                  width: x2 - x1,
                  height: y2 - y1,
                  borderRadius: 12,
                  border: `5px solid ${C.agent}`,
                  opacity: ring,
                  transform: `scale(${1.08 - 0.08 * ring})`,
                  boxShadow: `0 0 0 3000px rgba(24,34,58,${0.22 * ring})`,
                }}
              />
            );
          }}
        />
      </TiltScreen>
    </Night>
  );
}

function Tech2(_: SceneProps) {
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Seg from={0} dur={90} outFx="push" origin="1368px 600px">
        <RailFinal />
      </Seg>
      <Seg from={90} dur={45} inFx="push">
        <AgentsProof />
      </Seg>
      <Sfx at={OPEN.at} name="ping" volume={0.3} />
      <Sfx at={OPEN.at + 16} name="tick-b" volume={0.35} />
      <Sfx at={81} name="whoosh" volume={0.3} />
      <Sfx at={112} name="shutter" volume={0.3} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* SCALE: three hospitals, then Northgate's campus                     */
/* ------------------------------------------------------------------ */

const HOSP = [
  { src: "clips/campus-halden.png", name: "Halden", ih: 1122, ry: 22 },
  { src: "clips/campus-northgate.png", name: "Northgate", ih: 1202, ry: 0 },
  { src: "clips/campus-st-brennan.png", name: "St. Brennan", ih: 1202, ry: -22 },
];
const TILE_W = 540;

function HospTile({ i, zoom }: { i: number; zoom: number }) {
  const h = HOSP[i]!;
  const p = usePop(i * 6, SP.snappy);
  const label = useT(24 + i * 3, 32 + i * 3, EZ.out);
  const x = 960 + (i - 1) * 600;
  const isMain = i === 1;
  const fade = isMain ? 1 : 1 - zoom;
  return (
    <div style={{ position: "absolute", left: x, top: 540, transform: `translate(-50%, -50%) perspective(1600px) rotateY(${h.ry * (1 - zoom)}deg) scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 2) * fade }}>
      <div style={{ width: TILE_W, height: TILE_W * (1202 / 2588), borderRadius: 16 * (1 - zoom), overflow: "hidden", background: "#f4f6f5", boxShadow: "0 40px 80px -40px rgba(0,0,0,.7)", display: "flex", alignItems: "center" }}>
        <Img src={staticFile(h.src)} style={{ width: TILE_W, height: TILE_W * (h.ih / 2588) }} />
      </div>
      <div style={{ position: "absolute", top: TILE_W * (1202 / 2588) + 22, left: 0, right: 0, textAlign: "center", fontFamily: F.text, fontWeight: 700, fontSize: 30, color: C.boardText, opacity: label * (1 - zoom * 3) }}>
        {h.name}
      </div>
    </div>
  );
}

function ThreeHospitals() {
  const f = useCurrentFrame();
  const zoom = interpolate(f, [46, 60], [0, 1], { ...cl, easing: EZ.in });
  const S = Math.exp(Math.log(1920 / TILE_W) * zoom);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ background: "#f4f6f5", opacity: zoom > 0.98 ? 1 : 0 }} />
      <AbsoluteFill style={{ transform: `scale(${S})`, transformOrigin: "960px 540px" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 130, opacity: 1 - zoom }}>
          <LineReveal lines={["3 hospitals"]} at={18} size={130} align="center" />
        </div>
        {HOSP.map((_, i) => (
          <HospTile key={i} i={i} zoom={zoom} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

const PINS: [number, number][] = [
  [966, 142],
  [792, 308],
  [1190, 525],
  [1105, 775],
  [1542, 762],
];

function Northgate() {
  const f = useCurrentFrame();
  const ry = interpolate(f, [0, 60, 150], [-14, -4, 8], { ...cl, easing: EZ.inOut });
  const rx = interpolate(f, [0, 90, 150], [10, 2, 6], cl);
  const label5 = f >= 32 && f < 64;
  const measure = interpolate(f, [58, 90], [0, 1], { ...cl, easing: EZ.inOut });
  const tag = useT(64, 74, EZ.out);
  const tagOut = useT(118, 126);
  const pinsBack = useT(120, 132, EZ.out);
  const chip = usePop(126);
  return (
    <AbsoluteFill style={{ background: "#f4f6f5", perspective: 2200 }}>
      <AbsoluteFill style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.12)` }}>
        <ImgCam
          src="clips/campus-northgate.png"
          iw={2588}
          ih={1202}
          w={1920}
          h={1080}
          bg="#f4f6f5"
          keys={[
            { at: 0, r: { x: 0, y: 0, w: 2588, h: 1202 } },
            { at: 22, r: { x: 560, y: 40, w: 1640, h: 1150 } },
            { at: 50, r: { x: 600, y: 60, w: 1580, h: 1130 } },
            { at: 62, r: { x: 880, y: 520, w: 640, h: 360 } },
            { at: 92, r: { x: 880, y: 70, w: 640, h: 360 } },
            { at: 124, r: { x: 600, y: 40, w: 1500, h: 1150 } },
            { at: 150, r: { x: 560, y: 20, w: 1580, h: 1180 } },
          ]}
          over={(m, s) => {
            const [lx, ly0] = m(1304, 900);
            const [, ly1] = m(1304, 900 - 740 * measure);
            return (
              <>
                <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 1 - tagOut }}>
                  <line x1={lx + 20} y1={ly0} x2={lx + 20} y2={ly1} stroke={C.agent} strokeWidth={6} strokeLinecap="round" />
                  {Array.from({ length: 14 }).map((_, k) => {
                    const yy = 900 - (740 / 13) * k;
                    const [, ty] = m(1304, yy);
                    const vis = measure * 740 >= (740 / 13) * k - 1;
                    return vis ? <line key={k} x1={lx + 8} y1={ty} x2={lx + 36} y2={ty} stroke={C.agent} strokeWidth={4} /> : null;
                  })}
                </svg>
                {PINS.map(([px, py], k) => {
                  const [x, y] = m(px - 34, py);
                  const p = interpolate(f, [30 + k * 5, 36 + k * 5], [0, 1], { ...cl, easing: EZ.out });
                  const vis = f < 58 ? p : pinsBack;
                  return (
                    <div
                      key={k}
                      style={{
                        position: "absolute",
                        left: x,
                        top: y,
                        width: 48,
                        height: 48,
                        marginLeft: -24,
                        marginTop: -24,
                        borderRadius: 24,
                        background: C.agent,
                        color: "#fff",
                        fontFamily: F.figure,
                        fontWeight: 600,
                        fontSize: 28,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: `0 0 0 ${8 * vis}px rgba(15,118,110,.2)`,
                        opacity: vis,
                        transform: `scale(${(0.4 + 0.6 * vis) * Math.min(1.4, Math.max(0.8, s))})`,
                      }}
                    >
                      {k + 1}
                    </div>
                  );
                })}
              </>
            );
          }}
        />
      </AbsoluteFill>
      {label5 && (
        <div style={{ position: "absolute", left: 120, top: 800 }}>
          <LineReveal lines={["5 buildings"]} at={32} exitAt={56} size={140} color={C.ink} />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: 110,
          top: 110,
          padding: "26px 40px",
          borderRadius: 18,
          background: C.ink,
          display: "flex",
          alignItems: "baseline",
          gap: 2,
          opacity: tag * (1 - tagOut),
          transform: `translateY(${(1 - tag) * 30}px)`,
        }}
      >
        <Odometer value={14} at={64} frames={20} size={170} color={C.glow} />
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 90, color: C.boardText }}>-floor tower</span>
      </div>
      <div
        style={{
          position: "absolute",
          right: 110,
          bottom: 90,
          display: "flex",
          gap: 12,
          opacity: Math.min(1, chip * 2),
          transform: `translateY(${(1 - chip) * 30}px)`,
        }}
      >
        {["Halden", "Northgate", "St. Brennan"].map((n) => (
          <span
            key={n}
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              background: n === "Northgate" ? C.agent : C.panel,
              color: n === "Northgate" ? "#fff" : C.ink,
              border: `2px solid ${C.agent}`,
              fontFamily: F.text,
              fontWeight: 700,
              fontSize: 26,
            }}
          >
            {n}
          </span>
        ))}
      </div>
      {PINS.map((_, k) => (
        <Sfx key={k} at={30 + k * 5} name="tick-a" volume={0.18} />
      ))}
      <Sfx at={64} name="count" volume={0.3} />
    </AbsoluteFill>
  );
}

function Scale(_: SceneProps) {
  return (
    <AbsoluteFill style={{ background: "#f4f6f5" }}>
      <Seg from={0} dur={60}>
        <ThreeHospitals />
      </Seg>
      <Seg from={60} dur={150}>
        <Northgate />
      </Seg>
      {[0, 6, 12].map((t) => (
        <Sfx key={t} at={t} name="tick-b" volume={0.22} />
      ))}
      <Sfx at={51} name="whoosh" volume={0.35} />
    </AbsoluteFill>
  );
}

/* ------------------------------------------------------------------ */
/* HIT-3: music-only montage burst on the thread                       */
/* ------------------------------------------------------------------ */

const BURST: { src: string; crop: { x: number; y: number; w: number; h: number }; width: number }[] = [
  { src: "clips/inbox-question.png", crop: { x: 1184, y: 336, w: 2016, h: 1300 }, width: 1180 },
  { src: "assets/maria-referral-fax.png", crop: { x: 0, y: 220, w: 1207, h: 700 }, width: 1000 },
  { src: "clips/prior-auth.png", crop: { x: 1200, y: 340, w: 2000, h: 1300 }, width: 1180 },
  { src: "clips/phone-plan.png", crop: { x: 0, y: 1080, w: 1170, h: 1100 }, width: 620 },
  { src: "assets/waiting.png", crop: { x: 0, y: 200, w: 1920, h: 1080 }, width: 1180 },
  { src: "clips/proposal.png", crop: { x: 0, y: 120, w: 760, h: 600 }, width: 700 },
  { src: "clips/agents.png", crop: { x: 480, y: 330, w: 2720, h: 1470 }, width: 1180 },
  { src: "clips/campus-northgate.png", crop: { x: 560, y: 40, w: 1580, h: 1000 }, width: 1180 },
];
const CUTS = [0, 8, 15, 23, 30, 38, 45, 53, 60];

function BurstCell({ i }: { i: number }) {
  const f = useCurrentFrame();
  const b = BURST[i]!;
  const len = CUTS[i + 1]! - CUTS[i]!;
  const s = interpolate(f, [0, len], [1.14, 1.0], { ...cl, easing: EZ.out });
  const dir = i % 2 === 0 ? 1 : -1;
  const fadeOut = i === BURST.length - 1 ? interpolate(f, [2, len], [1, 0], cl) : 1;
  return (
    <AbsoluteFill style={{ perspective: 2000, alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <div
        style={{
          borderRadius: 16,
          overflow: "hidden",
          background: C.panel,
          transform: `rotateY(${dir * 14}deg) rotateX(6deg) scale(${s}) translateX(${dir * interpolate(f, [0, len], [30, -10], cl)}px)`,
          boxShadow: "0 60px 120px -40px rgba(0,0,0,.7), 0 0 60px rgba(45,212,191,.15)",
        }}
      >
        <Shot src={b.src} crop={b.crop} width={b.width} />
      </div>
    </AbsoluteFill>
  );
}

function Hit3(_: SceneProps) {
  const thread = useT(0, 56, EZ.inOut);
  return (
    <Night light={0.16}>
      {BURST.map((_, i) => (
        <Seg key={i} from={CUTS[i]!} dur={CUTS[i + 1]! - CUTS[i]!}>
          <BurstCell i={i} />
        </Seg>
      ))}
      <CometThread d="M -40 540 L 1960 540" progress={thread} width={5} />
      {[0, 15, 30, 45].map((t) => (
        <Sfx key={t} at={t} name="shutter" volume={0.16} />
      ))}
    </Night>
  );
}

/* ------------------------------------------------------------------ */
/* CLOSE-1 / CLOSE-2: the whole journey, then the logo                 */
/* ------------------------------------------------------------------ */

const JOURNEY = "M -40 540 C 120 540, 170 400, 320 400 S 500 660, 650 660 S 820 420, 970 430 S 1140 670, 1290 650 S 1470 410, 1620 440 S 1790 560, 1980 540";
const JLEN = getLength(JOURNEY);
const JSTOPS = ["Fax", "Coverage", "Prior auth", "Schedule", "Visit day", "Home", "Results", "Follow-up"].map((label, k) => {
  const t = 0.1 + k * 0.115;
  const pt = getPointAtLength(JOURNEY, JLEN * t) ?? { x: 0, y: 0 };
  return { label, t, x: pt.x, y: pt.y };
});

function JourneyStops({ p, held, labelOp }: { p: number; held: number; labelOp: number }) {
  return (
    <>
      {JSTOPS.map((s, k) => {
        const on = interpolate(p, [s.t - 0.01, s.t + 0.03], [0, 1], cl);
        const below = k % 2 === 1;
        return (
          <div key={k} style={{ position: "absolute", left: s.x, top: s.y }}>
            <div
              style={{
                position: "absolute",
                left: -13,
                top: -13,
                width: 26,
                height: 26,
                borderRadius: 13,
                border: `4px solid ${C.glow}`,
                background: held > 0.5 ? C.glow : C.ink,
                opacity: 0.25 + 0.75 * on,
                transform: `scale(${0.6 + 0.4 * on + 0.2 * held})`,
                boxShadow: on > 0.5 ? `0 0 ${16 + 20 * held}px rgba(45,212,191,.6)` : "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: -100,
                width: 200,
                top: below ? 26 : -56,
                textAlign: "center",
                fontFamily: F.text,
                fontWeight: 700,
                fontSize: 22,
                color: C.boardText,
                opacity: on * 0.75 * labelOp,
              }}
            >
              {s.label}
            </div>
          </div>
        );
      })}
    </>
  );
}

function Close1({ vo }: SceneProps) {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, Math.max(40, vo + 2)], [0, 1], { ...cl, easing: EZ.inOut });
  const pt = getPointAtLength(JOURNEY, JLEN * Math.max(0.001, p)) ?? { x: 0, y: 0 };
  const sc = interpolate(f, [0, 75], [1.25, 1], { ...cl, easing: EZ.out });
  const follow = (960 - pt.x) * 0.25 * (sc - 1) * 4;
  const who = useT(4, 16, EZ.out);
  return (
    <Night light={0.08}>
      <Drift seed="close1" amp={6}>
        <AbsoluteFill style={{ transform: `translateX(${follow}px) scale(${sc})` }}>
          <CometThread d={JOURNEY} progress={p} width={6} />
          <JourneyStops p={p} held={0} labelOp={1} />
          <div style={{ position: "absolute", left: 40, top: 590, fontFamily: F.text, fontWeight: 700, fontSize: 24, color: C.boardText, opacity: who * 0.8 }}>Maria Diaz, 71</div>
        </AbsoluteFill>
      </Drift>
    </Night>
  );
}

const LOGO_AT = 105;

function Close2(_: SceneProps) {
  const f = useCurrentFrame();
  const pulse = interpolate(f, [4, 54], [0, 1], { ...cl, easing: EZ.inOut });
  const held = useT(30, 44, EZ.out);
  const flat = interpolate(f, [62, 86], [0, 1], { ...cl, easing: EZ.inOut });
  const pinch = interpolate(f, [84, 101], [0, 1], { ...cl, easing: EZ.in });
  const gone = f >= 102;
  const push = interpolate(f, [0, 62], [1, 1.05], cl);
  const logo = useSpring(LOGO_AT, SP.heavy);
  const reveal = useT(LOGO_AT, LOGO_AT + 14, EZ.out);
  const bar = useSpring(LOGO_AT, SP.snappy);
  const url = useT(LOGO_AT + 30, LOGO_AT + 44, EZ.out);
  const built = useT(LOGO_AT + 54, LOGO_AT + 68, EZ.out);
  const fade = interpolate(f, [225, 284], [0, 1], { ...cl, easing: EZ.inOut });
  const d = useDrift("close2logo", 0.6, 10);
  const breathe = 0.5 + 0.5 * Math.sin((f - LOGO_AT) / 20);
  const ptOn = pinch > 0 && !gone;
  return (
    <Night light={gone ? 0.1 + 0.05 * breathe : 0.08}>
      <DropHit at={LOGO_AT}>
        {!gone && (
          <AbsoluteFill style={{ transform: `scale(${push * (1 - pinch * 0.96)}, ${push * (1 - flat * 0.995)})`, transformOrigin: "960px 540px" }}>
            <CometThread d={JOURNEY} progress={1} width={6 + 3 * held} head={false} />
            <AbsoluteFill style={{ opacity: 1 - flat }}>
              <CometThread d={JOURNEY} progress={pulse} width={10} color="#e9fffb" />
            </AbsoluteFill>
            <AbsoluteFill style={{ opacity: 1 - Math.min(1, flat * 3) }}>
              <JourneyStops p={1} held={held} labelOp={1 - held * 0.4} />
            </AbsoluteFill>
          </AbsoluteFill>
        )}
        {ptOn && (
          <div style={{ position: "absolute", left: 950, top: 530, width: 20, height: 20, borderRadius: 10, background: "#e9fffb", boxShadow: `0 0 30px 10px ${C.glow}`, opacity: pinch }} />
        )}
        {gone && (
          <AbsoluteFill style={{ transform: `translate(${d.x}px, ${d.y}px)` }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 400,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 30,
                transform: `scale(${1.25 - 0.25 * logo})`,
              }}
            >
              <span style={{ width: 96 * Math.min(1.15, bar), height: 20, background: C.glow, display: "block", boxShadow: `0 0 ${24 + 16 * breathe}px rgba(45,212,191,.7)` }} />
              <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 190, lineHeight: 1, color: C.boardText, letterSpacing: "-0.01em", clipPath: `inset(-10% ${(1 - reveal) * 100}% -10% 0)` }}>
                Throughline
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 660,
                textAlign: "center",
                fontFamily: F.figure,
                fontWeight: 600,
                fontSize: 44,
                color: C.boardText,
                opacity: url,
                transform: `translateY(${(1 - url) * 24}px)`,
              }}
            >
              throughline-zeta-ten.vercel.app
            </div>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 760,
                textAlign: "center",
                fontFamily: F.text,
                fontWeight: 400,
                fontSize: 26,
                color: C.boardText,
                opacity: 0.6 * built,
              }}
            >
              Built on Muse Spark · Spark Open · SAM 3.1 · Voice Transcribe
            </div>
          </AbsoluteFill>
        )}
      </DropHit>
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />
      <Sfx at={LOGO_AT} name="impact" volume={0.3} />
      <Sfx at={LOGO_AT + 30} name="bell" volume={0.22} />
    </Night>
  );
}

export const scenes: Group = {
  DROP2: { C: Drop2, dark: true },
  "AFTER-1": { C: After1, dark: false },
  "AFTER-2": { C: After2, dark: false },
  "AFTER-3": { C: After3, dark: false },
  "TECH-1": { C: Tech1, dark: true },
  "TECH-2": { C: Tech2, dark: true },
  SCALE: { C: Scale, dark: false },
  "HIT-3": { C: Hit3, dark: true },
  "CLOSE-1": { C: Close1, dark: true },
  "CLOSE-2": { C: Close2, dark: true },
};


