// Visual audit: desktop and phone screenshots of every surface, including a fresh visit request.
import { chromium } from "@playwright/test";
const out = process.argv[2];
const base = process.env.BASE ?? "http://localhost:3000";
const rt = process.env.RT ?? "http://localhost:4000";
const browser = await chromium.launch();
const req = await (
  await fetch(`${rt}/api/visit-requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      service: "new_patient",
      referral_fax: "ref-1043",
      patient: {
        name: "Lionel Ferreira",
        dob: "1948-11-27",
        phone: "+1 555 0143",
        mobility: "walking",
        companion: true,
      },
      member_id: "LHP-740517-04",
      days: [
        { date: "2026-11-19", part: "morning" },
        { date: "2026-11-20", part: "any" },
      ],
    }),
  })
).json();
for (const [name, vp] of [
  ["desk", { width: 1440, height: 900 }],
  ["phone", { width: 390, height: 844 }],
]) {
  const ctx = await browser.newContext({ viewport: vp });
  await ctx.addInitScript(() => {
    if (location.pathname !== "/") localStorage.setItem("tl_user", "sam");
  });
  const page = await ctx.newPage();
  for (const path of ["/", "/today", `/p/${req.id}`, "/p/maria-001", "/referrals", "/inbox"]) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: `${out}/audit-${name}${path.replaceAll("/", "_")}.png`,
      fullPage: name === "phone",
    });
  }
  await ctx.close();
}
console.log("ok", req.id);
await browser.close();
