import { EventBus } from "./bus/event-bus";
import { SimClock } from "./bus/sim-clock";
import { RuntimeStore } from "./bus/store";
import type { Agent } from "./core/agent";
import { AgentRunner } from "./core/agent-runner";
import { Runtime } from "./core/runtime";
import { openDatabase } from "./db/index";
import type { ModelGateway } from "./models/types";
import type { AppContext } from "./app";
import { loadEngine } from "@throughline/engine/node";
import { SimRequest } from "@throughline/shared";
import day from "../../../fixtures/day-2026-11-17.json";
import { SimBackground } from "./board";

/** Until the provider clients land (D2-2), model agents fall back deterministically. */
export const unconfiguredGateway: ModelGateway = {
  respond: () => Promise.reject(new Error("no model gateway configured")),
};

/** Wires store, bus, clock, runner, and runtime from the environment. */
export function createContext(
  env: Record<string, string | undefined>,
  opts: { agents?: Agent[]; gateway?: ModelGateway; databasePath?: string } = {},
): AppContext {
  const { sqlite } = openDatabase(opts.databasePath);
  const store = new RuntimeStore(sqlite);
  const bus = new EventBus();
  const clock = new SimClock(env.SIM_START ?? "2026-11-10T08:00:00-06:00");
  const runner = new AgentRunner(opts.gateway ?? unconfiguredGateway, (r) =>
    store.recordModelCall(r),
  );
  const runtime = new Runtime({
    store,
    bus,
    clock,
    runner,
    agents: opts.agents ?? [],
    providerReviewOn: env.PROVIDER_REVIEW_ON !== "false",
  });
  runtime.start();
  const background = new SimBackground(loadEngine(), SimRequest.parse(day));
  return { store, bus, clock, runtime, background };
}
