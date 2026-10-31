import { EventBus } from "./bus/event-bus";
import { SimClock } from "./bus/sim-clock";
import { RuntimeStore } from "./bus/store";
import type { Agent } from "./core/agent";
import { AgentRunner } from "./core/agent-runner";
import { Runtime } from "./core/runtime";
import { openDatabase } from "./db/index";
import type { ModelGateway } from "./models/types";
import { ModelCache } from "./models/cache";
import { modelConfig } from "./models/config";
import { MetaGateway, metaClient } from "./models/meta";
import { samCount } from "./models/sam";
import { CameraBank } from "./sim/cameras";
import { SensingLoop, type PersonCounter } from "./sim/sensing-loop";
import type { AppContext } from "./app";
import { loadEngine } from "@throughline/engine/node";
import { SimRequest, type Journey, type ModelCallRecord } from "@throughline/shared";
import { createAgents } from "./agents/index";
import type { StationState } from "./core/agent";
import { createStation } from "./core/journeys";
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
  const engine = loadEngine();
  const simDay = SimRequest.parse(day);
  const background = new SimBackground(engine, simDay);
  const bus = new EventBus();
  const clock = new SimClock(env.SIM_START ?? "2026-11-10T08:00:00-06:00");
  const config = modelConfig(env);
  const cache = new ModelCache(sqlite, config.cacheMode);
  const gateway =
    opts.gateway ?? (config.metaApiKey ? new MetaGateway(config, cache) : unconfiguredGateway);
  const runner = new AgentRunner(gateway, (r) => store.recordModelCall(r));
  const runtime = new Runtime({
    store,
    bus,
    clock,
    runner,
    agents:
      opts.agents ??
      createAgents({
        engine,
        day: simDay,
        journeys: () => store.listAggregates<Journey>("journey"),
        station: (id) =>
          store.loadAggregate<StationState>("station", id)?.value ?? createStation(id),
        onApplied: (action) => background.apply(action),
      }),
    providerReviewOn: env.PROVIDER_REVIEW_ON !== "false",
  });
  runtime.start();
  const cameras = new CameraBank();
  // SAM goes through the cache: in replay mode the bank's recorded counts are served, a miss
  // falls back to tickets only (spec 6, sensing fallback). Without a key, tickets only.
  const count: PersonCounter | undefined = config.metaApiKey
    ? async (frame) => {
        try {
          const deps = {
            client: metaClient(config),
            config,
            cache,
            record: (r: ModelCallRecord) => store.recordModelCall(r),
            now: () => clock.now(),
          };
          return (await samCount(deps, { bytes: frame.bytes, mime: frame.mime }, "person")).count;
        } catch {
          return undefined;
        }
      }
    : undefined;
  const sensing = new SensingLoop({
    runtime,
    store,
    clock,
    background,
    cameras,
    engine,
    ...(count ? { count } : {}),
  });
  return { store, bus, clock, runtime, background, sensing, models: { config, cache } };
}
