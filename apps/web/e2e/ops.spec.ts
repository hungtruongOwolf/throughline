import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

test.describe("command center (D2-8)", () => {
  test.use({ viewport: { width: 1536, height: 960 } });

  test.beforeEach(async ({ request, context }) => {
    // The hospital as it opens: CT 1 down, and the planner has already moved patients to CT 2.
    expect((await request.post("http://localhost:4000/api/admin/restore")).ok()).toBe(true);
    await context.addInitScript(() => window.localStorage.setItem("tl_user", "sam"));
  });

  test("shows the CT fix the planner applied on its own, within policy", async ({ page }) => {
    await page.goto("/today");
    const proposal = page.getByRole("article", { name: /CT 2/ });
    await expect(proposal).toBeVisible();
    await expect(proposal.getByText(/Applied automatically, within policy/)).toBeVisible();
    await expect(page.getByText(/Predicted peak wait \d+ min/)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SCREENS}ops-1536.png` });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });

  test("the planner's change re-plans Maria: her phone already shows CT 2", async ({ context }) => {
    const phone = await context.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto("/p/maria-001");
    await expect(phone.getByRole("heading", { name: "CT 2" })).toBeVisible();
    await expect(phone.getByText("Your plan changed").first()).toBeVisible();
    await phone.screenshot({ path: `${SCREENS}patient-replanned-390.png` });
  });

  test("the what-if slider re-runs the simulation in the browser", async ({ page }) => {
    await page.goto("/today");
    const status = page.getByRole("status").filter({ hasText: "Predicted peak wait" });
    await expect(status).toBeVisible();
    const before = await status.textContent();
    await page.getByLabel(/Extra servers at CT/).fill("2");
    await expect(status).not.toHaveText(before ?? "");
  });
});
