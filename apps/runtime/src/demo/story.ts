import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEngine } from "@throughline/engine/node";
import { modelsAvailable } from "../models/config";
import { transcribe } from "../models/voice";
import type { AppContext } from "../app";
import { VisitDayScenario } from "../sim/scenario";
import { seedReferral } from "./referral";
import { MARIA_JOURNEY_ID } from "./visit-day";

/**
 * Maria's whole journey as one story (owner feedback 2026-10-31: one flow, one data set, each
 * step one action). Every step is a moment in the same simulated journey; its action is a real
 * event (the coordinator answers, Maria replies, the manager approves) or moves the sim clock.
 * Going to a step replays the actions before it from a reset, so any step looks the same
 * every time.
 */
export const STORY_STEPS = [
  "fax",
  "auth",
  "insurer",
  "confirm",
  "day_before",
  "arrive",
  "outage",
  "decide",
  "changed",
  "lost",
  "question",
  "after",
] as const;
export type StoryStep = (typeof STORY_STEPS)[number];

const MEMBER_ID = "LHP-883201-02";
const MARIA_REPLY = "Yes, I'll be there. But my husband can't come, so I'll need a wheelchair.";
const VOICE_NOTE = fileURLToPath(
  new URL("../../../../fixtures/voice/maria-reply.wav", import.meta.url),
);
const at = (day: string, hhmm: string) => `2026-11-${day}T${hhmm}:00-06:00`;

/** When each visit-day step's action stops the clock (the moment the next step shows). */
export const STORY_TIMES = {
  dayBefore: at("16", "18:00"),
  arrived: at("17", "09:13"),
  outage: at("17", "09:53"),
  lost: at("17", "11:47"),
  question: at("17", "12:47"),
  end: at("17", "14:35"),
};

export class StoryDriver {
  private index = 0;
  private scenario: VisitDayScenario | undefined;

  constructor(private readonly ctx: AppContext) {}

  get step(): StoryStep {
    return STORY_STEPS[this.index] as StoryStep;
  }

  state() {
    return {
      step: this.step,
      index: this.index,
      steps: STORY_STEPS,
      now: this.ctx.clock.now(),
      journey_id: MARIA_JOURNEY_ID,
    };
  }

  /** Resets to the fax arriving, then replays every action before `step`. */
  async goto(step: StoryStep): Promise<void> {
    const target = STORY_STEPS.indexOf(step);
    this.scenario?.stop();
    this.scenario = undefined;
    this.ctx.clock.stop();
    await seedReferral(this.ctx);
    await this.ctx.bus.idle();
    this.index = 0;
    while (this.index < target) await this.act();
  }

  /** Maria answers with a voice note; if it cannot be transcribed, the same words as a text. */
  private async mariaReply() {
    const { models, store, clock } = this.ctx;
    if (!modelsAvailable(models.config)) {
      return { channel: "sms_sim" as const, text: MARIA_REPLY, language: "en" as const };
    }
    try {
      const { transcript } = await transcribe(
        { ...models, record: (r) => store.recordModelCall(r), now: () => clock.now() },
        readFileSync(VOICE_NOTE),
      );
      if (transcript) return { channel: "voice_sim" as const, transcript, language: "en" as const };
    } catch {
      // No model available: fall through to the typed reply.
    }
    return { channel: "sms_sim" as const, text: MARIA_REPLY, language: "en" as const };
  }

  /** Performs the current step's action and moves to the next step. */
  async act(): Promise<void> {
    const { runtime, clock, bus, store } = this.ctx;
    switch (this.step) {
      case "fax":
        // The coordinator reads the member ID off the insurance card.
        await runtime.ingest({
          type: "ClarificationAnswered",
          journey_id: MARIA_JOURNEY_ID,
          payload: { field: "member_id", value: MEMBER_ID, by: "coordinator" },
        });
        break;
      case "auth": {
        const review = store
          .reviews("pending")
          .find((r) => r.capability === "prior_auth.submit" && r.journey_id === MARIA_JOURNEY_ID);
        if (review) await runtime.resolve(review.id, "approved", "coordinator");
        break;
      }
      case "insurer":
        // The payer decides two days later; scheduling, booking, and prep follow by themselves.
        await clock.advanceBy(2 * 24 * 60 + 5);
        break;
      case "confirm":
        await runtime.ingest({
          type: "PatientReplied",
          journey_id: MARIA_JOURNEY_ID,
          payload: await this.mariaReply(),
        });
        await bus.idle();
        await clock.advanceTo(STORY_TIMES.dayBefore);
        break;
      case "day_before":
        this.scenario = new VisitDayScenario(
          { ...this.ctx, engine: loadEngine() },
          { autopilot: false, continueJourney: true },
        );
        await this.scenario.start();
        await clock.advanceTo(STORY_TIMES.arrived);
        break;
      case "arrive":
        await clock.advanceTo(STORY_TIMES.outage);
        break;
      case "outage":
        // Nothing happens here: the next step is the manager's decision on the same moment.
        break;
      case "decide": {
        const review = store
          .reviews("pending")
          .find((r) => r.capability === "ops_action.apply" && r.station_id);
        if (review) {
          const parked = review.pending_event as { payload?: { action?: { id?: string } } };
          await runtime.ingest({
            type: "OpsActionApproved",
            station_id: review.station_id,
            payload: { action_id: parked.payload?.action?.id ?? "", by: "manager" },
          });
        }
        break;
      }
      case "changed":
        await clock.advanceTo(STORY_TIMES.lost);
        break;
      case "lost":
        await clock.advanceTo(STORY_TIMES.question);
        break;
      case "question":
        await clock.advanceTo(STORY_TIMES.end);
        break;
      case "after":
        return;
    }
    await bus.idle();
    this.index = Math.min(this.index + 1, STORY_STEPS.length - 1);
  }
}
