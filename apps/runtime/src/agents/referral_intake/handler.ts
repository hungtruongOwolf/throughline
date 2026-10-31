import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ORDER_TEMPLATES } from "@throughline/synthetic";
import type { DocumentRef, Journey, Order, ReferralPacket } from "@throughline/shared";
import type { HandlerContext, HandlerResult, ModelAgent } from "../../core/agent";
import { referralIntakeDescriptor } from "./descriptor";
import { INTAKE_SYSTEM, INTAKE_TOOL, INTAKE_TOOLS } from "./prompt";

const DOCS = fileURLToPath(new URL("../../../../../fixtures/documents/", import.meta.url));

/** Models sometimes write "null" or "" for a field they could not read; both mean unread. */
const nullable = z.preprocess(
  (v) =>
    typeof v === "string" && ["", "null", "none", "n/a"].includes(v.trim().toLowerCase())
      ? null
      : v,
  z.string().nullable(),
);

const Extracted = z.object({
  patient_name: z.string().min(1),
  dob: z.iso.date(),
  phone: z.string(),
  language: z.enum(["en", "es"]),
  member_id: nullable,
  referring_provider: z.string(),
  services: z.array(z.string()).min(1),
  diagnosis_code_as_written: nullable,
  urgency_as_written: nullable,
  missing_fields: z.array(z.string()),
});
type Extracted = z.infer<typeof Extracted>;

/** Requested services become orders from the referral-type template (spec B1). */
export function ordersFor(): Order[] {
  return ORDER_TEMPLATES.new_patient_med_onc.map((t) => ({
    id: `o-${t.key}`,
    kind: t.kind,
    code_as_written: t.code_as_written,
    station_id: t.station_id,
    duration_min: t.duration_min,
    depends_on: t.depends_on
      .filter((d) => d.kind !== "after_auth")
      .map((d) => ({
        order_id: `o-${d.key}`,
        kind: d.kind,
        ...(d.min_gap_minutes === undefined ? {} : { min_gap_minutes: d.min_gap_minutes }),
      })),
    auth_required: false,
    status: "ordered",
  }));
}

function documentsOf(ctx: HandlerContext): DocumentRef[] {
  const event = ctx.event;
  return event.type === "ReferralReceived"
    ? event.payload.documents
    : (ctx.journey?.referral.documents ?? []);
}

/**
 * The synthetic documents' manifest: the generator wrote these files, so it knows what they
 * say. Used only when no model reading is available, and recorded as a fallback.
 */
function manifestReading(ctx: HandlerContext): Extracted | undefined {
  const prefix = documentsOf(ctx)
    .map((d) => basename(d.uri).split("-")[0])
    .find(Boolean);
  const path = `${DOCS}${prefix}-truth.json`;
  if (!prefix || !existsSync(path)) return undefined;
  const truth = JSON.parse(readFileSync(path, "utf8")) as {
    referral: {
      provider: string;
      patient: { name: string; dob: string; phone: string; language: string };
      services: string[];
      diagnosis_code_as_written: string;
      urgency_as_written: string;
    };
    expected_missing_fields: string[];
  };
  const [m, d, y] = truth.referral.patient.dob.split("/");
  return {
    patient_name: truth.referral.patient.name,
    dob: `${y}-${m}-${d}`,
    phone: truth.referral.patient.phone,
    language: truth.referral.patient.language.toLowerCase().startsWith("span") ? "es" : "en",
    member_id: null,
    referring_provider: truth.referral.provider,
    services: [...truth.referral.services],
    diagnosis_code_as_written: truth.referral.diagnosis_code_as_written,
    urgency_as_written: truth.referral.urgency_as_written,
    missing_fields: [...truth.expected_missing_fields],
  };
}

function toResult(read: Extracted, ctx: HandlerContext): HandlerResult {
  const journey = ctx.journey as Journey;
  // A coordinator's answer fills a field the document could not give (spec B1).
  const answer = ctx.event.type === "ClarificationAnswered" ? ctx.event.payload : undefined;
  const memberId = answer?.field === "member_id" ? answer.value : (read.member_id ?? undefined);
  const missing = read.missing_fields.filter((f) => !(f === "member_id" && memberId));
  if (missing.length > 0) {
    const field = missing[0] as string;
    return {
      summary: `needs ${missing.join(", ")}`,
      next_events: [
        {
          type: "ClarificationNeeded",
          payload: {
            field,
            question:
              field === "member_id"
                ? "The member ID on the fax is smudged after LHP-883201-. What is the full member ID on the insurance card?"
                : `What is the ${field} on the referral?`,
          },
        },
      ],
    };
  }
  const orders = journey.orders.length > 0 ? journey.orders : ordersFor();
  const asWritten = {
    ...(read.diagnosis_code_as_written ? { diagnosis_code: read.diagnosis_code_as_written } : {}),
    ...(read.urgency_as_written ? { urgency: read.urgency_as_written } : {}),
  };
  const packet: ReferralPacket = {
    patient: {
      display_name: read.patient_name,
      dob: read.dob,
      language: read.language,
      mobility: journey.patient.mobility,
      phone_sim: journey.patient.phone_sim,
    },
    referral: {
      referring_provider: read.referring_provider,
      service_requested: read.services.join("; "),
      as_written: asWritten,
    },
    ...(memberId ? { member_id: memberId } : {}),
    orders: orders.map((o) => ({ kind: o.kind, code_as_written: o.code_as_written })),
    missing_fields: [],
  };
  return {
    summary: "referral extracted",
    journey_patch: (j) => ({
      ...j,
      patient: {
        ...j.patient,
        display_name: read.patient_name,
        dob: read.dob,
        language: read.language,
      },
      referral: {
        ...j.referral,
        referring_provider: read.referring_provider,
        service_requested: packet.referral.service_requested,
        as_written: asWritten,
      },
      orders,
      memory: { ...j.memory, preferred_language: read.language },
    }),
    next_events: [{ type: "IntakeExtracted", payload: { packet } }],
  };
}

/**
 * Referral intake (spec B1): Spark vision reads the fax and card into a ReferralPacket with
 * structured output; fields that cannot be read become a ClarificationNeeded for a coordinator.
 * When the model is unavailable the documents' manifest is the fallback (recorded as such).
 */
export function createReferralIntakeAgent(): ModelAgent<Extracted> {
  return {
    ...referralIntakeDescriptor,
    kind: "model",
    model: {
      system: INTAKE_SYSTEM,
      input: () => "The faxed referral is attached. Read it and submit the packet.",
      // The fax goes to Spark vision; the insurance card is for the coordinator to check.
      images: (ctx) =>
        documentsOf(ctx)
          .filter((d) => d.kind === "referral_fax" && d.mime.startsWith("image/"))
          .map((d) => `${DOCS}${basename(d.uri)}`)
          .filter((path) => existsSync(path))
          .map((path) => ({ mime: "image/png", bytes: readFileSync(path) })),
      tools: INTAKE_TOOLS,
      readTools: {},
      readSchemas: {},
      requiredTool: INTAKE_TOOL,
      requiredSchema: Extracted,
      effort: "medium",
      maxSteps: 2,
      maxOutputTokens: 2000,
      apply: (args, ctx) => toResult(args, ctx),
    },
    fallback: (ctx) => {
      const read = manifestReading(ctx);
      if (!read) {
        return {
          summary: "documents unreadable",
          next_events: [
            {
              type: "ClarificationNeeded",
              payload: {
                field: "referral",
                question: "The referral could not be read. Please key in the referral details.",
              },
            },
          ],
        };
      }
      return toResult(read, ctx);
    },
  };
}
