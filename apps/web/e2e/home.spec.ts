import { expect, test } from "@playwright/test";

test("home explains the product and starts Maria's journey", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "One thread through the whole hospital visit." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Follow Maria's journey" }).click();
  await expect(page.getByRole("heading", { name: "A referral arrives" })).toBeVisible();
});
