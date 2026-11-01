import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const SCREENS = fileURLToPath(new URL("../../../docs/screens/", import.meta.url));
const RUNTIME = "http://localhost:4000";

async function noSeriousAxe(page: Page) {
  // Rows fade in for 250 ms; check colors once they have settled.
  await page.waitForTimeout(400);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual(
    [],
  );
}

test.describe("the staff platform", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ request }) => {
    // Every test starts from the hospital as it opens on Nov 17 at 9:53 am.
    expect((await request.post(`${RUNTIME}/api/admin/restore`)).ok()).toBe(true);
  });

  test("the front door shows the hospital and signs a coordinator into their inbox", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Every referral, from the fax to the follow-up." }),
    ).toBeVisible();
    await expect(page.getByText(/people in the building, \d+ referrals in progress/)).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${SCREENS}platform-home.png` });
    await noSeriousAxe(page);

    await page.getByRole("button", { name: /Jordan Park/ }).click();
    await expect(page).toHaveURL(/\/inbox/);
    await expect(page.getByRole("heading", { name: "Approve insurance submission" })).toBeVisible();
    await expect(page.getByText("Draft: prior authorization request")).toBeVisible();
    await page.screenshot({ path: `${SCREENS}platform-inbox.png` });
    await noSeriousAxe(page);

    await page.getByRole("button", { name: "Approve and submit" }).click();
    await expect(page.getByText("Submitted to Lonestar Health Plan")).toBeVisible();
  });

  test("a fax from the fax line becomes a record the agents work on", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("tl_user", "jordan"));
    await page.goto("/referrals");
    await page.getByRole("button", { name: "New referral" }).click();
    await expect(page.getByText(/Fax line, 3 waiting/)).toBeVisible();
    await page.getByRole("button", { name: "Receive referral" }).click();
    await expect(page).toHaveURL(/\/patients\/ref-v1/);
    await expect(page.getByText("read the faxed referral")).toBeVisible();
    await expect(page.getByText("drafted the prior authorization request")).toBeVisible();
    await expect(page.getByText(/Waiting on Jordan Park/).first()).toBeVisible();
    await page.screenshot({ path: `${SCREENS}platform-record.png` });
    await noSeriousAxe(page);
  });

  test("an intake question is answered from the insurance card", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("tl_user", "jordan"));
    await page.goto("/inbox");
    await page
      .getByRole("button", { name: /Answer an intake question/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Fill from insurance card" }).click();
    await expect(page.getByLabel("Member ID")).toHaveValue(/^LHP-\d{6}-0\d$/);
    await page.getByRole("button", { name: "Send answer" }).click();
    await expect(page.getByText(/Answer sent/)).toBeVisible();
  });

  test("the nurse closes a handoff with the protocol reply", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("tl_user", "renee"));
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Nurse handoff" })).toBeVisible();
    await page.getByRole("button", { name: "Insert protocol reply" }).click();
    await page.getByRole("button", { name: "Send as nurse" }).click();
    await expect(page.getByText("Sent. The handoff is closed.")).toBeVisible();
  });

  test("the agent roster shows all 13 agents, their numbers, and the open-weights brain", async ({
    page,
  }) => {
    await page.addInitScript(() => window.localStorage.setItem("tl_user", "sam"));
    await page.goto("/agents");
    await expect(page.getByText(/steps so far for \d+ referrals/)).toBeVisible();
    await expect(page.locator("tbody tr[tabindex]")).toHaveCount(13);
    await page.getByRole("row", { name: /Ops planner/ }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByText(/Muse Spark Open/)
        .first(),
    ).toBeVisible();
    await page.screenshot({ path: `${SCREENS}platform-agents.png` });
    await noSeriousAxe(page);
  });

  test("a lost patient sends a photo of a sign and gets the way from there", async ({
    page,
    request,
  }) => {
    // Sam approves the CT 2 change, so Maria has to walk to CT 2.
    const items = (await (await request.get(`${RUNTIME}/api/inbox?role=ops`)).json()) as {
      id: string;
    }[];
    await request.post(`${RUNTIME}/api/reviews/${items[0]?.id}/resolve`, {
      data: { decision: "approved", by: "Sam Whitfield" },
    });
    await page.goto("/p/maria-001");
    await expect(page.getByRole("heading", { name: /Lost\? Send a photo/ })).toBeVisible();
    await page.getByRole("button", { name: /Photo of the Café sign/ }).click();
    await expect(page.getByText(/Found you/)).toBeVisible();
    await expect(page.getByText(/Directions to CT 2/).first()).toBeVisible();
    await page.screenshot({ path: `${SCREENS}patient-sign-photo.png`, fullPage: true });
  });

  test("a patient books a visit in six steps, with an example for every field", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /I'm a patient/ }).click();
    await page.getByRole("link", { name: /Book a visit/ }).click();
    await expect(page.getByRole("heading", { name: "Book a visit with Oncology" })).toBeVisible();
    const next = page.getByRole("button", { name: "Continue" });
    await page.getByRole("button", { name: /A first visit with a cancer specialist/ }).click();
    await next.click();
    await page.getByRole("button", { name: /Yes, my doctor faxed it/ }).click();
    await page.getByRole("button", { name: "Use an example referral" }).click();
    await next.click();
    await page.getByRole("button", { name: "Fill with example details" }).click();
    await next.click();
    await page.getByRole("button", { name: "Use this example card" }).click();
    await next.click();
    await page.getByRole("button", { name: "Pick example days" }).click();
    await next.click();
    await expect(page.getByRole("heading", { name: "Check and send" })).toBeVisible();
    await page.screenshot({ path: `${SCREENS}visit-check.png` });
    await noSeriousAxe(page);
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible();
    await expect(page.getByText("read the faxed referral")).toBeVisible();
    await expect(page.getByText(/A person at the hospital is checking it now/)).toBeVisible();
    await page.screenshot({ path: `${SCREENS}visit-sent.png`, fullPage: true });
  });

  test("a new hospital joins Throughline and appears beside Halden", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("button", { name: /Halden Medical Center/ })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Add your hospital" }).click();
    await expect(page.getByRole("heading", { name: "Add your hospital" })).toBeVisible();
    const next = page.getByRole("button", { name: "Continue" });
    await page.getByRole("button", { name: "Fill with an example hospital" }).click();
    await next.click();
    await page.getByRole("button", { name: "Use example numbers" }).click();
    await next.click();
    await page.getByRole("button", { name: "Pick example payers" }).click();
    await next.click();
    await page.getByRole("button", { name: "Use example floor plans" }).click();
    await next.click();
    await page.getByRole("button", { name: "Use an example contact" }).click();
    await noSeriousAxe(page);
    await page.getByRole("button", { name: "Set up our workspace" }).click();
    await expect(
      page.getByRole("heading", { name: "Riverbend Regional Hospital is being set up" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to the front page" }).click();
    // The new workspace is the one open now, waiting for its floor plans to be mapped.
    await page
      .getByRole("button", { name: /Riverbend Regional Hospital/, expanded: false })
      .click();
    await expect(
      page.getByRole("menuitemradio", { name: /Riverbend Regional Hospital/ }),
    ).toContainText("Setting up");
    await expect(page.getByText(/once your floor plans are mapped/)).toBeVisible();
  });

  test("any hospital can be chosen, each with its own campus", async ({ page }) => {
    await page.addInitScript(() => {
      if (location.pathname !== "/") window.localStorage.setItem("tl_user", "sam");
    });
    await page.goto("/");
    const picker = page.getByRole("radiogroup", { name: "Hospital" });
    await picker.getByRole("radio", { name: /Northgate University Hospital/ }).click();
    await expect(picker.getByRole("radio", { name: /Northgate/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(picker.getByRole("radio", { name: /Northgate/ })).toContainText("14 floors");
    await expect(
      page.getByRole("img", { name: /Northgate University Hospital in 3D, 5 buildings/ }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Northgate University Hospital/, expanded: false }),
    ).toBeVisible();
    await page.goto("/today");
    await expect(
      page.getByRole("heading", { name: "Every station, longest wait first" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Northgate University Hospital/, expanded: false })
      .click();
    await page.getByRole("menuitemradio", { name: /Halden Medical Center/ }).click();
    await expect(page.getByText("Select a station to forecast it.")).toBeVisible();
  });
});
