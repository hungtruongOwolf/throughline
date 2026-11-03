import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, F } from "../theme";

/**
 * The YouTube thumbnail. Left: what a hospital visit looks like today, scattered pieces joined by
 * tangled red lines. Right: the same pieces on one teal thread, ending in the real patient app.
 */

const red = "rgba(220,60,45,.85)";

function Check() {
  return (
    <svg width={30} height={30} viewBox="0 0 24 24">
      <circle cx={12} cy={12} r={12} fill={C.agent} />
      <path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Thumbnail() {
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: "hidden" }}>
      {/* today on the left, warm and uneasy; Throughline on the right, teal */}
      <div style={{ position: "absolute", left: -300, top: 120, width: 1000, height: 1000, background: "radial-gradient(circle, rgba(180,35,24,.28), transparent 62%)" }} />
      <div style={{ position: "absolute", right: -260, top: -260, width: 1100, height: 1100, background: "radial-gradient(circle, rgba(45,212,191,.24), transparent 62%)" }} />

      {/* the hook */}
      <div style={{ position: "absolute", left: 48, top: 34, fontFamily: F.display, fontWeight: 800, fontSize: 88, lineHeight: 0.95, color: C.boardText }}>
        Lost between
        <br />
        hospital steps?
      </div>

      {/* the scattered pieces of a visit, tangled together */}
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        {[
          "M 150 360 C 300 260, 120 600, 420 330",
          "M 420 330 C 600 420, 200 470, 470 560",
          "M 150 360 C 80 520, 420 700, 470 560",
          "M 240 600 C 360 520, 520 680, 420 330",
        ].map((d) => (
          <path key={d} d={d} stroke={red} strokeWidth={4} strokeDasharray="10 9" fill="none" />
        ))}
      </svg>
      {/* one thread picks up every piece (it runs behind them) and carries it to the patient's phone */}
      <svg width={1280} height={720} style={{ position: "absolute", inset: 0 }}>
        <path d="M 140 380 C 260 330, 330 300, 418 330 S 500 520, 466 568 S 620 430, 700 420" stroke={C.glow} strokeWidth={10} strokeLinecap="round" fill="none" style={{ filter: `drop-shadow(0 0 14px ${C.glow})` }} />
      </svg>
      <div style={{ position: "absolute", left: 60, top: 270, transform: "rotate(-11deg)" }}>
        <Img src={staticFile("assets/maria-referral-fax.png")} style={{ width: 170, filter: "grayscale(1) contrast(1.1)", boxShadow: "0 20px 40px -10px rgba(0,0,0,.8)" }} />
        <div style={{ position: "absolute", left: 22, top: 70, transform: "rotate(-14deg)", border: `5px solid ${C.urgent}`, color: C.urgent, background: "rgba(255,255,255,.85)", borderRadius: 8, padding: "2px 14px", fontFamily: F.display, fontWeight: 800, fontSize: 40 }}>LOST</div>
      </div>
      <div style={{ position: "absolute", left: 318, top: 262, width: 200, borderRadius: 12, overflow: "hidden", background: C.panel, transform: "rotate(7deg)", boxShadow: "0 20px 40px -10px rgba(0,0,0,.8)" }}>
        <div style={{ background: C.urgent, color: "#fff", fontFamily: F.text, fontWeight: 700, fontSize: 22, padding: "8px 14px" }}>Insurance</div>
        <div style={{ padding: "8px 14px 12px", fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.ink, lineHeight: 1 }}>
          Pending
          <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 22, color: C.inkSoft, marginTop: 4 }}>week 3</div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 410, top: 470, width: 112, height: 196, borderRadius: 20, border: "4px solid rgba(244,246,242,.75)", background: "#0e1526", transform: "rotate(-7deg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 8 }}>
        <div style={{ fontFamily: F.figure, fontWeight: 600, fontSize: 30, color: C.boardText }}>5:12</div>
        <div style={{ fontFamily: F.text, fontWeight: 700, fontSize: 15, color: "rgba(244,246,242,.7)", textAlign: "center", lineHeight: 1.2 }}>No call about results</div>
      </div>
      {/* the person caught in the middle */}
      <svg width={110} height={170} viewBox="0 0 40 64" style={{ position: "absolute", left: 190, top: 470 }}>
        <ellipse cx={20} cy={63} rx={12} ry={2.5} fill="#000" opacity={0.4} />
        <rect x={15} y={38} width={5} height={24} rx={2.5} fill={C.boardText} />
        <rect x={20} y={38} width={5} height={24} rx={2.5} fill={C.boardText} />
        <rect x={11} y={17} width={18} height={25} rx={8} fill={C.boardText} />
        <circle cx={20} cy={9} r={7} fill={C.boardText} />
      </svg>
      <div style={{ position: "absolute", left: 120, top: 420, transform: "rotate(-5deg)", background: C.heldBg, color: C.held, border: `3px solid ${C.held}`, borderRadius: 999, padding: "6px 18px", fontFamily: F.text, fontWeight: 700, fontSize: 28 }}>Who do I ask?</div>

      {/* the real patient app */}
      <div style={{ position: "absolute", left: 690, top: 118, width: 270, height: 572, borderRadius: 40, background: "#05080f", padding: 10, boxShadow: `0 0 0 3px rgba(45,212,191,.6), 0 0 70px rgba(45,212,191,.45), 0 40px 80px -20px rgba(0,0,0,.9)`, transform: "rotate(3deg)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 31, overflow: "hidden", background: C.paper, position: "relative" }}>
          <Img src={staticFile("clips/phone-plan.png")} style={{ position: "absolute", left: 0, top: -34, width: 250 }} />
        </div>
      </div>

      {/* what the agents did */}
      <div style={{ position: "absolute", left: 995, top: 120, width: 270 }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 92, lineHeight: 0.88, color: C.glow, textShadow: "0 0 30px rgba(45,212,191,.4)" }}>
          13 AI
          <br />
          agents
        </div>
        <div style={{ marginTop: 6, fontFamily: F.display, fontWeight: 800, fontSize: 33, lineHeight: 1, color: C.boardText, whiteSpace: "nowrap" }}>connect every step</div>
        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          {["Referral read", "Insurance sent", "Visit planned", "Results tracked", "Follow-up booked"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: F.text, fontWeight: 700, fontSize: 25, color: C.boardText, whiteSpace: "nowrap" }}>
              <Check />
              {t}
            </div>
          ))}
        </div>
      </div>
      <div style={{ position: "absolute", left: 998, top: 650, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 34, height: 9, background: C.glow }} />
        <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 40, color: C.boardText }}>Throughline</span>
      </div>
    </AbsoluteFill>
  );
}
