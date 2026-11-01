import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createContext } from "./context";
import { populate } from "./demo/population";

const post = (body: unknown = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("staff platform read models", () => {
  it("records agent runs and serves the inbox, roster, referrals, and timeline", async () => {
    const ctx = createContext({}, { databasePath: ":memory:" });
    const app = createApp(ctx);
    await app.request("/api/story/goto", post({ step: "review" }));

    const inbox = (await (await app.request("/api/inbox?role=clinician")).json()) as {
      kind: string;
      title: string;
      patient: string;
    }[];
    expect(inbox[0]).toMatchObject({
      kind: "approval",
      title: "Sign the visit summary",
      patient: "Maria Diaz",
    });

    const agents = (await (await app.request("/api/agents")).json()) as {
      name: string;
      runs: number;
      waiting_now: number;
    }[];
    expect(agents).toHaveLength(13);
    expect(agents.find((a) => a.name === "referral_intake")?.runs).toBeGreaterThan(0);
    expect(agents.find((a) => a.name === "discharge")?.waiting_now).toBe(1);

    const rows = (await (await app.request("/api/referrals")).json()) as {
      stage: string;
      waiting_on: { kind: string; who: string };
    }[];
    expect(rows[0]).toMatchObject({
      stage: "After visit",
      // Her open nurse handoff (the dizziness question) comes before the summary signature.
      waiting_on: { kind: "staff", who: "nurse" },
    });

    const timeline = (await (await app.request("/api/journeys/maria-001/timeline")).json()) as {
      kind: string;
      text?: string;
    }[];
    const kinds = new Set(timeline.map((e) => e.kind));
    expect([...kinds]).toEqual(
      expect.arrayContaining(["outside", "agent", "staff", "patient", "waiting"]),
    );
    expect(timeline.at(-1)).toMatchObject({ kind: "waiting", text: "Sign the visit summary" });

    const overview = (await (await app.request("/api/overview")).json()) as {
      feed: { label: string }[];
      waiting_on_staff: number;
    };
    expect(overview.feed.length).toBeGreaterThan(0);
    expect(overview.waiting_on_staff).toBeGreaterThan(0);
  }, 60_000);

  it("opens on a populated hospital, and a fax from the fax line starts a journey", async () => {
    const ctx = createContext({}, { databasePath: ":memory:" });
    await populate(ctx);
    const app = createApp(ctx);
    const rows = (await (await app.request("/api/referrals")).json()) as { stage: string }[];
    expect(rows.length).toBe(30);
    const roles = (
      (await (await app.request("/api/overview")).json()) as {
        waiting_by_role: Record<string, number>;
      }
    ).waiting_by_role;
    for (const role of ["coordinator", "nurse", "clinician", "ops"])
      expect(roles[role]).toBeGreaterThan(0);

    const line = (await (await app.request("/api/fax-line")).json()) as { id: string }[];
    expect(line).toHaveLength(3);
    const res = await app.request("/api/referrals", post({ fax: "ref-1041" }));
    const journey = (await res.json()) as { id: string; state: string; paused_for_review: boolean };
    expect(journey).toMatchObject({ id: "ref-v1", state: "AUTH_DRAFTED", paused_for_review: true });
    expect(((await (await app.request("/api/fax-line")).json()) as unknown[]).length).toBe(2);
    expect((await app.request("/api/referrals", post({ fax: "ref-1041" }))).status).toBe(409);

    // The coordinator approves; the payer answers a visitor's request within minutes.
    const item = (
      (await (await app.request("/api/inbox?role=coordinator")).json()) as {
        id: string;
        journey_id?: string;
      }[]
    ).find((i) => i.journey_id === "ref-v1");
    await app.request(
      `/api/reviews/${item?.id}/resolve`,
      post({ decision: "approved", by: "Jordan Park" }),
    );
    await ctx.clock.advanceBy(3);
    await ctx.bus.idle();
    expect(ctx.runtime.journey("ref-v1")?.state).toBe("PREP_SENT");
  }, 60_000);
});
