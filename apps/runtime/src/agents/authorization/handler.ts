import { z } from "zod";
import type { AuthPacket, DomainEvent, Journey } from "@throughline/shared";
import type { AgentDescriptor, HandlerContext, HandlerResult, ModelAgent } from "../../core/agent";
import { PREAMBLE, requiredToolLine } from "../../safety/preamble";

export const authorizationDescriptor: AgentDescriptor = {
  name: "authorization",
  capabilities: ["prior_auth.draft", "prior_auth.submit"],
  // Submission to the payer always waits for a coordinator (PRE_APPROVAL, spec B3).
  risk: "HIGH",
};

const DRAFT_TOOL = "submit_auth_draft";

const Args = z.object({
  sections: z
    .array(z.object({ heading: z.string().min(1), body: z.string().min(1).max(800) }))
    .min(2)
    .max(6),
});
type Args = z.infer<typeof Args>;

const SYSTEM = `${PREAMBLE} You draft a prior-authorization request for a payer from the referral's administrative facts. Quote codes and urgency exactly as written; never add clinical reasoning, findings, or anything not in the facts. A coordinator reviews every draft before it is sent. ${requiredToolLine(DRAFT_TOOL)}`;

const TOOLS = [
  {
    type: "function" as const,
    name: DRAFT_TOOL,
    description: "Submit the sections of the authorization request.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["sections"],
      properties: {
        sections: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["heading", "body"],
            properties: { heading: { type: "string" }, body: { type: "string" } },
          },
        },
      },
    },
  },
];

function authOrders(journey: Journey) {
  const ids = journey.coverage?.auth_required_order_ids ?? [];
  return journey.orders.filter((o) => ids.includes(o.id));
}

/** Administrative facts only: no name, date of birth, phone, or member id (cloud tier). */
function facts(journey: Journey): string {
  return [
    `Plan: ${journey.coverage?.plan_id ?? "unknown"}`,
    `Referring provider: ${journey.referral.referring_provider}`,
    `Service requested: ${journey.referral.service_requested}`,
    `Diagnosis code as written: ${journey.referral.as_written.diagnosis_code ?? "not given"}`,
    `Urgency as written: ${journey.referral.as_written.urgency ?? "not given"}`,
    `Services needing authorization: ${authOrders(journey)
      .map((o) => o.code_as_written)
      .join("; ")}`,
  ].join("\n");
}

/** The template draft (spec 6 fallback): the same facts, in fixed sections. */
function templateSections(journey: Journey): Args["sections"] {
  return [
    {
      heading: "Services requested",
      body: authOrders(journey)
        .map((o) => o.code_as_written)
        .join("\n"),
    },
    {
      heading: "Referral",
      body: `Referred by ${journey.referral.referring_provider} for ${journey.referral.service_requested}.`,
    },
    {
      heading: "As written on the referral",
      body: [
        `Diagnosis code: ${journey.referral.as_written.diagnosis_code ?? "not given"}`,
        `Urgency: ${journey.referral.as_written.urgency ?? "not given"}`,
      ].join("\n"),
    },
    {
      heading: "Coverage",
      body: `Plan ${journey.coverage?.plan_id ?? "unknown"}, eligibility active.`,
    },
  ];
}

function drafted(sections: Args["sections"], ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  const packet: AuthPacket = {
    id: `auth-${journey.id}-${journey.auth_packets.length + 1}`,
    order_ids: authOrders(journey).map((o) => o.id),
    status: "draft",
    sections,
  };
  return {
    summary: `drafted ${packet.id}`,
    journey_patch: (j) => ({ ...j, auth_packets: [...j.auth_packets, packet] }),
    next_events: [{ type: "PriorAuthDrafted", payload: { packet } }],
  };
}

/** Runs only on the replay after a coordinator approved the parked draft. */
function submit(ctx: HandlerContext): HandlerResult {
  const event = ctx.event as Extract<DomainEvent, { type: "PriorAuthDrafted" }>;
  const by = ctx.approved_by ?? "coordinator";
  const id = event.payload.packet.id;
  return {
    summary: `submitted ${id}`,
    journey_patch: (j) => ({
      ...j,
      auth_packets: j.auth_packets.map((p) =>
        p.id === id ? { ...p, status: "submitted", submitted_by: by } : p,
      ),
    }),
    next_events: [{ type: "PriorAuthSubmitted", payload: { packet_id: id, by } }],
  };
}

/**
 * Authorization (spec B3): Spark drafts the request from administrative facts (template
 * fallback); submitting it is PRE_APPROVAL, so the runtime parks it for a coordinator.
 */
export function createAuthorizationAgent(): ModelAgent<Args> {
  return {
    ...authorizationDescriptor,
    kind: "model",
    modelCapabilities: ["prior_auth.draft"],
    model: {
      system: SYSTEM,
      input: (ctx) => facts(ctx.journey as Journey),
      tools: TOOLS,
      readTools: {},
      readSchemas: {},
      requiredTool: DRAFT_TOOL,
      requiredSchema: Args,
      effort: "low",
      maxSteps: 2,
      maxOutputTokens: 1200,
      apply: (args, ctx) => drafted(args.sections, ctx),
    },
    fallback: (ctx) => drafted(templateSections(ctx.journey as Journey), ctx),
    handle: (ctx) =>
      ctx.capability === "prior_auth.submit"
        ? submit(ctx)
        : { summary: `not handled: ${ctx.capability}`, next_events: [] },
  };
}
