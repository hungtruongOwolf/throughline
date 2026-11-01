// Records real product footage at real speed (1x) with sharp frames.
// Frames come straight from Chrome's screencast (JPEG quality 92) with their own timestamps,
// then ffmpeg lays them on a constant 30 fps timeline, so nothing is sped up or slowed down.
// A drawn cursor shows every move and click. Needs the app running locally (runtime :4000 in
// replay mode, web :3000).
//   node scripts/record-demo.mjs [clipName ...]      (no names = all clips, in story order)
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CLIPS } from "./demo-clips.mjs";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const OUT = fileURLToPath(new URL("../public/demo/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE ?? "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CURSOR = `
(() => {
  if (window.__cursor) return; window.__cursor = 1;
  const add = () => {
    const c = document.createElement("div");
    c.id = "__cursor";
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#18223a" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    c.style.cssText = "position:fixed;left:-50px;top:-50px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))";
    document.body.appendChild(c);
    const ring = document.createElement("div");
    ring.style.cssText = "position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #0f766e;opacity:0;transform:scale(.4);transition:transform .35s ease-out,opacity .45s ease-out";
    document.body.appendChild(ring);
    window.addEventListener("mousemove", (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; }, true);
    window.addEventListener("mousedown", (e) => {
      ring.style.transition = "none"; ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px";
      ring.style.opacity = "1"; ring.style.transform = "scale(.4)";
      requestAnimationFrame(() => { ring.style.transition = "transform .35s ease-out,opacity .45s ease-out"; ring.style.opacity = "0"; ring.style.transform = "scale(1.3)"; });
    }, true);
  };
  if (document.body) add(); else window.addEventListener("DOMContentLoaded", add);
})();`;

async function recordClip(browser, clip) {
  const size = clip.phone ? { width: 430, height: 932 } : { width: 1920, height: 1080 };
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: clip.phone ? 3 : 1, isMobile: !!clip.phone, hasTouch: !!clip.phone });
  await ctx.addInitScript(`
    localStorage.setItem("tl_user", ${JSON.stringify(clip.user ?? "jordan")});
    localStorage.setItem("tl_started", JSON.stringify({ done: [], hidden: true }));
    localStorage.setItem("throughline.hospital", ${JSON.stringify(clip.hospital ?? "halden")});
  `);
  await ctx.addInitScript(CURSOR);
  // The app at 125%: larger type on a native 1080p frame (screencast frames are in CSS pixels).
  if (!clip.phone)
    await ctx.addInitScript(`document.addEventListener("DOMContentLoaded", () => { document.documentElement.style.zoom = "1.25"; });`);
  const page = await ctx.newPage();
  const dir = `${OUT}${clip.name}-frames/`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // Load the first page before recording, so the clip opens on a finished screen.
  if (clip.open) await page.goto(`${BASE}${clip.open}`, { waitUntil: "networkidle" });
  await page.mouse.move(size.width * 0.62, size.height * 0.55);
  await sleep(clip.settle ?? 1200);

  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const marks = {};
  // screencast timestamps are wall-clock seconds, like Date.now()
  const t0 = Date.now() / 1000;
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const n = frames.length;
    const file = `${dir}${String(n).padStart(5, "0")}.jpg`;
    writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
  });
  const max = clip.phone ? { maxWidth: 1290, maxHeight: 2796 } : { maxWidth: 1920, maxHeight: 1080 };
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1, ...max });
  const mark = (name) => (marks[name] = Date.now() / 1000 - t0);
  // A tiny scripted performance: move like a person, pause to read, then act.
  const api = {
    page,
    sleep,
    mark,
    async to(locator, opts = {}) {
      const box = await locator.boundingBox();
      if (!box) throw new Error("not on screen: " + locator);
      const x = box.x + box.width * (opts.fx ?? 0.5);
      const y = box.y + box.height * (opts.fy ?? 0.5);
      await page.mouse.move(x, y, { steps: opts.steps ?? 28 });
      return { x, y };
    },
    async click(locator, opts = {}) {
      await locator.scrollIntoViewIfNeeded().catch(() => undefined);
      await api.to(locator, opts);
      await sleep(opts.pause ?? 350);
      await locator.click();
    },
    async scroll(dy, steps = 20, gap = 30) {
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy / steps);
        await sleep(gap);
      }
    },
  };
  await sleep(300);
  await clip.run(api);
  await sleep(clip.tail ?? 800);
  const stopped = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await sleep(300);
  await ctx.close();

  // Lay the frames on a real-time timeline: each frame lasts until the next one arrived.
  const list = frames
    .map((fr, i) => {
      // the last frame holds until recording stopped (a still screen sends no new frames)
      const next = frames[i + 1]?.t ?? Math.max(fr.t + 0.04, stopped);
      return `file '${fr.file.replace(/\\/g, "/")}'\nduration ${(next - fr.t).toFixed(4)}`;
    })
    .join("\n");
  const listFile = `${dir}list.txt`;
  writeFileSync(listFile, list + `\nfile '${frames.at(-1).file.replace(/\\/g, "/")}'\n`);
  const out = `${OUT}${clip.name}.mp4`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile,
    "-vf", "fps=30,format=yuv420p" + (clip.phone ? ",scale=1290:-2" : ""),
    "-c:v", "libx264", "-crf", "14", "-preset", "medium", out,
  ]);
  const start = frames[0].t;
  // marks are seconds into the clip, on the same clock as the frames
  const shift = start - t0;
  const at = Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, +(v - shift).toFixed(3)]));
  writeFileSync(`${OUT}${clip.name}.json`, JSON.stringify({ duration: stopped - start, marks: at }, null, 1));
  rmSync(dir, { recursive: true, force: true });
  console.log(`clip ${clip.name}: ${frames.length} frames, ${(stopped - start).toFixed(1)} s`, at);
}

const args = process.argv.slice(2);
const take = args[0] === "--take" ? args[1] : undefined;
const wanted = take ? [] : args;
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
let headed;
for (const clip of CLIPS) {
  if (take && clip.take !== take) continue;
  if (wanted.length && !wanted.includes(clip.name)) continue;
  // the 3D campus renders on the GPU in a visible window
  if (clip.headed)
    headed ??= await chromium.launch({
      headless: false,
      args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--force-device-scale-factor=1", "--window-size=1920,1160"],
    });
  try {
    await recordClip(clip.headed ? headed : browser, clip);
  } catch (e) {
    console.log(`clip ${clip.name} FAILED: ${String(e.message).split("\n")[0]}`);
  }
}
await browser.close();
await headed?.close();
