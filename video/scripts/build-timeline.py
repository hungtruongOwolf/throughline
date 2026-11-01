"""Measures the voice lines and lays the film on a 120 BPM grid (src/v2/timeline.json).

Prints the music markers (bars) to pass to make-track.sh.
"""
import json, math, subprocess

BEAT, BAR, GAP = 15, 60, 6
LOGO_IN_CLOSE = 105  # frame of CLOSE-2 where the logo lands on the final impact
# Scenes were animated against these lengths; a shorter shot would cut their timing apart.
MIN_DUR = {"MARIA-1": 165, "HANDOFF-3": 135, "GATE-1": 210, "DAY-4": 150}
up = lambda f, q: int(math.ceil(f / q) * q)

lines = json.load(open("narration.json", encoding="utf-8"))
def vo_frames(i):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f"public/audio/vo2/l{i:02d}.wav"])
    return round(float(out.decode().strip()) * 30)

tl, marks, at = [], {}, BAR
for l in lines:
    b = l["beat"]
    if b.startswith("HIT"):
        s = up(at, BAR); tl.append(dict(id=l["id"], beat=b, start=s, vo=0)); at = s + BAR; continue
    vo = vo_frames(l["id"])
    if b == "IDEA":
        d1 = up(at, BAR); marks["D1"] = d1 // BAR
        tl.append(dict(id="TITLE", beat="TITLE", start=d1, vo=0)); at = d1 + 2 * BAR
    if b == "DAY-4":
        at = up(at, BAR); marks["BRK"] = at // BAR
    if b == "AFTER-1":
        d2 = up(at, BAR); marks["D2"] = d2 // BAR
        tl.append(dict(id="DROP2", beat="DROP2", start=d2, vo=0)); at = d2 + BAR
    if b == "CLOSE-1":
        marks["OUT"] = up(at, BAR) // BAR
    start = up(at, BEAT)
    if b == "CLOSE-2":  # the logo frame must sit on a bar line
        while (start + LOGO_IN_CLOSE) % BAR:
            start += BEAT
        marks["LOGO"] = (start + LOGO_IN_CLOSE) // BAR
    tl.append(dict(id=l["id"], beat=b, start=start, vo=vo, text=l["text"]))
    at = max(start + vo + GAP, start + MIN_DUR.get(b, 0))

end = max(at, tl[-1]["start"] + LOGO_IN_CLOSE + 3 * BAR)
total = up(end, BAR)
for i, e in enumerate(tl):
    e["dur"] = (tl[i + 1]["start"] if i + 1 < len(tl) else total) - e["start"]
json.dump(dict(fps=30, bpm=120, total=total, marks=marks, shots=tl), open("src/v2/timeline.json", "w"), indent=1)
print("total", total, f"{total/30:.1f}s", "bars", total // BAR, marks)
