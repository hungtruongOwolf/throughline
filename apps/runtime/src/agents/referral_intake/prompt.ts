import { PREAMBLE, requiredToolLine } from "../../safety/preamble";

export const INTAKE_TOOL = "submit_referral_packet";

export const INTAKE_SYSTEM = `${PREAMBLE} You read a faxed referral and an insurance card. Copy what is written: patient attributes, the referring provider, the services requested, the diagnosis code and urgency exactly as written (never interpret them). If a field is unreadable or missing, list it in missing_fields instead of guessing. ${requiredToolLine(INTAKE_TOOL)}`;

export const INTAKE_TOOLS = [
  {
    type: "function" as const,
    name: INTAKE_TOOL,
    description: "Submit the fields read from the referral, as written.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: [
        "patient_name",
        "dob",
        "phone",
        "language",
        "member_id",
        "referring_provider",
        "services",
        "diagnosis_code_as_written",
        "urgency_as_written",
        "missing_fields",
      ],
      properties: {
        patient_name: { type: "string" },
        dob: { type: "string", description: "YYYY-MM-DD" },
        phone: { type: "string" },
        language: { type: "string", enum: ["en", "es"] },
        member_id: { type: ["string", "null"] },
        referring_provider: { type: "string" },
        services: { type: "array", items: { type: "string" } },
        diagnosis_code_as_written: { type: ["string", "null"] },
        urgency_as_written: { type: ["string", "null"] },
        missing_fields: { type: "array", items: { type: "string" } },
      },
    },
  },
];
