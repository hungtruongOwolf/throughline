// D3-1 accuracy: Spark vision reads Maria's faxed referral N times (cache off, every run live)
// and each reading is checked against the generator's manifest. Done when ≥ 9 of 10 runs are
// valid packets with the smudged member ID flagged instead of guessed. Needs META_API_KEY.
import { readFileSync, writeFileSync } from "node:fs";
import type { ModelCallRecord } from "@throughline/shared";
import { AgentRunner } from "../src/core/agent-runner";
import type { HandlerContext, ModelAgent } from "../src/core/agent";
import { createJourney } from "../src/core/journeys";
import { openDatabase } from "../src/db/index";
import { createReferralIntakeAgent } from "../src/agents/referral_intake/handler";
import { MARIA_DOCUMENTS } from "../src/demo/referral";
import { ModelCache } from "../src/models/cache";
import { modelConfig } from "../src/models/config";
import { MetaGateway } from "../src/models/meta";

const RUNS = Number(process.argv[2] ?? 10);
const truth = JSON.parse(
  readFileSync(new URL("../../../fixtures/documents/maria-truth.json", import.meta.url), "utf8"),
) as {
  referral: {
    provider: string;
    patient: { name: string; dob: string };
    services: string[];
    diagnosis_code_as_written: string;
    urgency_as_written: string;
  };
};

const config = modelConfig(process.env);
const { sqlite } = openDatabase(":memory:");
const records: ModelCallRecord[] = [];
const runner = new AgentRunner(new MetaGateway(config, new ModelCache(sqlite, "off")), (r) =>
  records.push(r),
);

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const [m, d, y] = truth.referral.patient.dob.split("/");

function check(read: Record<string, unknown>) {
  const services = (read.services as string[]).map(norm);
  const missing = read.missing_fields as string[];
  return {
    name: norm(read.patient_name as string) === norm(truth.referral.patient.name),
    dob: read.dob === `${y}-${m}-${d}`,
    provider: norm(read.referring_provider as string).includes("whitcombe"),
    services:
      services.length === truth.referral.services.length &&
      truth.referral.services.every((s) => services.includes(norm(s))),
    diagnosis: read.diagnosis_code_as_written === truth.referral.diagnosis_code_as_written,
    urgency: norm(read.urgency_as_written as string) === norm(truth.referral.urgency_as_written),
    member_id_flagged: read.member_id === null && missing.includes("member_id"),
  };
}

const results: { run: number; ok: boolean; fallback: boolean; fields?: object; read?: object }[] =
  [];
for (let run = 1; run <= RUNS; run++) {
  const base = createReferralIntakeAgent();
  let read: Record<string, unknown> | undefined;
  const agent: ModelAgent<never> = {
    ...base,
    model: {
      ...base.model,
      apply: (args: Parameters<typeof base.model.apply>[0], ctx: HandlerContext) => {
        read = args as Record<string, unknown>;
        return base.model.apply(args, ctx);
      },
    },
  } as never;
  const journey = createJourney({
    id: "maria-001",
    patient: {
      id: "pt-001",
      display_name: "New referral",
      dob: "1900-01-01",
      language: "en",
      mobility: "walking",
      phone_sim: "+1 555 0101",
    },
    referring_provider: "",
    service_requested: "",
    now: "2026-11-10T08:05:00-06:00",
  });
  const ctx = {
    event: { type: "ReferralReceived", payload: { documents: MARIA_DOCUMENTS } },
    capability: "referral.extract",
    now: "2026-11-10T08:05:00-06:00",
    journey: { ...journey, referral: { ...journey.referral, documents: MARIA_DOCUMENTS } },
  } as unknown as HandlerContext;
  const { usedFallback } = await runner.run(agent, ctx);
  const fields = read && !usedFallback ? check(read) : undefined;
  const ok = !!fields && Object.values(fields).every(Boolean);
  results.push({
    run,
    ok,
    fallback: usedFallback,
    ...(fields ? { fields } : {}),
    ...(read ? { read } : {}),
  });
  console.log(`run ${run}: ${ok ? "ok" : "FAIL"}`, usedFallback ? "(fallback)" : "", fields ?? "");
}

const passed = results.filter((r) => r.ok).length;
const latency = records.filter((r) => r.success).map((r) => r.latency_ms);
const summary = {
  model: config.sparkModel,
  runs: RUNS,
  passed,
  done: passed >= Math.ceil(RUNS * 0.9),
  median_latency_ms: latency.sort((a, b) => a - b)[Math.floor(latency.length / 2)] ?? null,
  results,
};
writeFileSync(
  new URL("../../../docs/evals/intake-accuracy.json", import.meta.url),
  `${JSON.stringify(summary, null, 2)}\n`,
);
console.log(`\n${passed}/${RUNS} valid packets with the member ID flagged`);
