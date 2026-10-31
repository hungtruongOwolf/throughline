import { expect, test } from "@playwright/test";

test("home shows the synthetic data mark", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Synthetic demo data")).toBeVisible();
});
