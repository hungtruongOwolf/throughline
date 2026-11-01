// Records the demo walk-through, each section lasting as long as its narration.
//   VIDEO_DIR=<dir with segments.json and sN.wav> BASE=http://localhost:3000 node scripts/record-video.mjs
// Writes <dir>/raw.webm and <dir>/timeline.json (when each section really started).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, renameSync } from "node:fs";
import { chromium } from "@playwright/test";

const dir = process.env.VIDEO_DIR;
const base = process.env.BASE ?? "http://localhost:3000";
const api = "http://localhost:4000";
const segs = JSON.parse(readFileSync(`${dir}/segments.json`, "utf8"));
const dur = Object.fromEntries(
  segs.map((g) => [
    g.id,
    Number(
      execFileSync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        `${dir}/s${g.id}.wav`,
      ])
        .toString()
        .trim(),
    ) * 1000,
  ]),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir, size: { width: 1280, height: 720 } },
});
await context.addInitScript(() => {
  const p = location.pathname;
  if (p !== "/") window.localStorage.setItem("tl_user", p.startsWith("/today") ? "sam" : "jordan");
  // A visible pointer, since screen recordings of a headless browser have none.
  window.addEventListener("DOMContentLoaded", () => {
    const dot = document.createElement("div");
    dot.style.cssText =
      "position:fixed;z-index:99999;width:18px;height:18px;border-radius:50%;background:rgba(15,118,110,.55);border:2px solid #fff;pointer-events:none;transform:translate(-50%,-50%);left:-40px;top:-40px;transition:left .12s,top .12s";
    document.body.appendChild(dot);
    window.addEventListener("mousemove", (e) => {
      dot.style.left = e.clientX + "px";
      dot.style.top = e.clientY + "px";
    });
  });
});
const created = Date.now();
const page = await context.newPage();
const marks = {};

const step = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.log("  step skipped:", label, String(e.message).split("\n")[0]);
  }
};
const go = (path) => page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 60000 });
const click = (locator) => locator.click({ timeout: 6000 });
const scroll = async (dy, steps = 8, gap = 350) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(gap);
  }
};
const clock = (minutes) =>
  fetch(`${api}/api/clock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "advance", minutes }),
  });

/** Runs the actions of a section at fractions of its narration, then waits out the rest. */
async function section(id, actions) {
  const start = Date.now();
  marks[id] = start - created;
  console.log("section", id, Math.round(dur[id] / 1000) + "s");
  for (const [frac, label, fn] of actions) {
    await sleep(start + frac * dur[id] - Date.now());
    await step(label, fn);
  }
  await sleep(start + dur[id] + 600 - Date.now());
}

await go("/");
await sleep(1200);

// 1. The problem: the hospital turning on the front door.
await section(1, [[0.0, "front", async () => page.mouse.move(900, 400)]]);

// 2. Maria and the idea: staff and patient doors.
await section(2, [
  [0.1, "hover staff", async () => page.mouse.move(1000, 300, { steps: 12 })],
  [0.5, "hover patient", async () => page.mouse.move(1000, 560, { steps: 12 })],
]);

// 3. Before the visit: a fax arrives and the agents work it; a person answers and approves.
await section(3, [
  [0.02, "referrals", () => go("/referrals")],
  [0.08, "new referral", () => click(page.getByRole("button", { name: "New referral" }))],
  [0.16, "receive", () => click(page.getByRole("button", { name: "Receive referral" }))],
  [0.3, "timeline", async () => scroll(500, 5, 500)],
  [0.42, "inbox", () => go("/inbox")],
  [
    0.47,
    "open question",
    () => click(page.getByRole("button", { name: /Answer an intake question/ }).first()),
  ],
  [0.55, "fill card", () => click(page.getByRole("button", { name: "Fill from insurance card" }))],
  [0.62, "send", () => click(page.getByRole("button", { name: "Send answer" }))],
  [0.72, "open approval", () => go("/inbox")],
  [
    0.77,
    "approval item",
    () => click(page.getByRole("button", { name: /Approve insurance submission/ }).first()),
  ],
  [0.88, "approve", () => click(page.getByRole("button", { name: /Approve and submit/ }))],
]);
await clock(180);

// 4. The visit day: CT is down, the planner proposes, a person approves, the patient hears.
await section(4, [
  [0.0, "today", () => go("/today")],
  [0.35, "hover ct", async () => page.mouse.move(640, 380, { steps: 20 })],
  [0.58, "approve", () => click(page.getByRole("button", { name: "Approve" }).first())],
  [0.74, "patient app", () => go("/p/maria-001")],
  [0.84, "scroll plan", async () => scroll(700, 6, 500)],
]);

// 5. After the visit: the record's timeline.
await section(5, [
  [0.0, "record", () => go("/patients/maria-001")],
  [0.3, "scroll", async () => scroll(1400, 10, 350)],
]);

// 6. The models and more than one hospital.
await section(6, [
  [0.0, "agents", () => go("/agents")],
  [0.3, "ops row", () => click(page.getByRole("row", { name: /Ops planner/ }))],
  [0.58, "front", () => go("/")],
  [0.72, "northgate", () => click(page.getByRole("radio", { name: /Northgate/ }))],
]);

// 7. Close.
await section(7, [[0.0, "today northgate", () => go("/today")]]);

await sleep(800);
await context.close();
const file = readdirSync(dir).find((f) => f.endsWith(".webm") && f !== "raw.webm");
if (file) renameSync(`${dir}/${file}`, `${dir}/raw.webm`);
writeFileSync(`${dir}/timeline.json`, JSON.stringify({ marks, dur }, null, 1));
await browser.close();
console.log("done", marks);
