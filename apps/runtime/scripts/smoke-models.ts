// D2-2 live smoke: one Spark tool loop through the AgentRunner, one SAM count on a fixture
// frame, one Muse Image card; then the same calls replayed from the cache. Needs META_API_KEY.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { z } from "zod";
import type { ModelCallRecord } from "@throughline/shared";
import { AgentRunner } from "../src/core/agent-runner";
import type { HandlerContext, ModelAgent } from "../src/core/agent";
import { createJourney } from "../src/core/journeys";
import { openDatabase } from "../src/db/index";
import { ModelCache } from "../src/models/cache";
import { modelConfig } from "../src/models/config";
import { generateImage, CARD_STYLE } from "../src/models/image";
import { MetaGateway, metaClient } from "../src/models/meta";
import { samCount } from "../src/models/sam";
import { PREAMBLE, requiredToolLine } from "../src/safety/preamble";

const config = modelConfig(process.env);
const { sqlite } = openDatabase(":memory:");
const records: ModelCallRecord[] = [];
const record = (r: ModelCallRecord) => void records.push(r);
const now = () => "2026-11-13T17:05:00-06:00";

const Intent = z.object({
  intent: z.enum(["confirm", "reschedule", "question", "human"]),
  mobility: z.enum(["walking", "wheelchair", "unknown"]),
});

const agent: ModelAgent<z.infer<typeof Intent>> = {
  name: "messenger",
  kind: "model",
  capabilities: ["reply.handle"],
  risk: "MEDIUM",
  model: {
    system: `${PREAMBLE} ${requiredToolLine("handle_reply")} Call get_appointments first.`,
    input: () =>
      "Patient reply (Spanish voice note): 'Sí, confirmo. Pero mi esposo no puede venir, voy a necesitar una silla de ruedas.'",
    tools: [
      {
        type: "function",
        name: "get_appointments",
        description: "Upcoming appointments for this patient.",
        parameters: { type: "object", properties: {}, additionalProperties: false },
        strict: true,
      },
      {
        type: "function",
        name: "handle_reply",
        description: "Record what the reply asks for.",
        strict: true,
        parameters: {
          type: "object",
          additionalProperties: false,
          required: ["intent", "mobility"],
          properties: {
            intent: { type: "string", enum: ["confirm", "reschedule", "question", "human"] },
            mobility: { type: "string", enum: ["walking", "wheelchair", "unknown"] },
          },
        },
      },
    ],
    readTools: {
      get_appointments: () => ({
        appointments: [
          { station: "CT", start: "2026-11-17T09:50" },
          { station: "Clinic 2A", start: "2026-11-17T11:00" },
        ],
      }),
    },
    readSchemas: { get_appointments: z.object({}) },
    requiredTool: "handle_reply",
    requiredSchema: Intent,
    effort: "low",
    maxSteps: 4,
    maxOutputTokens: 800,
    apply: (args) => ({ summary: JSON.stringify(args), next_events: [] }),
  },
  fallback: () => ({ summary: "FALLBACK", next_events: [] }),
};

async function pass(mode: "record" | "replay") {
  const cache = new ModelCache(sqlite, mode);
  const client = metaClient(config);
  const deps = { client, config, cache, record, now };
  const runner = new AgentRunner(new MetaGateway(config, cache), record);
  const journey = createJourney({
    id: "maria-001",
    patient: {
      id: "pt-001",
      display_name: "Maria Diaz",
      dob: "1955-03-08",
      language: "es",
      mobility: "walking",
      phone_sim: "+1 555 0101",
    },
    referring_provider: "Northgate Family Medicine",
    service_requested: "Medical oncology",
    now: now(),
  });
  const ctx = {
    event: {} as HandlerContext["event"],
    capability: "reply.handle",
    now: now(),
    journey,
  } as HandlerContext;
  const tool = await runner.run(agent as never, ctx);
  const frame = readFileSync(
    new URL("../../../fixtures/frames/smoke-waiting-5.webp", import.meta.url),
  );
  const sam = await samCount(deps, { bytes: frame, mime: "image/webp" }, "person");
  const card = await generateImage(
    deps,
    `${CARD_STYLE} A wide entrance hall with a welcome desk and a teal floor line leading to an elevator.`,
  );
  mkdirSync(new URL("../../web/public/cards/", import.meta.url), { recursive: true });
  writeFileSync(new URL("../../web/public/cards/smoke-entrance.webp", import.meta.url), card.bytes);
  return {
    tool: tool.result.summary,
    fallback: tool.usedFallback,
    sam: sam.count,
    samReplayed: sam.replayed,
    cardBytes: card.bytes.length,
    cardReplayed: card.replayed,
  };
}

const recorded = await pass("record");
console.log("record:", recorded);
const replayed = await pass("replay");
console.log("replay:", replayed);
console.log(
  "identical:",
  recorded.tool === replayed.tool &&
    recorded.sam === replayed.sam &&
    recorded.cardBytes === replayed.cardBytes,
);
console.log(
  "calls:",
  records
    .map(
      (r) =>
        `${r.model}${r.replayed ? " (replayed)" : ""} tools=[${r.tools_invoked.join(",")}] valid=${r.required_tool_valid ?? "-"} ${Math.round(r.latency_ms)}ms`,
    )
    .join("\n       "),
);
