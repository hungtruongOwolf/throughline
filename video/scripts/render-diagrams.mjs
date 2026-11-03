// Renders the README figures to docs/images: PNG stills, and the animated hero as a GIF.
//   node scripts/render-diagrams.mjs [id ...]
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const out = path.resolve("../docs/images");
mkdirSync(out, { recursive: true });
const all = ["problem", "journey", "architecture", "contract", "stats-us", "stats-world", "hero"];
const ids = process.argv.length > 2 ? process.argv.slice(2) : all;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const id of ids) {
  const composition = await selectComposition({ serveUrl, id: `D-${id}` });
  if (id === "hero") {
    const mp4 = path.resolve("out/hero.mp4");
    await renderMedia({ serveUrl, composition, codec: "h264", outputLocation: mp4 });
    // a two-pass palette keeps the gradients clean in 256 colors
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", mp4, "-vf", "fps=15,scale=900:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "-loop", "0", path.join(out, "hero.gif")]);
  } else {
    await renderStill({ serveUrl, composition, frame: 0, output: path.join(out, `${id}.png`), imageFormat: "png", scale: 1.25 });
  }
  console.log("wrote", id);
}
