import type Database from "better-sqlite3";
import type { AgentRun, DomainEvent, HumanReview, ModelCallRecord } from "@throughline/shared";

export interface StoredEvent {
  seq: number;
  depth: number;
  event: DomainEvent;
}

/**
 * Persistence for the runtime: the append-only event log, aggregate snapshots, human reviews,
 * model-call telemetry, and a JSON-lines style runtime log. Events are never edited.
 */
export class RuntimeStore {
  constructor(readonly sqlite: Database.Database) {}

  appendEvent(event: DomainEvent, depth: number): number {
    const r = this.sqlite
      .prepare(
        "INSERT INTO events (id, type, journey_id, station_id, occurred_at, depth, json) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        event.id,
        event.type,
        event.journey_id ?? null,
        event.station_id ?? null,
        event.occurred_at,
        depth,
        JSON.stringify(event),
      );
    return Number(r.lastInsertRowid);
  }

  events(filter: { journeyId?: string; stationId?: string } = {}): StoredEvent[] {
    const rows = filter.journeyId
      ? this.sqlite
          .prepare("SELECT seq, depth, json FROM events WHERE journey_id = ? ORDER BY seq")
          .all(filter.journeyId)
      : filter.stationId
        ? this.sqlite
            .prepare("SELECT seq, depth, json FROM events WHERE station_id = ? ORDER BY seq")
            .all(filter.stationId)
        : this.sqlite.prepare("SELECT seq, depth, json FROM events ORDER BY seq").all();
    return (rows as { seq: number; depth: number; json: string }[]).map((r) => ({
      seq: r.seq,
      depth: r.depth,
      event: JSON.parse(r.json) as DomainEvent,
    }));
  }

  loadAggregate<T>(kind: string, id: string): { version: number; value: T } | undefined {
    const row = this.sqlite
      .prepare("SELECT version, json FROM aggregates WHERE kind = ? AND id = ?")
      .get(kind, id) as { version: number; json: string } | undefined;
    return row && { version: row.version, value: JSON.parse(row.json) as T };
  }

  saveAggregate(kind: string, id: string, version: number, value: unknown): void {
    this.sqlite
      .prepare("INSERT OR REPLACE INTO aggregates (kind, id, version, json) VALUES (?, ?, ?, ?)")
      .run(kind, id, version, JSON.stringify(value));
  }

  listAggregates<T>(kind: string): T[] {
    return (
      this.sqlite.prepare("SELECT json FROM aggregates WHERE kind = ?").all(kind) as {
        json: string;
      }[]
    ).map((r) => JSON.parse(r.json) as T);
  }

  saveReview(review: HumanReview): void {
    this.sqlite
      .prepare("INSERT OR REPLACE INTO reviews (id, status, json) VALUES (?, ?, ?)")
      .run(review.id, review.status, JSON.stringify(review));
  }

  review(id: string): HumanReview | undefined {
    const row = this.sqlite.prepare("SELECT json FROM reviews WHERE id = ?").get(id) as
      { json: string } | undefined;
    return row && (JSON.parse(row.json) as HumanReview);
  }

  reviews(status?: HumanReview["status"]): HumanReview[] {
    const rows = status
      ? this.sqlite.prepare("SELECT json FROM reviews WHERE status = ?").all(status)
      : this.sqlite.prepare("SELECT json FROM reviews").all();
    return (rows as { json: string }[]).map((r) => JSON.parse(r.json) as HumanReview);
  }

  recordModelCall(record: ModelCallRecord): void {
    this.sqlite
      .prepare("INSERT INTO model_calls (id, at, json) VALUES (?, ?, ?)")
      .run(record.id, record.at, JSON.stringify(record));
  }

  modelCalls(): ModelCallRecord[] {
    return (
      this.sqlite.prepare("SELECT json FROM model_calls ORDER BY rowid").all() as { json: string }[]
    ).map((r) => JSON.parse(r.json) as ModelCallRecord);
  }

  modelCallCount(): number {
    return (this.sqlite.prepare("SELECT COUNT(*) AS n FROM model_calls").get() as { n: number }).n;
  }

  /** Model calls recorded after the first `skip` rows (the calls one run made). */
  modelCallsAfter(skip: number): ModelCallRecord[] {
    return (
      this.sqlite
        .prepare("SELECT json FROM model_calls ORDER BY rowid LIMIT -1 OFFSET ?")
        .all(skip) as { json: string }[]
    ).map((r) => JSON.parse(r.json) as ModelCallRecord);
  }

  saveRun(run: AgentRun): void {
    this.sqlite
      .prepare(
        "INSERT OR REPLACE INTO agent_runs (id, agent, journey_id, at, json) VALUES (?, ?, ?, ?, ?)",
      )
      .run(run.id, run.agent, run.journey_id ?? null, run.at, JSON.stringify(run));
  }

  runs(filter: { agent?: string; journeyId?: string } = {}): AgentRun[] {
    const rows = filter.journeyId
      ? this.sqlite
          .prepare("SELECT json FROM agent_runs WHERE journey_id = ? ORDER BY seq")
          .all(filter.journeyId)
      : filter.agent
        ? this.sqlite
            .prepare("SELECT json FROM agent_runs WHERE agent = ? ORDER BY seq")
            .all(filter.agent)
        : this.sqlite.prepare("SELECT json FROM agent_runs ORDER BY seq").all();
    return (rows as { json: string }[]).map((r) => JSON.parse(r.json) as AgentRun);
  }

  run(id: string): AgentRun | undefined {
    const row = this.sqlite.prepare("SELECT json FROM agent_runs WHERE id = ?").get(id) as
      { json: string } | undefined;
    return row && (JSON.parse(row.json) as AgentRun);
  }

  modelCall(id: string): ModelCallRecord | undefined {
    const row = this.sqlite.prepare("SELECT json FROM model_calls WHERE id = ?").get(id) as
      { json: string } | undefined;
    return row && (JSON.parse(row.json) as ModelCallRecord);
  }

  /** Clears the log, aggregates, reviews, runs, and telemetry (not the model cache). */
  reset(): void {
    this.sqlite.exec(
      "DELETE FROM events; DELETE FROM aggregates; DELETE FROM reviews; DELETE FROM model_calls; DELETE FROM agent_runs; DELETE FROM runtime_log;",
    );
  }

  log(level: "info" | "warn" | "error", at: string, entry: Record<string, unknown>): void {
    this.sqlite
      .prepare("INSERT INTO runtime_log (at, level, json) VALUES (?, ?, ?)")
      .run(at, level, JSON.stringify(entry));
  }

  logs(): { level: string; entry: Record<string, unknown> }[] {
    return (
      this.sqlite.prepare("SELECT level, json FROM runtime_log ORDER BY seq").all() as {
        level: string;
        json: string;
      }[]
    ).map((r) => ({ level: r.level, entry: JSON.parse(r.json) as Record<string, unknown> }));
  }
}
