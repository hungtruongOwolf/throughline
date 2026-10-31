import { z } from "zod";
import type { Engine } from "@throughline/engine/node";
import { campus } from "@throughline/hospital";
import { t, type DomainEvent, type Journey, type Stop } from "@throughline/shared";
import type { HandlerContext, HandlerResult, ModelAgent } from "../../core/agent";
import { directionSteps, outbound } from "../shared/messages";
import { companionDescriptor } from "./descriptor";
import { COMPANION_SYSTEM, COMPANION_TOOL, COMPANION_TOOLS } from "./prompt";

const Args = z.object({
  text: z.string().min(1).max(400),
  kind: z.enum(["next_stop", "wait_update", "directions", "handoff"]),
});
type Args = z.infer<typeof Args>;

function stationName(stop: Stop): string {
  const node = campus.nodes.find((n) => n.id === stop.node_id);
  return node?.kind === "station"
    ? node.label
    : (campus.stations.find((s) => s.id === stop.station_id)?.name ?? stop.station_id);
}

function clock(iso: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${Number(m[1])}:${m[2]}` : iso;
}

function nextStop(journey: Journey): Stop | undefined {
  return journey.itinerary?.stops.find((s) => s.status !== "done" && s.status !== "skipped");
}

/** The facts a message may use: no names, dates of birth, or phone numbers (cloud tier). */
function facts(ctx: HandlerContext): string {
  const journey = ctx.journey as Journey;
  const stop = nextStop(journey);
  const lines = [`Patient language: ${journey.patient.language}`, `Event: ${ctx.event.type}`];
  if (stop) {
    lines.push(
      `Next stop: ${stationName(stop)} (${stop.station_id})`,
      `People ahead: ${stop.people_ahead ?? 0}`,
      `Minutes: about ${Math.round(stop.est_wait_min ?? 0)}`,
      `Starts about: ${clock(stop.eta_start)}`,
    );
  } else {
    lines.push("No stops left today.");
  }
  if (ctx.event.type === "ItineraryReplanned")
    lines.push(`Reason: ${ctx.event.payload.reason.join("; ")}`);
  return lines.join("\n");
}

/** Deterministic message for an event, from the EN/ES copy tables (spec 6 fallback). */
function templateText(ctx: HandlerContext): string {
  const journey = ctx.journey as Journey;
  const lang = journey.patient.language;
  const stop = nextStop(journey);
  if (!stop) return t(lang, "companion.done_for_today");
  const place = stationName(stop);
  switch (ctx.event.type) {
    case "ItineraryReplanned":
      return t(lang, "companion.replanned", { place, time: clock(stop.eta_start) });
    case "PatientLost":
      return t(lang, "companion.lost", { place });
    case "ResultReady":
      return t(lang, "companion.result_ready");
    default: {
      const minutes = Math.round(stop.est_wait_min ?? 0);
      return minutes <= 1
        ? t(lang, "companion.next_stop_short", { place, ahead: stop.people_ahead ?? 0 })
        : t(lang, "companion.next_stop", { place, ahead: stop.people_ahead ?? 0, minutes });
    }
  }
}

function send(ctx: HandlerContext, text: string): HandlerResult {
  const journey = ctx.journey as Journey;
  const out = outbound(journey, text, ctx.now);
  return { summary: text, journey_patch: out.patch, outbound: out.outbound, next_events: [] };
}

/** Directions after a sign photo located the patient (spec V5): A* steps as text. */
function directions(ctx: HandlerContext, engine: Engine): HandlerResult {
  const journey = ctx.journey as Journey;
  const event = ctx.event as Extract<DomainEvent, { type: "PatientLocated" }>;
  const stop = nextStop(journey);
  if (!stop) return { summary: "no stop to direct to", next_events: [] };
  const lang = journey.patient.language;
  const route = engine.walkingRoute({
    from: event.payload.node_id,
    to: stop.node_id,
    mobility: journey.memory.mobility === "wheelchair" ? "wheelchair" : "walking",
  });
  const steps = directionSteps(route.steps, lang);
  const out = outbound(
    journey,
    t(lang, "companion.directions", { place: stationName(stop), steps: steps.join(" ") }),
    ctx.now,
  );
  return {
    summary: `directions to ${stop.node_id}`,
    journey_patch: (j) => {
      const patched = out.patch(j);
      return {
        ...patched,
        kpis: { ...patched.kpis, direction_requests: (patched.kpis.direction_requests ?? 0) + 1 },
      };
    },
    outbound: out.outbound,
    next_events: [{ type: "DirectionsSent", payload: { steps, to_node_id: stop.node_id } }],
  };
}

/**
 * The companion (spec 6): writes patient messages with Muse Spark (cloud tier: the facts carry
 * no identifiers) and falls back to EN/ES templates; directions and handoffs are code.
 */
export function createCompanionAgent(deps: { engine: Engine }): ModelAgent<Args> {
  return {
    ...companionDescriptor,
    kind: "model",
    modelCapabilities: ["patient.message"],
    handle: (ctx) => {
      if (ctx.capability === "directions.send") return directions(ctx, deps.engine);
      if (ctx.capability === "handoff.request") {
        const lang = ctx.journey?.patient.language ?? "en";
        return {
          ...send(ctx, t(lang, "handoff.nurse")),
          review_reason: "Patient asked a clinical question",
          next_events: [{ type: "HandoffRequested", payload: { reason: "clinical_question" } }],
        };
      }
      return { summary: `not handled: ${ctx.capability}`, next_events: [] };
    },
    model: {
      system: COMPANION_SYSTEM,
      input: facts,
      tools: COMPANION_TOOLS,
      readTools: {},
      readSchemas: {},
      requiredTool: COMPANION_TOOL,
      requiredSchema: Args,
      effort: "low",
      maxSteps: 2,
      maxOutputTokens: 600,
      apply: (args, ctx) => send(ctx, args.text),
    },
    fallback: (ctx) =>
      ctx.journey ? send(ctx, templateText(ctx)) : { summary: "no journey", next_events: [] },
  };
}
