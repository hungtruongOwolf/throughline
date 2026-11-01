import type { DomainEvent } from "@throughline/shared";

export interface Envelope {
  event: DomainEvent;
  /** Cascade depth: 0 for events from routes or the simulator, +1 per handler hop. */
  depth: number;
}

export type Subscriber = (envelope: Envelope) => Promise<void> | void;

/** Telemetry about the runtime itself (agent runs), streamed to screens but not logged as events. */
export type Telemetry = { type: "AgentRun"; run: import("@throughline/shared").AgentRun };

/**
 * In-process bus (spec 4.3 step 2). Delivery is sequential through a queue, so a handler
 * that publishes never re-enters another handler mid-flight and the log order is stable.
 */
export class EventBus {
  private subscribers: { types: ReadonlySet<string> | "*"; fn: Subscriber }[] = [];
  private queue: Envelope[] = [];
  private draining: Promise<void> | undefined;
  private watchers = new Set<(t: Telemetry) => void>();

  /** Listens to telemetry; returns the unsubscribe function. */
  onTelemetry(fn: (t: Telemetry) => void): () => void {
    this.watchers.add(fn);
    return () => this.watchers.delete(fn);
  }

  telemetry(t: Telemetry): void {
    for (const fn of this.watchers) fn(t);
  }

  subscribe(types: readonly string[] | "*", fn: Subscriber): () => void {
    const entry = { types: types === "*" ? ("*" as const) : new Set(types), fn };
    this.subscribers.push(entry);
    return () => {
      this.subscribers = this.subscribers.filter((s) => s !== entry);
    };
  }

  /**
   * Enqueues and returns a promise that resolves once the queue (and any cascade) is empty.
   * Handlers must use enqueue() instead: awaiting publish() inside a handler would wait on itself.
   */
  publish(envelope: Envelope): Promise<void> {
    this.enqueue(envelope);
    return this.draining ?? Promise.resolve();
  }

  enqueue(envelope: Envelope): void {
    this.queue.push(envelope);
    this.draining ??= this.drain().finally(() => {
      this.draining = undefined;
    });
  }

  /** Resolves when everything published so far has been handled. */
  idle(): Promise<void> {
    return this.draining ?? Promise.resolve();
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const envelope = this.queue.shift() as Envelope;
      for (const s of this.subscribers) {
        if (s.types === "*" || s.types.has(envelope.event.type)) await s.fn(envelope);
      }
    }
  }
}
