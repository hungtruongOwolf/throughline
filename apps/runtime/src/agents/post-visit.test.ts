import { describe, expect, it } from "vitest";
import type { Journey } from "@throughline/shared";
import { createApp } from "../app";
import { createContext } from "../context";
import type { HandlerContext } from "../core/agent";
import { keywordGrade } from "./discharge/handler";
import { readCheckin } from "./followup/handler";
import { createResultsWatcherAgent } from "./results_watcher/handler";

const post = (body: unknown = {}) => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("after the visit (D4-1)", () => {
  it("without provider review the summary goes out at once, with the AI disclaimer (test 11)", async () => {
    const ctx = createContext({ PROVIDER_REVIEW_ON: "false" }, { databasePath: ":memory:" });
    await createApp(ctx).request("/api/story/goto", post({ step: "after" }));
    const journey = ctx.runtime.journey("maria-001") as Journey;
    expect(journey.state).toBe("SUMMARY_SENT");
    expect(journey.summary?.disclaimer_mode).toBe(true);
    const sent = journey.outreach_log.filter((m) => m.text.includes("visit summary"));
    expect(sent.at(-1)?.text).toContain("has not been reviewed by a clinician");
    expect(sent.at(-1)?.disclaimer).toBe(true);
  }, 60_000);

  it("a result nobody acknowledged in 48 h becomes a task, status only (test 10)", async () => {
    const agent = createResultsWatcherAgent();
    const journey = {
      patient: { display_name: "Maria Diaz" },
      orders: [{ id: "o-cbc", code_as_written: "CBC w/ diff", status: "resulted" }],
    } as unknown as Journey;
    const result = await agent.handle({
      capability: "result_ack.track",
      event: { type: "ResultAckOverdue", payload: { order_id: "o-cbc", hours: 48 } },
      journey,
    } as unknown as HandlerContext);
    expect(result.tasks).toEqual(["Acknowledge the CBC w/ diff result for Maria Diaz"]);
    expect(result.outbound ?? []).toEqual([]);
  });

  it("grades teach-back answers by keyword when the model is unavailable", () => {
    const journey = {
      patient: { language: "en" },
      appointments: [
        {
          order_id: "o-fu-labs",
          status: "booked",
          start: "2026-12-07T09:00:00-06:00",
        },
      ],
    } as unknown as Journey;
    expect(
      keywordGrade(
        "My next blood test is Monday, December 7. I bring my insurance card and my ID. I'm not sure who to call.",
        journey,
      ),
    ).toEqual({ next_visit: "correct", bring: "correct", who_to_call: "not_sure" });
  });

  it("reads check-in answers as logistics yes/no only", () => {
    expect(
      readCheckin(
        "Yes, I picked up the prescription. My daughter will drive me. No need for a nurse call, thank you.",
      ),
    ).toEqual({ medication_picked_up: true, ride_confirmed: true, wants_nurse_call: false });
    expect(readCheckin("Not yet. I need a ride. Please call me.")).toEqual({
      medication_picked_up: false,
      ride_confirmed: false,
      wants_nurse_call: true,
    });
  });
});
