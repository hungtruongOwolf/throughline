// A sharp still of a hospital's 3D campus (WebGL), cropped to the model.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const OUT = fileURLToPath(new URL("../public/clips/", import.meta.url));
const hospital = process.argv[2] ?? "northgate";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await ctx.addInitScript(`localStorage.setItem("tl_user","sam");localStorage.setItem("tl_started",JSON.stringify({done:[],hidden:true}));localStorage.setItem("throughline.hospital",${JSON.stringify(hospital)});`);
const p = await ctx.newPage();
await p.goto(`http://localhost:3000/today?hospital=${hospital}`, { waitUntil: "networkidle" });
await p.waitForTimeout(9000);
await p.locator("canvas").first().screenshot({ path: `${OUT}campus-${hospital}.png` });
await browser.close();
console.log("ok");
