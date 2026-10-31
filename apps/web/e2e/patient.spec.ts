import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

test.describe("patient portal", () => {
  test("visit day: one sentence for today, the current stop, and the day explained", async ({
    page,
    request,
  }) => {
    expect((await request.post("http://localhost:4000/api/demo/visit-day")).ok()).toBe(true);
    await page.goto("/p/maria-001");
    await expect(page.getByRole("button", { name: /Visit days/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("heading", { name: "You're at Lab Draw" })).toBeVisible();
    await expect(page.getByText(/appointments, about .* in all/)).toBeVisible();
    await expect(page.getByText(/A nurse takes a small sample of blood/)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SCREENS}patient-visit.png`, fullPage: true });
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
      [],
    );
  });

  test("before: the story of the setup, and confirming from the page", async ({
    page,
    request,
  }) => {
    const r = "http://localhost:4000";
    const json = (data: unknown) => ({ data });
    expect((await request.post(`${r}/api/demo/referral`)).ok()).toBe(true);
    await request.post(
      `${r}/api/journeys/maria-001/clarify`,
      json({ field: "member_id", value: "LHP-883201-02", by: "coordinator" }),
    );
    const reviews = (await (await request.get(`${r}/api/reviews`)).json()) as {
      id: string;
      status: string;
    }[];
    const held = reviews.find((x) => x.status === "pending");
    await request.post(
      `${r}/api/reviews/${held?.id}/resolve`,
      json({ decision: "approved", by: "coordinator" }),
    );
    await request.post(`${r}/api/clock`, json({ action: "advance", minutes: 2885 }));

    await page.goto("/p/maria-001");
    await expect(page.getByText("We received your referral")).toBeVisible();
    await expect(page.getByText(/Your insurer approved the CT scan/)).toBeVisible();
    await page.getByRole("button", { name: "Confirm my visits" }).click();
    await expect(page.getByRole("status")).toHaveText(/Confirmed/);
    await expect(page.getByText("You confirmed")).toBeVisible();
    await page.screenshot({ path: `${SCREENS}patient-before.png`, fullPage: true });
  });

  test("reaches a person", async ({ page, request }) => {
    await request.post("http://localhost:4000/api/demo/visit-day");
    await page.goto("/p/maria-001");
    await page.getByRole("button", { name: "Talk to a person" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "A person from the clinic will call you soon.",
    );
  });
});

test.describe("find your way", () => {
  test("step-free route with a floor plan and landmark steps", async ({ page }) => {
    await page.goto("/map");
    await expect(page.getByRole("heading", { name: "To Imaging" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Level 1 floor plan/ })).toBeVisible();
    await expect(page.getByText(/Take Elevator A up to Level 2/)).toBeVisible();
    await page.getByRole("button", { name: "Next step" }).click();
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(page.getByRole("img", { name: /Level 2 floor plan/ })).toBeVisible();
    await page.screenshot({ path: `${SCREENS}wayfinding.png` });
  });
});
