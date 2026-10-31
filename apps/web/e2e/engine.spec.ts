import { expect, test } from "@playwright/test";

test("the Rust engine runs as WASM in the browser", async ({ page }) => {
  await page.goto("/dev/engine");
  await expect(page.getByTestId("engine-version")).toContainText("rust-wasm 0.1.0");
  await expect(page.getByTestId("seconds-walking")).toHaveText("155");
  await expect(page.getByTestId("seconds-wheelchair")).toHaveText("229");
});
