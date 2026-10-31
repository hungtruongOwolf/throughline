import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

test.describe("patient phone, visit day (D2-6)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ request }) => {
    const res = await request.post("http://localhost:4000/api/demo/visit-day");
    expect(res.ok()).toBe(true);
  });

  test("shows the current stop large, in Maria's language, with no serious axe issues", async ({
    page,
  }) => {
    await page.goto("/p/maria-001");
    await expect(page.getByRole("heading", { name: "Lab Draw" })).toBeVisible();
    await expect(page.getByText("personas antes que usted")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hablar con una persona" })).toBeInViewport();
    await expect(page.locator("html [lang=es]").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SCREENS}patient-visit-390.png` });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });

  test("opens directions as a sheet with numbered steps, wheelchair route by elevator", async ({
    page,
  }) => {
    await page.goto("/p/maria-001");
    await page.getByRole("button", { name: "Muéstreme el camino" }).click();
    const sheet = page.getByRole("dialog", { name: /Cómo llegar a Lab Draw/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("listitem").first()).toBeVisible();
    await expect(sheet.getByText(/Tome el Elevator A al piso 1/)).toBeVisible();
    await expect(sheet.getByRole("listitem")).toHaveCount(3);
    await page.screenshot({ path: `${SCREENS}patient-directions-390.png` });
    const axe = await new AxeBuilder({ page }).include("dialog").analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("switches language and reaches a person", async ({ page }) => {
    await page.goto("/p/maria-001");
    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.getByText("people ahead")).toBeVisible();
    await page.getByRole("button", { name: "Talk to a person" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "A person from the clinic will call you soon.",
    );
  });
});
