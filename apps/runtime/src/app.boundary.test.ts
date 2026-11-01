import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createContext } from "./context";
import { mockAgents } from "./test/harness";

function app() {
  const ctx = createContext(
    { SIM_START: "2026-11-10T08:12:00-06:00" },
    { agents: mockAgents(), databasePath: ":memory:" },
  );
  return createApp(ctx);
}
const post = (a: ReturnType<typeof app>, path: string, body: unknown, headers = {}) =>
  a.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const visit = {
  service: "new_patient",
  patient: {
    name: "Pat Example",
    dob: "1960-01-01",
    phone: "555-0100",
    mobility: "walking",
    companion: false,
  },
  days: [{ date: "2026-11-18", part: "any" }],
};
const hospital = {
  name: "Test Hospital",
  city: "Testville",
  specialties: ["Cardiology"],
  phone: "555-0123",
  payers: ["Medicare"],
  contact: "Dana, Access",
};

describe("input at the edges", () => {
  afterEach(() => {
    delete process.env.ADMIN_TOKEN;
    process.env.NODE_ENV = "test";
  });

  it("rejects a visit request with a future birth date or an unknown fax", async () => {
    const a = app();
    const future = { ...visit, patient: { ...visit.patient, dob: "2999-01-01" } };
    expect((await post(a, "/api/visit-requests", future)).status).toBe(400);
    const res = await post(a, "/api/visit-requests", { ...visit, referral_fax: "ref-nope" });
    expect(res.status).toBe(404);
  });

  it("a hospital joins once, and blank list items are refused", async () => {
    const a = app();
    expect((await post(a, "/api/hospitals", hospital)).status).toBe(200);
    expect((await post(a, "/api/hospitals", hospital)).status).toBe(409);
    const blank = { ...hospital, name: "Other Hospital", payers: ["  "] };
    expect((await post(a, "/api/hospitals", blank)).status).toBe(400);
  });

  it("keeps development routes closed in production without a token, and gated with one", async () => {
    const a = app();
    process.env.NODE_ENV = "production";
    expect((await post(a, "/api/clock", { action: "stop" })).status).toBe(404);
    process.env.ADMIN_TOKEN = "secret";
    expect((await post(a, "/api/clock", { action: "stop" })).status).toBe(404);
    const ok = await post(a, "/api/clock", { action: "stop" }, { "x-admin-token": "secret" });
    expect(ok.status).toBe(200);
  });

  it("will not fast-forward the clock by more than a day", async () => {
    const a = app();
    expect((await post(a, "/api/clock", { action: "advance", minutes: 1e9 })).status).toBe(400);
  });
});
