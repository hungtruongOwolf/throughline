// Captures the real product shots the film cuts to: sharp 2x stills for states, short videos
// only where motion is the proof. Needs the app running locally (runtime :4000 in replay mode,
// web :3000). Usage: node scripts/capture.mjs [stills|r2|r12]
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const BASE = "http://localhost:3000";
const OUT = fileURLToPath(new URL("../public/clips/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const what = process.argv[2] ?? "stills";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const prep = (user, hospital = "halden") => `
  localStorage.setItem("tl_user", ${JSON.stringify(user)});
  localStorage.setItem("tl_started", JSON.stringify({ done: [], hidden: true }));
  localStorage.setItem("throughline.hospital", ${JSON.stringify(hospital)});
`;

async function stills() {
  const browser = await chromium.launch();
  const desk = async (user) => {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(prep(user));
    return ctx.newPage();
  };
  // Jordan answers the intake question from the card.
  let p = await desk("jordan");
  await p.goto(`${BASE}/inbox`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: /Answer an intake question/ }).first().click();
  await p.getByRole("button", { name: "Fill from insurance card" }).click();
  await sleep(600);
  await p.screenshot({ path: `${OUT}inbox-question.png` });
  // The prior authorization draft, waiting for Jordan.
  await p.getByRole("button", { name: /Approve insurance submission/ }).first().click();
  await sleep(800);
  await p.screenshot({ path: `${OUT}prior-auth.png` });
  await p.context().close();
  // The planner's proposal on Today, the panel only.
  p = await desk("sam");
  await p.goto(`${BASE}/today`, { waitUntil: "networkidle" });
  await sleep(1500);
  await p.locator("aside").first().screenshot({ path: `${OUT}proposal.png` });
  await p.getByRole("button", { name: "Approve" }).first().click();
  await sleep(2500);
  await p.context().close();
  // Maria's phone after the change.
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  await phone.addInitScript(prep("jordan"));
  p = await phone.newPage();
  await p.goto(`${BASE}/p/maria-001`, { waitUntil: "networkidle" });
  await sleep(1200);
  await p.screenshot({ path: `${OUT}phone-plan.png` });
  await phone.close();
  // The agents roster with its models.
  p = await desk("jordan");
  await p.goto(`${BASE}/agents`, { waitUntil: "networkidle" });
  await sleep(800);
  await p.screenshot({ path: `${OUT}agents.png` });
  await p.context().close();
  await browser.close();
}

async function record(name, { headed = false, size, user, hospital, run }) {
  const browser = await chromium.launch({
    headless: !headed,
    args: headed ? ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--force-device-scale-factor=1"] : [],
  });
  const tmp = `${OUT}tmp-${name}/`;
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: tmp, size } });
  await ctx.addInitScript(prep(user, hospital));
  const p = await ctx.newPage();
  await run(p);
  await ctx.close();
  await browser.close();
  const file = readdirSync(tmp).find((f) => f.endsWith(".webm"));
  renameSync(`${tmp}${file}`, `${OUT}${name}.webm`);
  rmSync(tmp, { recursive: true, force: true });
}

if (what === "stills") await stills();
if (what === "r2")
  // A fax arrives and the agents work it with nobody clicking.
  await record("r2", {
    size: { width: 1600, height: 900 },
    user: "jordan",
    run: async (p) => {
      await p.goto(`${BASE}/referrals`, { waitUntil: "networkidle" });
      await p.getByRole("button", { name: "New referral" }).click();
      await sleep(800);
      await p.getByRole("button", { name: "Receive referral" }).click();
      await p.waitForURL(/\/patients\//, { timeout: 30000 });
      await sleep(14000);
    },
  });
if (what === "r12")
  // Northgate's campus turning, rendered on the GPU.
  await record("r12", {
    headed: true,
    size: { width: 1920, height: 1080 },
    user: "sam",
    hospital: "northgate",
    run: async (p) => {
      await p.goto(`${BASE}/today?hospital=northgate`, { waitUntil: "networkidle" });
      await sleep(14000);
    },
  });
console.log("captured", what);
