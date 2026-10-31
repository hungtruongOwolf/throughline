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

  test("after the visit: the doctor approves the summary, and the loop closes", async ({
    page,
  }) => {
    await page.goto("/story?step=review");
    await expect(
      page.getByRole("heading", { name: "The doctor checks the summary" }),
    ).toBeVisible();
    await expect(page.getByText("What we did today, as written")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SCREENS}story-review.png`, fullPage: true });
    await page.getByRole("button", { name: "Approve and send" }).click();
    await expect(page.getByRole("heading", { name: "Did it make sense?" })).toBeVisible();
    await expect(page.getByText("Checked by Dr. Okafor.")).toBeVisible();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("heading", { name: "A check-in" })).toBeVisible();
    await expect(
      page.getByText("Thank you. A nurse will call you to go over who to call."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Referral closed" })).toBeVisible();
    await expect(page.getByText("Nurse call after the teach-back")).toBeVisible();
    await page.screenshot({ path: `${SCREENS}story-closed.png`, fullPage: true });
  });
});
