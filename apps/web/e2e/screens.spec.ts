import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

// Spec 9.9 step 4/5: screenshots at the review viewports, committed to docs/screens.
test("component sheet screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 960 });
  await page.goto("/dev/components");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SCREENS}dev-components.png`, fullPage: true });
});
