// Renders stills of compositions without re-bundling for each one.
//   node scripts/preview.mjs <compositionId> <frame,frame,...> [outDir] [scale]
// Writes <outDir>/<compositionId>-<frame>.jpg and a contact sheet <outDir>/<compositionId>-sheet.jpg.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const [id, framesArg, outDir = "out/preview", scaleArg = "0.5"] = process.argv.slice(2);
if (!id || !framesArg) {
  console.error("usage: node scripts/preview.mjs <compositionId> <frames> [outDir] [scale]");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id });
const frames = framesArg === "spread"
  ? Array.from({ length: 8 }, (_, i) => Math.round(((i + 0.5) / 8) * (composition.durationInFrames - 1)))
  : framesArg.split(",").map(Number);
const files = [];
for (const frame of frames) {
  const output = path.join(outDir, `${id}-${frame}.jpg`);
  await renderStill({ serveUrl, composition, frame, output, scale: Number(scaleArg), imageFormat: "jpeg" });
  files.push(output);
}
if (files.length > 1) {
  const cols = Math.min(4, files.length);
  const args = files.flatMap((f) => ["-i", f]);
  const n = files.length;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", ...args,
    "-filter_complex", `${files.map((_, i) => `[${i}]scale=640:-1[v${i}]`).join(";")};${files.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${n}:layout=${files.map((_, i) => `${(i % cols) * 640}_${Math.floor(i / cols) * 360}`).join("|")}:fill=white`,
    path.join(outDir, `${id}-sheet.jpg`),
  ]);
}
console.log("wrote", files.length, "stills to", outDir, "frames", frames.join(","));
