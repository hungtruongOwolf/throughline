import { randomUUID } from "node:crypto";
import {
  BLOCKING,
  isOpsEventType,
  Journey,
  nextState,
  phaseOf,
  TERMINAL_STATES,
  type Capability,
  type DomainEvent,
  type HumanReview,
  type StationId,
} from "@throughline/shared";
import type { EventBus, Envelope } from "../bus/event-bus";
import type { SimClock } from "../bus/sim-clock";
import type { RuntimeStore } from "../bus/store";
import { classifyClinical } from "../safety/classifier";
import type { Agent, HandlerContext, HandlerResult, NewEvent, StationState } from "./agent";
import type { AgentRunner } from "./agent-runner";
import { createStation } from "./journeys";
import { projectJourney } from "./projection";
import { route, type Invocation } from "./orchestrator";
import { checkGate } from "./safety-gate";

/** Spec 12.1 test 7: cascades stop at this depth. */
export const MAX_DEPTH = 12;

/** Events still handled while a journey is paused for review or closed (spec 4.3 step 3). */
const ALLOWED_WHEN_HELD = new Set<string>([
  "HumanReviewResolved",
  "HandoffRequested",
  "HandoffResolved",
  "OpsActionApproved",
  "OpsActionRejected",
]);

export interface RuntimeDeps {
  store: RuntimeStore;
  bus: EventBus;
  clock: SimClock;
  runner: AgentRunner;
  agents: Agent[];
  providerReviewOn: boolean;
}

/**
 * The journey and ops runtimes (spec 4.3). One class, two scopes: journey events load a
 * Journey aggregate, station events load a StationState. The event sets are disjoint
 * (JOURNEY_EVENT_TYPES / OPS_EVENT_TYPES), so each event has exactly one owner.
 */
export class Runtime {
  private readonly agents = new Map<string, Agent>();

  constructor(private readonly deps: RuntimeDeps) {
    for (const agent of deps.agents) this.agents.set(agent.name, agent);
  }

  start(): () => void {
    return this.deps.bus.subscribe("*", (envelope) => this.handle(envelope));
  }

  // ---- aggregates -------------------------------------------------------------------------

  journey(id: string): Journey | undefined {
    return this.deps.store.loadAggregate<Journey>("journey", id)?.value;
  }

  saveJourney(journey: Journey): Journey {
    const next = Journey.parse({
      ...journey,
      version: journey.version + 1,
      updated_at: this.deps.clock.now(),
    });
    this.deps.store.saveAggregate("journey", next.id, next.version, next);
    return next;
  }

  station(id: StationId): StationState {
    return this.deps.store.loadAggregate<StationState>("station", id)?.value ?? createStation(id);
  }

  saveStation(station: StationState): StationState {
    const next = { ...station, version: station.version + 1 };
    this.deps.store.saveAggregate("station", next.id, next.version, next);
    return next;
  }

  // ---- ingest and emit --------------------------------------------------------------------

  /** Routes and the simulator call this: persist, publish, return (spec 4.3 step 1). */
  async ingest(event: NewEvent): Promise<DomainEvent | undefined> {
    const stored = this.append(event, 0);
    if (stored) await this.deps.bus.publish({ event: stored, depth: 0 });
    return stored;
  }

  /**
   * Appends one event to the log. Journey events must be legal transitions: an illegal one is
   * rejected and logged, never appended (spec 12.1 test 2).
   */
  private append(input: NewEvent, depth: number): DomainEvent | undefined {
    const event = {
      id: randomUUID(),
      occurred_at: this.deps.clock.now(),
      synthetic: true,
      ...input,
    } as DomainEvent;
    if (!isOpsEventType(event.type)) {
      const journey = event.journey_id ? this.journey(event.journey_id) : undefined;
      if (!journey) {
        this.log("warn", { msg: "event for unknown journey", type: event.type });
        return undefined;
      }
      let to;
      try {
        to = nextState(journey.state, event.type);
      } catch (e) {
        this.log("error", {
          msg: "transition_rejected",
          type: event.type,
          from: journey.state,
          error: String(e),
        });
        return undefined;
      }
      const projected = projectJourney(journey, event);
      if (to || projected !== journey) {
        this.saveJourney(to ? { ...projected, state: to, phase: phaseOf(to) } : projected);
      }
    }
    this.deps.store.appendEvent(event, depth);
    return event;
  }

  private emit(events: NewEvent[], depth: number, publish: (e: DomainEvent) => boolean): void {
    for (const e of events) {
      const stored = this.append(e, depth);
      if (stored && publish(stored)) this.deps.bus.enqueue({ event: stored, depth });
    }
  }

  // ---- handling ---------------------------------------------------------------------------

  private async handle({ event, depth }: Envelope): Promise<void> {
    if (depth > MAX_DEPTH) {
      this.log("warn", { msg: "depth_guard", type: event.type, depth });
      return;
    }
    if (event.type === "HumanReviewResolved") {
      await this.resolve(event.payload.review_id, event.payload.decision, event.payload.by, depth);
      return;
    }
    if (event.type === "OpsActionApproved" || event.type === "OpsActionRejected") {
      const review = this.deps.store
        .reviews("pending")
        .find(
          (r) =>
            r.capability === "ops_action.apply" &&
            (r.pending_event as DomainEvent | undefined)?.type === "OpsActionProposed" &&
            (r.pending_event as Extract<DomainEvent, { type: "OpsActionProposed" }>).payload.action
              .id === event.payload.action_id,
        );
      if (review) {
        const decision = event.type === "OpsActionApproved" ? "approved" : "rejected";
        await this.resolve(review.id, decision, event.payload.by, depth);
      }
      return;
    }
    if (event.type === "HandoffResolved") {
      const review = this.deps.store.review(event.payload.review_id);
      if (review) {
        this.deps.store.saveReview({
          ...review,
          status: "resolved",
          resolved_by: event.payload.by,
          resolved_at: event.occurred_at,
        });
      }
      const journey = event.journey_id ? this.journey(event.journey_id) : undefined;
      if (journey) this.saveJourney({ ...journey, handoff_open: false });
      return;
    }

    const ctx = this.contextFor(event);
    const held = ctx.journey
      ? ctx.journey.paused_for_review || TERMINAL_STATES.includes(ctx.journey.state)
      : ctx.station?.paused_for_review;
    if (held && !ALLOWED_WHEN_HELD.has(event.type)) {
      this.log("info", { msg: "dropped_while_held", type: event.type, event_id: event.id });
      return;
    }
    for (const invocation of route(event, ctx)) {
      await this.invoke(invocation, event, depth);
    }
  }

  private contextFor(event: DomainEvent): { journey?: Journey; station?: StationState } {
    if (isOpsEventType(event.type)) {
      return event.station_id ? { station: this.station(event.station_id) } : {};
    }
    const journey = event.journey_id ? this.journey(event.journey_id) : undefined;
    return journey ? { journey } : {};
  }

  private async invoke(
    inv: Invocation,
    event: DomainEvent,
    depth: number,
    approvedBy?: string,
  ): Promise<void> {
    const agent = this.agents.get(inv.agent);
    if (!agent) {
      this.log("info", { msg: "no_agent", agent: inv.agent, capability: inv.capability });
      return;
    }
    const gate = checkGate(agent, inv.capability, {
      providerReviewOn: this.deps.providerReviewOn,
      ...(approvedBy ? { approvedBy } : {}),
    });
    if (gate.verdict === "blocked") {
      this.log("warn", {
        msg: "gate_blocked",
        agent: agent.name,
        capability: inv.capability,
        reason: gate.reason,
      });
      return;
    }
    if (gate.verdict === "requires_human_approval") {
      this.park(inv, agent, event, gate.reason, depth);
      return;
    }

    const scope = this.contextFor(event);
    const ctx: HandlerContext = {
      event,
      capability: inv.capability,
      now: this.deps.clock.now(),
      ...scope,
      ...(approvedBy ? { approved_by: approvedBy } : {}),
    };
    let { result } = await this.deps.runner.run(agent, ctx);
    result = await this.screenOutbound(result, agent, ctx);
    this.apply(result, inv.capability, agent, event, depth);
  }

  /** Spec 6.2: generated patient text with clinical content is blocked; the fallback is sent. */
  private async screenOutbound(
    result: HandlerResult,
    agent: Agent,
    ctx: HandlerContext,
  ): Promise<HandlerResult> {
    const hit = result.outbound?.map((o) => classifyClinical(o.text)).find((c) => c !== undefined);
    if (!hit) return result;
    const blocked: NewEvent = {
      type: "ContentBlocked",
      payload: { capability: ctx.capability, category: hit },
      ...(ctx.journey ? { journey_id: ctx.journey.id } : {}),
    };
    const fallback =
      agent.kind === "model"
        ? await agent.fallback(ctx)
        : { summary: "blocked", next_events: [], outbound: [] };
    return { ...fallback, next_events: [blocked, ...fallback.next_events] };
  }

  private apply(
    result: HandlerResult,
    capability: Capability,
    agent: Agent,
    event: DomainEvent,
    depth: number,
  ): void {
    const scoped = (e: NewEvent): NewEvent =>
      isOpsEventType(e.type)
        ? { ...e, station_id: e.station_id ?? event.station_id }
        : { ...e, journey_id: e.journey_id ?? event.journey_id };
    const next = result.next_events.map(scoped);

    if (event.journey_id && result.journey_patch) {
      const journey = this.journey(event.journey_id);
      if (journey) this.saveJourney(result.journey_patch(journey));
    }
    if (event.station_id && result.station_patch) {
      this.saveStation(result.station_patch(this.station(event.station_id)));
    }

    if (BLOCKING.has(capability)) {
      // Logged for audit, not propagated; only the review request goes out (spec 4.3 step 7).
      this.emit(next, depth + 1, () => false);
      const review = this.openReview({
        kind: "handoff",
        capability,
        agent: agent.name,
        reason: result.review_reason ?? result.summary,
        event,
      });
      if (event.journey_id) {
        const journey = this.journey(event.journey_id);
        if (journey) this.saveJourney({ ...journey, handoff_open: true });
      }
      this.requestReview(review, depth);
      return;
    }
    this.emit(next, depth + 1, () => true);
  }

  // ---- human gates ------------------------------------------------------------------------

  private openReview(input: {
    kind: HumanReview["kind"];
    capability: Capability;
    agent: Agent["name"];
    reason: string;
    event: DomainEvent;
    pending?: DomainEvent;
  }): HumanReview {
    const review: HumanReview = {
      id: randomUUID(),
      kind: input.kind,
      ...(input.event.journey_id ? { journey_id: input.event.journey_id } : {}),
      ...(input.event.station_id ? { station_id: input.event.station_id } : {}),
      reason: input.reason,
      capability: input.capability,
      agent: input.agent,
      status: "pending",
      ...(input.pending ? { pending_event: input.pending } : {}),
    };
    this.deps.store.saveReview(review);
    return review;
  }

  private requestReview(review: HumanReview, depth: number): void {
    // Station reviews surface as the proposal itself; HumanReviewRequested is journey-scoped.
    if (!review.journey_id) return;
    this.emit(
      [
        {
          type: "HumanReviewRequested",
          journey_id: review.journey_id,
          payload: {
            review_id: review.id,
            kind: review.kind,
            capability: review.capability,
            reason: review.reason,
          },
        },
      ],
      depth + 1,
      () => true,
    );
  }

  /**
   * "Talk to a person" (spec 9.3): the patient asks for a human directly. Same outcome as a
   * BLOCKING handoff: a handoff review, `handoff_open`, and a review request on the bus.
   */
  async openHandoff(journeyId: string, reason: "patient_asked" | "clinical_question") {
    const journey = this.journey(journeyId);
    if (!journey) return undefined;
    const requested = this.append(
      { type: "HandoffRequested", journey_id: journeyId, payload: { reason } },
      0,
    );
    if (!requested) return undefined;
    const review = this.openReview({
      kind: "handoff",
      capability: "handoff.request",
      agent: "companion",
      reason:
        reason === "patient_asked" ? "Patient asked to talk to a person" : "Clinical question",
      event: requested,
    });
    this.saveJourney({ ...(this.journey(journeyId) ?? journey), handoff_open: true });
    this.requestReview(review, 0);
    await this.deps.bus.idle();
    return review;
  }

  /** A staff task on a journey (spec V7: a lost patient becomes a task on the station board). */
  openTask(journeyId: string, reason: string) {
    const journey = this.journey(journeyId);
    if (!journey) return undefined;
    const review: HumanReview = {
      id: randomUUID(),
      kind: "task",
      journey_id: journeyId,
      reason,
      capability: "patient.message",
      agent: "companion",
      status: "pending",
    };
    this.deps.store.saveReview(review);
    this.requestReview(review, 0);
    return review;
  }

  /** PRE_APPROVAL: park the event verbatim and hold the aggregate (spec 4.3 step 5). */
  private park(inv: Invocation, agent: Agent, event: DomainEvent, reason: string, depth: number) {
    const review = this.openReview({
      kind: "approval",
      capability: inv.capability,
      agent: agent.name,
      reason,
      event,
      pending: event,
    });
    if (event.journey_id) {
      const journey = this.journey(event.journey_id);
      if (journey) this.saveJourney({ ...journey, paused_for_review: true });
    } else if (event.station_id) {
      this.saveStation({ ...this.station(event.station_id), paused_for_review: true });
    }
    this.requestReview(review, depth);
  }

  /** Approve → replay the parked event with approved_by; reject → discard and record. */
  async resolve(
    reviewId: string,
    decision: "approved" | "rejected",
    by: string,
    depth = 0,
  ): Promise<void> {
    const review = this.deps.store.review(reviewId);
    if (!review || review.status !== "pending") {
      this.log("warn", { msg: "review_not_pending", review_id: reviewId });
      return;
    }
    this.deps.store.saveReview({
      ...review,
      status: decision === "approved" ? "resolved" : "rejected",
      resolved_by: by,
      resolved_at: this.deps.clock.now(),
    });
    if (review.journey_id) {
      const journey = this.journey(review.journey_id);
      if (journey) this.saveJourney({ ...journey, paused_for_review: false });
    } else if (review.station_id) {
      this.saveStation({ ...this.station(review.station_id), paused_for_review: false });
    }
    if (decision === "rejected" || !review.pending_event) return;

    const parked = review.pending_event as DomainEvent;
    // The verbatim event plus who approved it; payload schemas allow extra keys.
    const replayed = {
      ...parked,
      payload: { ...parked.payload, approved_by: by },
    } as unknown as DomainEvent;
    await this.invoke(
      { capability: review.capability, agent: review.agent },
      replayed,
      depth + 1,
      by,
    );
  }

  private log(level: "info" | "warn" | "error", entry: Record<string, unknown>): void {
    this.deps.store.log(level, this.deps.clock.now(), entry);
  }
}
