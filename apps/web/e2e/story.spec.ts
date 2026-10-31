import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

test.describe("Maria's journey, step by step", () => {
  test("starts at the fax, and each action moves the same journey on", async ({ page }) => {
    await page.goto("/story");
    await expect(page.getByRole("heading", { name: "A referral arrives" })).toBeVisible();
    await expect(page.getByText("LHP-883201- (unreadable)")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SCREENS}story-fax.png` });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );

    await page.getByRole("button", { name: "Save member ID" }).click();
    await expect(
      page.getByRole("heading", { name: "Approve the insurance request" }),
    ).toBeVisible();
    await expect(page.getByText("Waiting for you")).toBeVisible();
    await page.getByRole("button", { name: "Send to Lonestar Health Plan" }).click();
    await page.getByRole("button", { name: "Continue to Thu, Nov 12" }).click();
    await expect(page.getByRole("heading", { name: "Maria confirms" })).toBeVisible();
    await expect(page.getByText(/Please confirm your visit: Tuesday, November 17/)).toBeVisible();
    await expect(page).toHaveURL(/step=confirm/);
  });

  test("the manager's approval changes Maria's plan", async ({ page }) => {
    await page.goto("/story?step=decide");
    await expect(page.getByRole("heading", { name: "A manager decides" })).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Her plan changes" })).toBeVisible();
    await expect(page.getByRole("status").getByText("Your plan changed")).toBeVisible();
    await page.screenshot({ path: `${SCREENS}story-changed.png`, fullPage: true });
  });
});
