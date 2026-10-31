import type { DeterministicAgent, HandlerResult } from "../../core/agent";
import { sensingDescriptor } from "./descriptor";

/** Spec V8: queue minutes above this for three consecutive samples is a bottleneck. */
export const BOTTLENECK_MIN = 20;
export const BOTTLENECK_SAMPLES = 3;
/** An applied action gets this long to work before the station can be flagged again. */
export const ACTION_SETTLE_MIN = 30;

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
      // Nothing new while a proposal waits, or within 30 min of an applied action taking effect.
      const settling =
        station.last_action_at !== undefined &&
        Date.parse(queue.at) - Date.parse(station.last_action_at) < ACTION_SETTLE_MIN * 60_000;
      const pending = settling || station.ops_actions.some((a) => a.status === "proposed");
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
