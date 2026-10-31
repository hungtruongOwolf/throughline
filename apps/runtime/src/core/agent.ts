import type { z } from "zod";
import type {
  AgentName,
  Capability,
  DomainEvent,
  EventType,
  EVENT_PAYLOADS,
  Journey,
  Language,
  OpsAction,
  QueueState,
  StationId,
} from "@throughline/shared";
import type { ModelTool } from "../models/types";

/** Station-scoped aggregate for the OpsRuntime. */
export interface StationState {
  id: StationId;
  synthetic: true;
  queue?: QueueState;
  open_servers?: number;
  ops_actions: OpsAction[];
  paused_for_review: boolean;
  version: number;
}

/** An event a handler wants to emit; the runtime fills id, time, scope, and the synthetic flag. */
export type NewEvent = {
  [T in EventType]: {
    type: T;
    payload: z.infer<(typeof EVENT_PAYLOADS)[T]>;
    journey_id?: string;
    station_id?: StationId;
  };
}[EventType];

export interface OutboundText {
  text: string;
  language: Language;
}

/** What every handler returns (spec 4.3 step 7). */
export interface HandlerResult {
  summary: string;
  journey_patch?: (journey: Journey) => Journey;
  station_patch?: (station: StationState) => StationState;
  next_events: NewEvent[];
  review_reason?: string;
  /** Generated patient-facing text, screened by the clinical-content classifier before sending. */
  outbound?: OutboundText[];
}

export interface HandlerContext {
  event: DomainEvent;
  capability: Capability;
  now: string;
  journey?: Journey;
  station?: StationState;
  /** Set when a parked event is replayed after a human approved it. */
  approved_by?: string;
}

/** A model agent's loop contract (spec 6): read tools, then exactly one validated required tool. */
export interface ModelSpec<Args> {
  system: string;
  input: (ctx: HandlerContext) => string;
  tools: ModelTool[];
  readTools: Record<string, (args: unknown, ctx: HandlerContext) => Promise<unknown> | unknown>;
  requiredTool: string;
  requiredSchema: z.ZodType<Args>;
  /** Zod schemas for read-tool arguments. */
  readSchemas: Record<string, z.ZodType>;
  effort: "minimal" | "low" | "medium" | "high";
  maxSteps: number;
  maxOutputTokens: number;
  /** Turns the validated required-tool arguments into a handler result. */
  apply: (args: Args, ctx: HandlerContext) => HandlerResult | Promise<HandlerResult>;
}

export interface AgentDescriptor {
  name: AgentName;
  capabilities: readonly Capability[];
  risk: "LOW" | "MEDIUM" | "HIGH";
}

export interface DeterministicAgent extends AgentDescriptor {
  kind: "deterministic";
  handle: (ctx: HandlerContext) => HandlerResult | Promise<HandlerResult>;
}

export interface ModelAgent<Args = unknown> extends AgentDescriptor {
  kind: "model";
  model: ModelSpec<Args>;
  /** Deterministic fallback when the model fails twice (spec 4.3 step 6). */
  fallback: (ctx: HandlerContext) => HandlerResult | Promise<HandlerResult>;
}

export type Agent = DeterministicAgent | ModelAgent<never>;
