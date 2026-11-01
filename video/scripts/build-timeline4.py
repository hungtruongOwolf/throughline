"""Lays out the film (v4): one shot per voice line, at natural speed, every shot crossfading into the next.

Animated lines use the v4 scenes, which pace themselves to the line, so they are never cut or frozen.
Product lines play the real recordings at 1x for at least the length of their segment.
Shots overlap by OV frames (the crossfade); each voice starts LEAD frames into its shot.
Writes src/v4/timeline.json.
"""
import json, math

FPS = 30
OV, LEAD = 12, 8  # crossfade length, and where the voice starts inside its shot
TAIL = 22  # frames of picture after a line ends (the next shot's crossfade eats OV of them)
PART_GAP = 14  # extra air between parts

lines = {x["id"]: x for x in json.load(open("narration4.json", encoding="utf-8"))}
clip_len = lambda name: json.load(open(f"public/demo/{name}.json"))["duration"]

# line -> visuals. v4: a v4 scene (by line); v2: a v2 scene that stretches to the shot;
# new: a v3 scene; clip/phone: a recording [from, to] seconds.
PLAN = {
    **{i: [("v4", str(i))] for i in (1, 2, 3, 4, 5, 6, 7, 8, 28, 29, 30, 32, 33)},
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
    19: [("v2", "DAY-2")],
    20: [("clip", "c06-today-approve", 5.0, 13.5)],
    21: [("v2", "DAY-4")],
    22: [("clip", "c06-today-approve", 13.5, 21.0), ("phone", "c07-maria-changed", 0.0, 6.0)],
    23: [("clip", "c08-sign-summary", 0.0, 4.5)],
    24: [("clip", "c08-sign-summary", 4.5, 12.2)],
    25: [("clip", "c09-nurse-task", 0.5, 7.0)],
    26: [("clip", "c10-results-followup", 2.0, 7.6), ("clip", "c10-results-followup", 10.0, 16.4)],
    27: [("clip", "c11-agents", 1.5, 9.1)],
    31: [("clip", "c12-northgate", 2.5, 12.9)],
}
# frames a scene needs beyond its voice (the end card, the logo)
EXTRA = {8: 10, 10: 6, 33: 150}
# the least a scene needs to play out
MIN = {"Gates": 150, "Stages": 75, "DAY-2": 150, "DAY-4": 170}

shots, at, prev = [], 0, None
for i in sorted(PLAN):
    line = lines[i]
    if prev and line["part"] != prev:
        at += PART_GAP
    prev = line["part"]
    vo = round(line["sec"] * FPS)
    need = LEAD + vo + TAIL + EXTRA.get(i, 0)
    visuals = PLAN[i]
    nat = []
    for v in visuals:
        if v[0] in ("clip", "phone"):
            end = v[3] if v[3] is not None else clip_len(v[1])
            nat.append(round((end - v[2]) * FPS) + OV)
        else:
            nat.append(MIN.get(v[1], 0))
    total = max(need, sum(nat))
    t = at
    for k, (v, n) in enumerate(zip(visuals, nat)):
        d = round(total * n / sum(nat)) if len(visuals) > 1 and k < len(visuals) - 1 else at + total - t
        row = dict(line=i, kind=v[0], name=v[1], start=t, dur=d, vo=vo if k == 0 else 0, part=line["part"])
        if v[0] in ("clip", "phone"):
            row["from"], row["to"] = v[2], (v[3] if v[3] is not None else clip_len(v[1]))
        shots.append(row)
        t += d - OV
    at = t

total = shots[-1]["start"] + shots[-1]["dur"]
json.dump(dict(fps=FPS, total=total, ov=OV, lead=LEAD, shots=shots), open("src/v4/timeline.json", "w"), indent=1)
print(f"total {total} frames = {total // FPS // 60}:{total / FPS % 60:04.1f}")
