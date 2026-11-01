// Measures each narration paragraph so scenes take their length from the voice.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const paras = JSON.parse(readFileSync("narration.json", "utf8"));
const out = {};
for (const p of paras) {
  const id = `p${String(p.id).padStart(2, "0")}`;
  out[id] = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `public/audio/vo/${id}.wav`])
      .toString()
      .trim(),
  );
}
writeFileSync("src/timing.json", JSON.stringify(out, null, 1));
console.log(Object.values(out).reduce((a, b) => a + b, 0).toFixed(1), "s of narration");
