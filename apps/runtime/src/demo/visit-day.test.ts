import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { createContext } from "../context";
import type { HumanReview, Journey } from "@throughline/shared";

describe("demo visit day", () => {
  it("seeds Maria at the lab with an engine itinerary, and the phone actions work", async () => {
    const ctx = createContext({}, { databasePath: ":memory:" });
    const app = createApp(ctx);
    const journey = (await (
      await app.request("/api/demo/visit-day", { method: "POST" })
    ).json()) as Journey;
    expect(journey.phase).toBe("VISIT");
    expect(journey.itinerary?.stops.map((s) => s.status)).toEqual([
      "done",
      "waiting",
      "pending",
      "pending",
      "pending",
    ]);
    expect(journey.memory.mobility).toBe("wheelchair");

    const res = await app.request("/api/journeys/maria-001/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "talk_to_person" }),
    });
    const { review } = (await res.json()) as { review: HumanReview };
    expect(review).toMatchObject({ kind: "handoff", status: "pending" });
    expect(ctx.runtime.journey("maria-001")?.handoff_open).toBe(true);
  });
});
