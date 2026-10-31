import type { Capability } from "@throughline/shared";

/** A function tool definition in the Responses API shape. */
export interface ModelTool {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}

/** A user message part: text, or an image as a data URL (Spark vision). */
export type ModelContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" };

export type ModelInputItem =
  | { role: "system" | "user" | "assistant"; content: string | ModelContentPart[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

export type ModelOutputItem =
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "message"; text: string };

export interface ModelRequest {
  capability: Capability;
  model?: string;
  input: ModelInputItem[];
  tools: ModelTool[];
  effort: "minimal" | "low" | "medium" | "high";
  maxOutputTokens: number;
  /** Text used by the PHI tier router to decide cloud vs private (spec 4.4). */
  phiProbe: string;
}

export interface ModelResponse {
  id: string;
  output: ModelOutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
  provider: "meta" | "modal" | "baseten" | "fireworks" | "glimmer";
  model: string;
  tier: "cloud" | "private";
  replayed: boolean;
}

/** Everything the agent runner needs from the model layer; tests swap in a scripted fake. */
export interface ModelGateway {
  respond(request: ModelRequest): Promise<ModelResponse>;
}
