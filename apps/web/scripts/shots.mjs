// Screenshots of the staff platform for a visual check: node scripts/shots.mjs <outDir> [path...]
import { chromium } from "@playwright/test";

const [out, ...paths] = process.argv.slice(2);
const pages = paths.length
  ? paths
  : ["/", "/inbox", "/referrals", "/patients/maria-001", "/agents", "/today"];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => {
  if (location.pathname !== "/") window.localStorage.setItem("tl_user", "jordan");
});
const page = await context.newPage();
for (const path of pages) {
  await page.goto(`${process.env.BASE ?? "http://localhost:3000"}${path}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.waitForTimeout(2500);
  const name =
    path === "/" ? "home" : path.replace(/[^a-z0-9]+/gi, "_").replace(/^_/, "") || "home";
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  console.log("shot", path);
}
await browser.close();
