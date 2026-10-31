import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));

test.describe("Journey Control (D2-9)", () => {
  test.use({ viewport: { width: 1536, height: 960 } });

  test("plays the visit day from 09:12 to checkout without manual intervention", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    await page.goto("/journey/maria-001");
    await page.getByRole("button", { name: "Start the visit day" }).click();
    await request.post("http://localhost:4000/api/clock", {
      data: { action: "start", speed: 600 },
    });

    const timeline = page.getByRole("list", { name: "Today, 7:00 to 17:00" });
    await expect(timeline.getByText("CT 2")).toBeVisible();
    await expect(page.getByText(/Ops action approved/).first()).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENS}journey-control-1536.png` });

    await expect
      .poll(
        async () =>
          (
            (await (await request.get("http://localhost:4000/api/demo/scenario")).json()) as {
              done: boolean;
            }
          ).done,
        {
          timeout: 200_000,
          intervals: [2_000],
        },
      )
      .toBe(true);
    await request.post("http://localhost:4000/api/clock", { data: { action: "stop" } });
    const journey = (await (
      await request.get("http://localhost:4000/api/journeys/maria-001")
    ).json()) as {
      state: string;
      itinerary: { stops: { order_id: string; node_id: string }[] };
    };
    // Checkout hands over to the after-visit agents: follow-ups booked, summary drafted.
    expect(journey.state).toBe("SUMMARY_DRAFTED");
    expect(journey.itinerary.stops.find((s) => s.order_id === "o-ct")?.node_id).toBe("mp2.ct2");
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SCREENS}journey-control-done-1536.png` });
  });
});
