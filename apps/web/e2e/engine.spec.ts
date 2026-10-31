import { expect, test } from "@playwright/test";

test("the Rust engine runs as WASM in the browser", async ({ page }) => {
  await page.goto("/dev/engine");
  await expect(page.getByTestId("engine-version")).toContainText("rust-wasm 0.1.0");
  await expect(page.getByTestId("seconds-walking")).toHaveText("155");
  await expect(page.getByTestId("seconds-wheelchair")).toHaveText("229");
  // Spec 7.3: what-if 3 x 20 x 90 min under 400 ms in the browser (CI fails above 2x).
  const ms = Number(await page.getByTestId("whatif-ms").textContent());
  expect(ms).toBeLessThan(800);
  expect(Number(await page.getByTestId("ct-delta").textContent())).toBeGreaterThan(0);
});
