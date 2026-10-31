import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

/** Tabs until the focused element is the button with this exact name. */
async function tabTo(page: Page, name: string) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    if (focused === name) return;
  }
  throw new Error(`could not tab to ${name}`);
}

test.describe("station board (D2-7)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ request }) => {
    expect((await request.post("http://localhost:4000/api/demo/visit-day")).ok()).toBe(true);
  });

  test("dark board with initials only, simulated rows labeled, no serious axe issues", async ({
    page,
  }) => {
    await page.goto("/board/lab_draw");
    await expect(page.getByRole("heading", { name: "Lab draw" })).toBeVisible();
    const maria = page.getByRole("row", { name: /M\. D\./ });
    await expect(maria).toContainText("waiting here");
    await expect(page.getByRole("row", { name: /sim/ }).first()).toBeVisible();
    await expect(page.getByText("Maria")).toHaveCount(0);
    await expect(page.getByText("Counts and grey rows come from the simulation.")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SCREENS}board-lab-1280.png` });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });

  test("keyboard only: Start then Done moves the patient on", async ({ page }) => {
    await page.goto("/board/lab_draw");
    await expect(page.getByRole("row", { name: /M\. D\./ })).toBeVisible();
    await tabTo(page, "Start");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("row", { name: /M\. D\./ })).toContainText("in Lab Draw");
    await tabTo(page, "Done");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("row", { name: /M\. D\./ })).toHaveCount(0);
    await page.goto("/board/vitals");
    await expect(page.getByRole("row", { name: /M\. D\./ })).toContainText("walking from Lab draw");
  });

  test("a missed arrival becomes a held task row, never a modal", async ({ page }) => {
    // Finish Maria's lab draw so she is walking to vitals, then mark her as not arrived there.
    await page.request.post("http://localhost:4000/api/stations/lab_draw/actions", {
      data: { action: "done", journey_id: "maria-001", order_id: "o-cbc" },
    });
    await page.goto("/board/vitals");
    await page.getByRole("button", { name: "Didn't arrive" }).click();
    await expect(page.getByText("Ticket 3811 did not arrive")).toBeVisible();
    await expect(page.getByRole("row", { name: /M\. D\./ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send help" })).toBeInViewport();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: `${SCREENS}board-vitals-task-1280.png` });
  });
});
