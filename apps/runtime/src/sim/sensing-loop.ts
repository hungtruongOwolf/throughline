import { campus } from "@throughline/hospital";
import type { Engine } from "@throughline/engine/node";
import type { Journey, QueueState, StationId } from "@throughline/shared";
import type { SimBackground } from "../board";
import type { SimClock } from "../bus/sim-clock";
import type { RuntimeStore } from "../bus/store";
import type { Runtime } from "../core/runtime";
import type { CameraBank, CameraFrame } from "./cameras";

/** Counts people in a frame; absent when no model is available (tickets-only fallback). */
export type PersonCounter = (frame: CameraFrame) => Promise<number | undefined>;

/**
 * The sensing loop (spec V3, capability queue.estimate): every sim minute, for each camera,
 * take the ticket counts (the simulated day plus live journeys waiting there), serve the frame
 * nearest that count, count people with SAM 3.1 when available, fuse with tickets (EMA),
 * convert to minutes (Little's law), and publish QueueStateUpdated per station.
 */
export class SensingLoop {
  private timer: number | undefined;

  constructor(
    private readonly deps: {
      runtime: Runtime;
      store: RuntimeStore;
      clock: SimClock;
      background: SimBackground;
      cameras: CameraBank;
      engine: Engine;
      count?: PersonCounter;
    },
  ) {}

  /** Stations sharing each waiting area (CT and X-ray share imaging's waiting room). */
  private static areas(): Map<string, StationId[]> {
    const areas = new Map<string, StationId[]>();
    for (const s of campus.stations) {
      if (!s.waiting_node) continue;
      areas.set(s.waiting_node, [...(areas.get(s.waiting_node) ?? []), s.id]);
    }
    return areas;
  }

  async tick(at: string = this.deps.clock.now()): Promise<QueueState[]> {
    const { background, cameras, engine, runtime, store } = this.deps;
    const atMs = Date.parse(at);
    const snapshots = background.get().snapshots;
    const snapshot = (station: StationId) =>
      [...snapshots].reverse().find((s) => s.station_id === station && Date.parse(s.at) <= atMs);
    const journeys = store.listAggregates<Journey>("journey");
    const liveWaiting = (station: StationId) =>
      journeys.filter((j) =>
        j.itinerary?.stops.some((s) => s.station_id === station && s.status === "waiting"),
      ).length;

    const published: QueueState[] = [];
    for (const [node, stations] of SensingLoop.areas()) {
      const ticketed = new Map(
        stations.map((id) => [id, (snapshot(id)?.count ?? 0) + liveWaiting(id)]),
      );
      const areaTickets = [...ticketed.values()].reduce((a, b) => a + b, 0);
      const camera = cameras.cameraFor(node);
      const frame = camera ? cameras.frame(camera, areaTickets) : undefined;
      const sensedArea = frame && this.deps.count ? await this.deps.count(frame) : undefined;

      for (const id of stations) {
        const tickets = ticketed.get(id) ?? 0;
        // A shared room's count is split by each station's share of the tickets.
        const share = areaTickets > 0 ? tickets / areaTickets : 1 / stations.length;
        const sensed = sensedArea === undefined ? undefined : sensedArea * share;
        const fused = engine.fuseQueue({
          ticketed: tickets,
          ...(sensed === undefined ? {} : { sensed, frame_age_min: 0 }),
        });
        // Operational servers come from the simulated day, which includes outages and the
        // ops actions approved so far.
        const live = runtime.station(id);
        const open = snapshot(id)?.open_servers ?? live.open_servers;
        const wait = engine.estimateWait({
          station_id: id,
          count: fused.count_fused,
          ...(open === undefined ? {} : { open_servers: open }),
        });
        const queue: QueueState = {
          station_id: id,
          at,
          ...(sensed === undefined ? {} : { count_sensed: Math.round(sensed * 10) / 10 }),
          count_ticketed: tickets,
          count_fused: fused.count_fused,
          est_wait_min: wait.est_wait_min,
          source: fused.source,
        };
        if (open !== undefined && live.open_servers !== open) {
          runtime.saveStation({ ...live, open_servers: open });
        }
        await runtime.ingest({ type: "QueueStateUpdated", station_id: id, payload: { queue } });
        published.push(queue);
      }
    }
    return published;
  }

  /** Runs a tick at every sim minute while the clock moves. */
  start(): void {
    const schedule = () => {
      const next = Math.floor(this.deps.clock.nowMsValue() / 60_000) * 60_000 + 60_000;
      this.timer = this.deps.clock.at(next, "sensing tick", async () => {
        await this.tick();
        schedule();
      });
    };
    schedule();
  }

  stop(): void {
    if (this.timer !== undefined) this.deps.clock.cancel(this.timer);
    this.timer = undefined;
  }
}
