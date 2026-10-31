import type { Journey, ReferralPacket } from "@throughline/shared";
import { EventBus } from "../bus/event-bus";
import { SimClock } from "../bus/sim-clock";
import { RuntimeStore } from "../bus/store";
import type { Agent, NewEvent } from "../core/agent";
import { AgentRunner } from "../core/agent-runner";
import { createJourney } from "../core/journeys";
import { Runtime } from "../core/runtime";
import { openDatabase } from "../db/index";
import type { ModelGateway, ModelRequest, ModelResponse } from "../models/types";

/** A gateway that plays back scripted responses and remembers every request. */
export class ScriptedGateway implements ModelGateway {
  readonly requests: ModelRequest[] = [];
  constructor(private readonly script: ModelResponse["output"][]) {}
  respond(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(structuredClone(request));
    const output = this.script.shift() ?? [];
    return Promise.resolve({
      id: `r${this.requests.length}`,
      output,
      provider: "meta",
      model: "muse-spark-1.3",
      tier: "cloud",
      replayed: false,
    });
  }
}

export function harness(opts: {
  agents: Agent[];
  gateway?: ModelGateway;
  providerReviewOn?: boolean;
}) {
  const { sqlite } = openDatabase(":memory:");
  const store = new RuntimeStore(sqlite);
  const bus = new EventBus();
  const clock = new SimClock("2026-11-10T08:12:00-06:00");
  const runner = new AgentRunner(opts.gateway ?? new ScriptedGateway([]), (r) =>
    store.recordModelCall(r),
  );
  const runtime = new Runtime({
    store,
    bus,
    clock,
    runner,
    agents: opts.agents,
    providerReviewOn: opts.providerReviewOn ?? true,
  });
  runtime.start();
  const published: string[] = [];
  bus.subscribe("*", ({ event }) => {
    published.push(event.type);
  });

  function newJourney(id = "maria-001", patch: Partial<Journey> = {}): Journey {
    const journey = {
      ...createJourney({
        id,
        patient: {
          id: "pt-001",
          display_name: "Maria Diaz",
          dob: "1955-03-08",
          language: "es",
          mobility: "walking",
          phone_sim: "+1 555 0101",
        },
        referring_provider: "Northgate Family Medicine",
        service_requested: "Medical oncology, new patient",
        now: clock.now(),
      }),
      ...patch,
    };
    store.saveAggregate("journey", id, journey.version, journey);
    return journey;
  }

  const ingest = (e: NewEvent) => runtime.ingest(e);
  const types = (journeyId = "maria-001") => store.events({ journeyId }).map((s) => s.event.type);

  return { sqlite, store, bus, clock, runner, runtime, published, newJourney, ingest, types };
}

export const PACKET: ReferralPacket = {
  patient: {
    display_name: "Maria Diaz",
    dob: "1955-03-08",
    language: "es",
    mobility: "walking",
    phone_sim: "+1 555 0101",
  },
  referral: {
    referring_provider: "Northgate Family Medicine",
    service_requested: "Medical oncology, new patient",
    as_written: {},
  },
  orders: [{ kind: "imaging", code_as_written: "CT chest/abdomen/pelvis with contrast" }],
  missing_fields: [],
};

/** Deterministic mock agents for the pre-visit chain. */
export function mockAgents(overrides: Partial<Record<Agent["name"], Agent>> = {}): Agent[] {
  const base: Agent[] = [
    {
      name: "referral_intake",
      kind: "deterministic",
      capabilities: ["referral.extract", "referral.clarify"],
      risk: "MEDIUM",
      handle: () => ({
        summary: "extracted",
        next_events: [{ type: "IntakeExtracted", payload: { packet: structuredClone(PACKET) } }],
      }),
    },
    {
      name: "eligibility",
      kind: "deterministic",
      capabilities: ["eligibility.check"],
      risk: "LOW",
      handle: () => ({
        summary: "eligible",
        next_events: [
          {
            type: "EligibilityChecked",
            payload: {
              coverage: {
                plan_id: "LHP-GOLD-PPO",
                active: true,
                copay_cents: 4000,
                auth_required_order_ids: ["o-ct"],
              },
            },
          },
        ],
      }),
    },
    {
      name: "authorization",
      kind: "deterministic",
      capabilities: ["prior_auth.draft", "prior_auth.submit"],
      risk: "HIGH",
      handle: (ctx) => {
        return ctx.capability === "prior_auth.draft"
          ? {
              summary: "drafted",
              next_events: [
                {
                  type: "PriorAuthDrafted",
                  payload: {
                    packet: { id: "auth-1", order_ids: ["o-ct"], status: "draft", sections: [] },
                  },
                },
              ],
            }
          : {
              summary: "submitted",
              next_events: [
                {
                  type: "PriorAuthSubmitted",
                  payload: { packet_id: "auth-1", by: ctx.approved_by ?? "nobody" },
                },
              ],
            };
      },
    },
    {
      name: "messenger",
      kind: "deterministic",
      capabilities: ["message.send", "reply.handle", "waitlist.offer", "handoff.request"],
      risk: "MEDIUM",
      handle: (ctx) =>
        ctx.capability === "handoff.request"
          ? {
              summary: "nurse handoff",
              review_reason: "Patient asked a clinical question",
              next_events: [
                { type: "HandoffRequested", payload: { reason: "clinical_question" } },
                { type: "MemoryUpdated", payload: { key: "preferred_language" } },
              ],
            }
          : {
              summary: "handled",
              next_events: [
                { type: "ReplyHandled", payload: { intent: "confirm", memory_keys: [] } },
              ],
            },
    },
  ];
  return base
    .map((a) => overrides[a.name] ?? a)
    .concat(
      Object.values(overrides).filter(
        (a): a is Agent => !!a && !base.some((b) => b.name === a.name),
      ),
    );
}
