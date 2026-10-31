import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { campus, localize } from "@throughline/hospital";
import type { ModelCallRecord } from "@throughline/shared";
import type { SimClock } from "./bus/sim-clock";
import type { RuntimeStore } from "./bus/store";
import type { Runtime } from "./core/runtime";
import type { ModelCache } from "./models/cache";
import type { ModelConfig } from "./models/config";
import { metaClient } from "./models/meta";
import { readSign, type SignReading } from "./models/vision";

const SIGNS = fileURLToPath(new URL("../../../packages/synthetic/signs/", import.meta.url));
const READINGS = fileURLToPath(new URL("../../../fixtures/sign-readings.json", import.meta.url));

/** Recorded Spark readings of the committed sign photos, keyed by the photo's hash. */
function recordedReadings(): Map<string, SignReading> {
  const { readings } = JSON.parse(readFileSync(READINGS, "utf8")) as {
    readings: ({ file: string } & SignReading)[];
  };
  const byFile = new Map(readings.map((r) => [r.file, r]));
  const out = new Map<string, SignReading>();
  for (const file of readdirSync(SIGNS)) {
    const r = byFile.get(file);
    if (!r) continue;
    const hash = createHash("sha256")
      .update(readFileSync(`${SIGNS}${file}`))
      .digest("hex");
    out.set(hash, { heading: r.heading, directions: r.directions });
  }
  return out;
}

let recorded: Map<string, SignReading> | undefined;

/**
 * Locates a patient from a sign photo (spec V5): Spark transcribes the sign, the localizer
 * matches the text to the registry in code, never by face or GPS. Without a live reading the
 * recorded reading of a committed demo photo is used and labeled replayed.
 */
export async function locateFromPhoto(
  deps: {
    runtime: Runtime;
    store: RuntimeStore;
    clock: SimClock;
    models: { config: ModelConfig; cache: ModelCache };
  },
  journeyId: string,
  photo: { bytes: Buffer; mime: string },
): Promise<{ node_id: string; confidence: number } | undefined> {
  const record = (r: ModelCallRecord) => deps.store.recordModelCall(r);
  let reading: SignReading | undefined;
  if (deps.models.config.metaApiKey) {
    try {
      reading = (
        await readSign(
          {
            client: metaClient(deps.models.config),
            config: deps.models.config,
            cache: deps.models.cache,
            record,
            now: () => deps.clock.now(),
          },
          photo,
        )
      ).reading;
    } catch {
      reading = undefined;
    }
  }
  if (!reading) {
    recorded ??= recordedReadings();
    reading = recorded.get(createHash("sha256").update(photo.bytes).digest("hex"));
    if (reading) {
      record({
        id: randomUUID(),
        at: deps.clock.now(),
        tier: "cloud",
        provider: "meta",
        model: deps.models.config.sparkModel,
        capability: "patient.locate",
        tools_invoked: [],
        latency_ms: 0,
        success: true,
        used_fallback: false,
        replayed: true,
      });
    }
  }
  if (!reading) return undefined;
  const found = localize(reading.heading.join(" "), campus.signs);
  if (found.node_id === "unknown") return undefined;
  await deps.runtime.ingest({
    type: "PatientLocated",
    journey_id: journeyId,
    // Capped below 1: confidence 1 is reserved for a check-in scan at the station itself.
    payload: {
      node_id: found.node_id,
      confidence: Math.min(0.99, Math.round(found.confidence * 100) / 100),
    },
  });
  return { node_id: found.node_id, confidence: found.confidence };
}
