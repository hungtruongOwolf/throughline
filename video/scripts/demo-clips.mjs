// The product footage for the film, in story order. Clips of one take share the runtime's state
// (the fax received in one is the one answered in the next), so restart the runtime before
// each take: node scripts/record-demo.mjs --take A
export const CLIPS = [
  // ---- Take A: before the visit (restart the runtime first) --------------------------------
  {
    // 11-12: Jordan's inbox; a fax from the fax line becomes a record; Intake asks a question.
    take: "A",
    name: "c01-fax-arrives",
    user: "jordan",
    open: "/inbox",
    async run({ page, sleep, click, mark }) {
      await sleep(2200);
      await click(page.getByRole("button", { name: "New referral" }));
      await sleep(1500);
      await click(page.getByText(/Riverside Internal Medicine/).first());
      await sleep(2200);
      mark("receive");
      await click(page.getByRole("button", { name: "Receive referral" }));
      await page.waitForURL(/\/patients\//, { timeout: 30000 });
      mark("record");
      await sleep(1200);
      await page.mouse.move(900, 520, { steps: 30 });
      await sleep(5000);
    },
  },
  {
    // 13: the question, answered from the insurance card.
    take: "A",
    name: "c02-answer",
    user: "jordan",
    open: "/patients/ref-v1",
    async run({ page, sleep, click, mark, to }) {
      await sleep(1500);
      await click(page.getByRole("link", { name: "Review" }).or(page.getByRole("button", { name: "Review" })).first());
      await sleep(2500);
      await to(page.getByLabel("Member ID")).catch(() => undefined);
      await sleep(1200);
      mark("fill");
      await click(page.getByRole("button", { name: "Fill from insurance card" }));
      await sleep(1800);
      mark("send");
      await click(page.getByRole("button", { name: "Send answer" }));
      await sleep(3500);
    },
  },
  {
    // 14: back on the record, Coverage and Prior auth have worked.
    take: "A",
    name: "c03-record-after",
    user: "jordan",
    open: "/patients/ref-v1",
    settle: 2500,
    async run({ page, sleep, to }) {
      await sleep(1500);
      await to(page.getByText(/Coverage verified/).first()).catch(() => undefined);
      await sleep(2500);
      await to(page.getByText(/Prior auth drafted/).first()).catch(() => undefined);
      await sleep(3000);
    },
  },
  {
    // 15: the draft beside the fax, approved.
    take: "A",
    name: "c04-approve-auth",
    user: "jordan",
    open: "/patients/ref-v1",
    async run({ page, sleep, click, mark, to }) {
      await sleep(1200);
      await click(page.getByRole("link", { name: "Review" }).or(page.getByRole("button", { name: "Review" })).first());
      await sleep(2500);
      await to(page.getByText(/Services Needing Authorization/i).first()).catch(() => undefined);
      await sleep(2500);
      await to(page.getByText(/Source: the faxed referral/).first()).catch(() => undefined);
      await sleep(2000);
      mark("approve");
      await click(page.getByRole("button", { name: "Approve and submit" }));
      await sleep(3000);
    },
  },

  // ---- Take B: the visit day (restart the runtime first; approve within about a minute) -----
  {
    // 16-17: Maria's day on her phone, and a sign photo that sends step-free directions.
    take: "B",
    name: "c05-maria-phone",
    phone: true,
    open: "/p/maria-001",
    async run({ page, sleep, scroll, click, mark }) {
      await sleep(2500);
      await scroll(600, 30, 40);
      await sleep(2000);
      const sign = page.getByRole("button", { name: /Café/ }).first();
      await sign.scrollIntoViewIfNeeded();
      await sleep(1200);
      mark("sign");
      await click(sign);
      await sleep(4000);
      await page.getByText(/Elevator A/).first().scrollIntoViewIfNeeded().catch(() => undefined);
      await sleep(3500);
    },
  },
  {
    // 18-22: the floor today, the planner's proposal, the operations lead approves.
    take: "B",
    name: "c06-today-approve",
    user: "sam",
    open: "/today",
    settle: 3500,
    async run({ page, sleep, click, mark, to }) {
      await sleep(3000);
      await to(page.getByText(/Open extra CT 2 slot/).first()).catch(() => undefined);
      await sleep(3000);
      await to(page.getByText(/CT wait 17 to 5 min/).first()).catch(() => undefined);
      await sleep(3000);
      mark("approve");
      await click(page.getByRole("button", { name: "Approve" }).first());
      await sleep(3500);
    },
  },
  {
    // 22: Maria's phone after the change.
    take: "B",
    name: "c07-maria-changed",
    phone: true,
    open: "/p/maria-001",
    async run({ sleep }) {
      await sleep(6000);
    },
  },

  // ---- Take C: after the visit (any runtime state) ------------------------------------------
  {
    // 23-24: the doctor signs the plain-language summary.
    take: "C",
    name: "c08-sign-summary",
    user: "okafor",
    open: "/inbox",
    async run({ page, sleep, click, mark, to }) {
      await sleep(1200);
      await click(page.getByRole("button", { name: /Sign the visit summary/ }).filter({ hasText: /Lucille Barros/ }).first());
      await sleep(3000);
      await to(page.getByText(/what the patient will read/i).first()).catch(() => undefined);
      await sleep(3500);
      mark("sign");
      await to(page.getByRole("button", { name: /Sign and send/ }).first()).catch(() => undefined);
      await sleep(1500);
    },
  },
  {
    // 25: a nurse gets a task to call the patient.
    take: "C",
    name: "c09-nurse-task",
    user: "renee",
    open: "/inbox",
    async run({ page, sleep, click }) {
      await sleep(1200);
      await click(page.getByRole("button", { name: /Eleanor Fitch/ }).first());
      await sleep(4500);
    },
  },
  {
    // 26: Results watch and Follow-up on visited patients' records.
    take: "C",
    name: "c10-results-followup",
    user: "jordan",
    open: "/patients/ref-1020",
    async run({ page, sleep, scroll, mark }) {
      await sleep(1500);
      await page.mouse.move(800, 700, { steps: 20 });
      await scroll(1600, 40, 35);
      mark("results");
      await sleep(3500);
      await page.goto("http://localhost:3000/patients/ref-1019", { waitUntil: "networkidle" });
      await sleep(1200);
      await page.mouse.move(800, 700, { steps: 20 });
      await scroll(1800, 40, 35);
      mark("followup");
      await sleep(3500);
    },
  },
  {
    // 27: the Agents page.
    take: "C",
    name: "c11-agents",
    user: "jordan",
    open: "/agents",
    async run({ page, sleep, click, mark }) {
      await sleep(2500);
      mark("ops");
      await click(page.getByRole("row", { name: /Ops planner/ }));
      await sleep(4500);
    },
  },
  {
    // 31: switch to Northgate, its campus in 3D; Add your hospital.
    take: "C",
    name: "c12-northgate",
    user: "sam",
    open: "/today",
    headed: true,
    settle: 3000,
    async run({ page, sleep, click, mark, to }) {
      await sleep(1500);
      await click(page.getByRole("button", { name: /Halden Medical Center/ }).last());
      await sleep(1200);
      mark("switch");
      await click(page.getByRole("menuitemradio", { name: /Northgate University Hospital/ }));
      await sleep(7000);
    },
  },
];
