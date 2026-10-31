import type { DeterministicAgent, HandlerResult } from "../../core/agent";
import { sensingDescriptor } from "./descriptor";

/** Spec V8: queue minutes above this for three consecutive samples is a bottleneck. */
export const BOTTLENECK_MIN = 15;
export const BOTTLENECK_SAMPLES = 3;

/**
 * Bottleneck detection (spec V8), deterministic: keeps the last three estimates per station
 * and raises one BottleneckDetected when all three exceed the threshold and nothing is already
 * proposed for that station.
 */
export function createSensingAgent(): DeterministicAgent {
  return {
    ...sensingDescriptor,
    kind: "deterministic",
    handle: (ctx): HandlerResult => {
      const event = ctx.event;
      const station = ctx.station;
      if (event.type !== "QueueStateUpdated" || !station) {
        return { summary: "nothing to detect", next_events: [] };
      }
      const { queue } = event.payload;
      const recent = [...(station.recent_waits ?? []), queue.est_wait_min].slice(
        -BOTTLENECK_SAMPLES,
      );
      const pending = station.ops_actions.some((a) => a.status === "proposed");
      const over = recent.length === BOTTLENECK_SAMPLES && recent.every((w) => w > BOTTLENECK_MIN);
      const wasOver =
        (station.recent_waits ?? []).length === BOTTLENECK_SAMPLES &&
        (station.recent_waits ?? []).every((w) => w > BOTTLENECK_MIN);
      return {
        summary: over ? `bottleneck at ${queue.station_id}` : "queue updated",
        station_patch: (s) => ({ ...s, queue, recent_waits: recent }),
        // Raise once per episode: only on the sample that crosses into "over".
        next_events:
          over && !wasOver && !pending
            ? [
                {
                  type: "BottleneckDetected",
                  payload: {
                    severity: queue.est_wait_min > 2 * BOTTLENECK_MIN ? "high" : "moderate",
                    minutes: queue.est_wait_min,
                  },
                },
              ]
            : [],
      };
    },
  };
}
