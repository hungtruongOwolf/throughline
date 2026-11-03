"""Lays out the film (v5): one shot per voice line, at natural speed, every shot crossfading into the next.

Animated lines use the v5 scenes, which pace themselves to the line, so they are never cut or frozen.
Product lines play the real recordings at 1x for at least the length of their segment.
Shots overlap by OV frames (the crossfade); each voice starts LEAD frames into its shot.
Line ids follow the first script, so the camera framing and agent cards keyed by line still apply.
Writes src/v5/timeline.json.
"""
import json

FPS = 30
OV, LEAD = 12, 8  # crossfade length, and where the voice starts inside its shot
TAIL = 30  # frames of picture after a line ends (the next shot's crossfade eats OV of them)
PART_GAP = 24  # extra air between parts

lines = {x["id"]: x for x in json.load(open("narration7.json", encoding="utf-8"))}
clip_len = lambda name: json.load(open(f"public/demo/{name}.json"))["duration"]

# line -> visuals. v5: a v5 scene by name; v2: a v2 scene that stretches to the shot;
# clip/phone: a recording [from, to] seconds, and optionally whose camera framing to use.
PLAN = {
    1: [("v5", "Arrival")],
    3: [("v5", "Family")],
    5: [("v5", "Stats")],
    8: [("v5", "Product")],
    9: [("v5", "Flow")],
    11: [("clip", "c01-fax-arrives", 2.5, 8.4)],
    12: [("clip", "c01-fax-arrives", 9.5, 13.0), ("clip", "c02-answer", 4.0, 12.5, "13")],
    14: [("clip", "c04-approve-auth", 0.5, 11.8, "15")],
    16: [("phone", "c05-maria-phone", 0.0, 12.5)],
    18: [("clip", "c06-today-approve", 0.0, 6.5)],
    19: [("v2", "DAY-2")],
    20: [("clip", "c06-today-approve", 6.5, 12.0), ("v2", "DAY-4")],
    22: [("clip", "c06-today-approve", 13.5, 21.0), ("phone", "c07-maria-changed", 0.0, 6.0)],
    24: [("clip", "c08-sign-summary", 4.5, 12.2)],
    25: [("clip", "c09-nurse-task", 0.5, 7.0)],
    26: [("clip", "c10-results-followup", 2.0, 6.0), ("clip", "c10-results-followup", 10.0, 14.0)],
    28: [("v5", "Hood")],
    31: [("clip", "c12-northgate", 3.0, 9.5)],
    32: [("v5", "Found")],
    33: [("v5", "Impact")],
}
# frames a scene needs beyond its voice (the end card)
EXTRA = {33: 110}
# the least a scene needs to play out
MIN = {"DAY-2": 130, "DAY-4": 170}

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
            nat.append(round((v[3] - v[2]) * FPS) + OV)
        else:
            nat.append(MIN.get(v[1], 0))
    total = max(need, sum(nat))
    t = at
    for k, (v, n) in enumerate(zip(visuals, nat)):
        last = k == len(visuals) - 1
        d = at + total - t if last else round(total * n / sum(nat))
        row = dict(line=i, kind=v[0], name=v[1], start=t, dur=d, vo=vo if k == 0 else 0, part=line["part"])
        if v[0] in ("clip", "phone"):
            row["from"], row["to"] = v[2], v[3]
            if len(v) > 4:
                row["focus"] = v[4]  # the camera framing of the line this recording first played under
        shots.append(row)
        t += d - OV
    at = t

total = shots[-1]["start"] + shots[-1]["dur"]
json.dump(dict(fps=FPS, total=total, ov=OV, lead=LEAD, shots=shots), open("src/v5/timeline.json", "w"), indent=1)
print(f"total {total} frames = {total // FPS // 60}:{total / FPS % 60:04.1f}")
