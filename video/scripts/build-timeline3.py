"""Lays out the film (v3): each voice line with its picture, at natural speed.

Animated lines reuse the v2 scenes; product lines play the real recordings at 1x. A shot never
runs shorter than the scene it shows was animated for, and a recording never plays faster:
if the voice is longer than the clip, the last frame holds.
Writes src/v3/timeline.json and prints the music markers (bars at 120 BPM).
"""
import json, math

FPS, BAR, BEAT = 30, 60, 15
GAP, PART_GAP = 12, 24  # frames of air after a line, and extra air between parts
up = lambda f, q: int(math.ceil(f / q) * q)

lines = {x["id"]: x for x in json.load(open("narration3.json", encoding="utf-8"))}
# the lengths the v2 scenes were animated for (their builders checked them at these lengths)
v2 = {s["beat"]: s["dur"] for s in json.load(open("src/v3/v2-built.json"))["shots"]}
clip_len = lambda name: json.load(open(f"public/demo/{name}.json"))["duration"]

# line -> list of visuals; each visual takes a share of the line's time.
# anim: a v2 scene by beat; clip: a recording [from, to] seconds; still: a screenshot.
PLAN = {
    1: [("anim", "COLD-OPEN")],
    2: [("anim", "PROBLEM-1")],
    3: [("anim", "PROBLEM-2")],
    4: [("anim", "PROBLEM-3")],
    5: [("anim", "PRICE-1"), ("anim", "PRICE-2")],
    6: [("anim", "PRICE-3")],
    7: [("anim", "TITLE")],
    8: [("anim", "IDEA")],
    9: [("new", "Gates")],
    10: [("new", "Stages")],
    11: [("clip", "c01-fax-arrives", 0.8, 8.4)],
    12: [("clip", "c01-fax-arrives", 8.4, 14.5)],
    13: [("clip", "c02-answer", 1.0, 11.0)],
    14: [("clip", "c03-record-after", 0.0, None)],
    15: [("clip", "c04-approve-auth", 0.5, 11.8)],
    16: [("phone", "c05-maria-phone", 0.0, 6.6)],
    17: [("phone", "c05-maria-phone", 6.6, 12.5)],
    18: [("clip", "c06-today-approve", 0.0, 8.0)],
    19: [("anim", "DAY-2")],
    20: [("still", "proposal")],
    21: [("anim", "DAY-4")],
    22: [("clip", "c06-today-approve", 13.0, 18.5), ("phone", "c07-maria-changed", 0.0, 5.0)],
    23: [("clip", "c08-sign-summary", 0.0, 4.5)],
    24: [("clip", "c08-sign-summary", 4.5, 12.2)],
    25: [("clip", "c09-nurse-task", 0.5, 7.0)],
    26: [("clip", "c10-results-followup", 2.0, 7.6), ("clip", "c10-results-followup", 10.0, 16.4)],
    27: [("clip", "c11-agents", 1.5, 9.1)],
    28: [("anim", "TECH-1")],
    29: [("anim", "TECH-2")],
    30: [("anim", "HANDOFF-4")],
    31: [("clip", "c12-northgate", 2.5, 12.9)],
    32: [("anim", "CLOSE-1")],
    33: [("anim", "CLOSE-2")],
}
LOGO_IN_CLOSE = 105

shots, at, marks = [], 2 * BEAT, {}
prev_part = None
for i in sorted(PLAN):
    line = lines[i]
    if prev_part and line["part"] != prev_part:
        at += PART_GAP
    prev_part = line["part"]
    vo = round(line["sec"] * FPS)
    start = up(at, BEAT)
    if i == 7:
        start = up(at, BAR); marks["D1"] = start // BAR
    if i == 20:
        marks["BRK"] = up(at, BAR) // BAR
    if i == 23:
        marks["D2"] = up(at, BAR) // BAR
    if i == 32:
        marks["OUT"] = up(at, BAR) // BAR
    if i == 33:
        while (start + LOGO_IN_CLOSE) % BAR:
            start += BEAT
        marks["LOGO"] = (start + LOGO_IN_CLOSE) // BAR
    visuals = PLAN[i]
    # each visual's natural length: v2 scene length, or the clip segment at 1x
    nat = []
    for v in visuals:
        if v[0] == "anim":
            nat.append(v2[v[1]])
        elif v[0] in ("clip", "phone"):
            end = v[3] if v[3] is not None else clip_len(v[1])
            nat.append(round((end - v[2]) * FPS))
        else:
            nat.append({"Gates": 150, "Stages": 90, "proposal": 150}[v[1]])
    total = max(vo + GAP, sum(nat))
    # split the line's time across its visuals in proportion to their natural length
    t = start
    for k, (v, n) in enumerate(zip(visuals, nat)):
        d = round(total * n / sum(nat)) if k < len(visuals) - 1 else start + total - t
        if v[0] == "anim":
            d = max(d, v2[v[1]] if len(visuals) == 1 else d)
        row = dict(line=i, kind=v[0], name=v[1], start=t, dur=d, vo=vo if k == 0 else 0, part=line["part"])
        if v[0] in ("clip", "phone"):
            row["from"], row["to"] = v[2], (v[3] if v[3] is not None else clip_len(v[1]))
        shots.append(row)
        t += d
    at = t

end = shots[-1]["start"] + shots[-1]["dur"]
total = up(max(end, shots[-1]["start"] + LOGO_IN_CLOSE + 3 * BAR), BAR)
shots[-1]["dur"] = total - shots[-1]["start"]
json.dump(dict(fps=FPS, total=total, marks=marks, shots=shots), open("src/v3/timeline.json", "w"), indent=1)
print(f"total {total} frames = {total/FPS/60:.0f}:{total/FPS%60:04.1f}", "bars", total // BAR, marks)
