import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

test.describe("patient phone, visit day", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ request }) => {
    const res = await request.post("http://localhost:4000/api/demo/visit-day");
    expect(res.ok()).toBe(true);
  });

  test("shows the current stop as the Now card, with no serious axe issues", async ({ page }) => {
    await page.goto("/p/maria-001");
    await expect(page.getByRole("tab", { name: "Visit day" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Lab Draw" })).toBeVisible();
    await expect(page.getByText("Ahead of you")).toBeVisible();
    await expect(page.getByRole("button", { name: "Talk to a person" })).toBeInViewport();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SCREENS}patient-visit-390.png` });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });

  test("opens step-free directions with a floor map and landmark steps", async ({ page }) => {
    await page.goto("/p/maria-001");
    await page.getByRole("button", { name: "Directions" }).click();
    const sheet = page.getByRole("dialog", { name: "Directions" });
    await expect(sheet.getByRole("heading", { name: "To Lab Draw" })).toBeVisible();
    await expect(sheet.getByRole("img", { name: /floor plan/ })).toBeVisible();
    await expect(sheet.getByText(/Take Elevator A down to Level 1/)).toBeVisible();
    await expect(sheet.getByText(/You have arrived at/)).toBeVisible();
    await page.screenshot({ path: `${SCREENS}patient-directions-390.png` });
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("reaches a person", async ({ page }) => {
    await page.goto("/p/maria-001");
    await page.getByRole("button", { name: "Talk to a person" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "A person from the clinic will call you soon.",
    );
  });
});
