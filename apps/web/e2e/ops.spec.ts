import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

test.describe("command center (D2-8)", () => {
  test.use({ viewport: { width: 1536, height: 960 } });

  test.beforeEach(async ({ request }) => {
    expect(
      (await request.post("http://localhost:4000/api/demo/visit-day?beat=ct_outage")).ok(),
    ).toBe(true);
  });

  test("shows the CT outage proposal on the map view, held for a manager", async ({ page }) => {
    await page.goto("/ops");
    const proposal = page.getByRole("article", { name: /CT 2/ });
    await expect(proposal).toBeVisible();
    await expect(proposal.getByText("Held for a manager")).toBeVisible();
    await expect(page.getByText(/Predicted peak wait \d+ min/)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SCREENS}ops-1536.png` });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });

  test("approving re-plans Maria live: her phone swaps CT 1 for CT 2 over SSE", async ({
    page,
    context,
  }) => {
    const phone = await context.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto("/p/maria-001");
    await expect(phone.getByRole("heading", { name: "CT 1" })).toBeVisible();

    await page.goto("/ops");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved by manager.demo")).toBeVisible();

    // No reload: the phone hears ItineraryReplanned on the event stream.
    await expect(phone.getByRole("heading", { name: "CT 2" })).toBeVisible();
    await phone.screenshot({ path: `${SCREENS}patient-replanned-390.png` });
  });

  test("the what-if slider re-runs the simulation in the browser", async ({ page }) => {
    await page.goto("/ops");
    const status = page.getByRole("status").filter({ hasText: "Predicted peak wait" });
    await expect(status).toBeVisible();
    const before = await status.textContent();
    await page.getByLabel(/Extra servers at CT/).fill("2");
    await expect(status).not.toHaveText(before ?? "");
  });
});
