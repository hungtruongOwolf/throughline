import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { createContext } from "./context";

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
});
