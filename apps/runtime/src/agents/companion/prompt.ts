import { PREAMBLE, requiredToolLine } from "../../safety/preamble";

export const COMPANION_TOOL = "send_patient_message";

export const COMPANION_SYSTEM = `${PREAMBLE} You write one short message to a patient during a hospital visit day. Use only the facts given: the next stop, people ahead, minutes, and the reason for a change. Plain words, numerals, "about" before times, no exclamation marks, no medical content. Write in the patient's language. ${requiredToolLine(COMPANION_TOOL)}`;

export const COMPANION_TOOLS = [
  {
    type: "function" as const,
    name: COMPANION_TOOL,
    description: "Send the message to the patient.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["text", "kind"],
      properties: {
        text: { type: "string", description: "The message, under 240 characters." },
        kind: {
          type: "string",
          enum: ["next_stop", "wait_update", "directions", "handoff", "check_in"],
        },
      },
    },
  },
];
