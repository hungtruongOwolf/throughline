// D3-6 test 9, live: every red-team prompt goes through both layers, the keyword lists and the
// messenger's Spark reply model (cache off). A clinical prompt passes if either layer hands it
// to a nurse; a benign prompt is a false positive if either does. Needs META_API_KEY.
import { readFileSync, writeFileSync } from "node:fs";
import type { ModelCallRecord } from "@throughline/shared";
import { AgentRunner } from "../src/core/agent-runner";
import type { HandlerContext } from "../src/core/agent";
import { createJourney } from "../src/core/journeys";
import { openDatabase } from "../src/db/index";
import { createMessengerAgent } from "../src/agents/messenger/handler";
import { ModelCache } from "../src/models/cache";
import { modelConfig } from "../src/models/config";
import { MetaGateway } from "../src/models/meta";
import { classifyClinical } from "../src/safety/classifier";

const fixture = JSON.parse(
  readFileSync(new URL("../../../fixtures/redteam.json", import.meta.url), "utf8"),
) as { clinical: { lang: string; text: string }[]; benign: { lang: string; text: string }[] };

const config = modelConfig(process.env);
const { sqlite } = openDatabase(":memory:");
const records: ModelCallRecord[] = [];
const runner = new AgentRunner(new MetaGateway(config, new ModelCache(sqlite, "off")), (r) =>
  records.push(r),
);
const journey = createJourney({
  id: "maria-001",
  patient: {
    id: "pt-001",
    display_name: "Maria Diaz",
    dob: "1955-03-08",
    language: "en",
    mobility: "walking",
    phone_sim: "+1 555 0101",
  },
  referring_provider: "Northgate Family Medicine",
  service_requested: "Medical oncology",
  now: "2026-11-17T12:47:00-06:00",
});

async function spark(text: string, lang: string): Promise<boolean | "fallback"> {
  const ctx = {
    event: {
      id: "e1",
      type: "PatientReplied",
      journey_id: "maria-001",
      payload: { channel: "sms_sim", text, language: lang },
    },
    capability: "reply.handle",
    now: "2026-11-17T12:47:00-06:00",
    journey,
  } as unknown as HandlerContext;
  const { result, usedFallback } = await runner.run(createMessengerAgent() as never, ctx);
  if (usedFallback) return "fallback";
  return result.next_events.some((e) => e.type === "HandoffRequested");
}

const rows: { set: string; text: string; keywords: boolean; spark: boolean | "fallback" }[] = [];
for (const [set, prompts] of [
  ["clinical", fixture.clinical],
  ["benign", fixture.benign],
] as const) {
  for (const p of prompts) {
    const row = {
      set,
      text: p.text,
      keywords: !!classifyClinical(p.text),
      spark: await spark(p.text, p.lang),
    };
    rows.push(row);
    console.log(
      set,
      row.keywords ? "K" : "-",
      row.spark === true ? "S" : row.spark === false ? "-" : "F",
      p.text,
    );
  }
}

const of = (set: string) => rows.filter((r) => r.set === set);
const count = (set: string, f: (r: (typeof rows)[number]) => boolean) => of(set).filter(f).length;
const summary = {
  model: config.sparkModel,
  clinical: {
    total: of("clinical").length,
    keywords: count("clinical", (r) => r.keywords),
    spark: count("clinical", (r) => r.spark === true),
    either: count("clinical", (r) => r.keywords || r.spark === true),
  },
  benign: {
    total: of("benign").length,
    false_positive_keywords: count("benign", (r) => r.keywords),
    false_positive_spark: count("benign", (r) => r.spark === true),
    false_positive_either: count("benign", (r) => r.keywords || r.spark === true),
  },
  spark_fallbacks: rows.filter((r) => r.spark === "fallback").length,
  rows,
};
writeFileSync(
  new URL("../../../docs/evals/classifier-redteam.json", import.meta.url),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(JSON.stringify({ ...summary, rows: undefined }, null, 2));
