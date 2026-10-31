import OpenAI from "openai";
import type { ModelCache } from "./cache";
import type { ModelConfig } from "./config";
import { routeModelCall } from "./router";
import type {
  ModelGateway,
  ModelInputItem,
  ModelOutputItem,
  ModelRequest,
  ModelResponse,
} from "./types";

/** What the cache stores for a Responses call: the parts the runner reads, nothing else. */
interface StoredResponse {
  id: string;
  output: ModelOutputItem[];
  usage?: ModelResponse["usage"];
}

/** Our provider-agnostic input items → Responses API input items. */
function toResponsesInput(items: ModelInputItem[]) {
  return items.map((item) => {
    if ("role" in item) return { role: item.role, content: item.content };
    if (item.type === "function_call") {
      return {
        type: "function_call" as const,
        call_id: item.call_id,
        name: item.name,
        arguments: item.arguments,
      };
    }
    return { type: "function_call_output" as const, call_id: item.call_id, output: item.output };
  });
}

/** Responses output → the items the runner understands; reasoning items are dropped. */
function fromResponsesOutput(output: OpenAI.Responses.ResponseOutputItem[]): ModelOutputItem[] {
  const items: ModelOutputItem[] = [];
  for (const o of output) {
    if (o.type === "function_call") {
      items.push({
        type: "function_call",
        call_id: o.call_id,
        name: o.name,
        arguments: o.arguments,
      });
    } else if (o.type === "message") {
      const text = o.content.map((c) => (c.type === "output_text" ? c.text : "")).join("");
      items.push({ type: "message", text });
    }
  }
  return items;
}

/**
 * The cloud tier (spec 8.1): Muse Spark 1.3 on the Meta Model API through the Responses API.
 * `tool_choice` stays "auto" (named/required are rejected); the runner enforces the required
 * tool. Every call goes through the record/replay cache. Until the private tier is configured
 * (D4-3), payloads the router marks private are served by the cloud tier and the record says so.
 */
export class MetaGateway implements ModelGateway {
  private readonly client: OpenAI;

  constructor(
    private readonly config: ModelConfig,
    private readonly cache: ModelCache,
  ) {
    this.client = metaClient(config);
  }

  async respond(request: ModelRequest): Promise<ModelResponse> {
    const wanted = routeModelCall(request.phiProbe, request.capability, this.config.tierMode);
    const tier = wanted === "private" && this.config.glimmer ? "private" : "cloud";
    const model = request.model ?? this.config.sparkModel;
    const body = {
      model,
      input: toResponsesInput(request.input),
      tools: request.tools,
      tool_choice: "auto" as const,
      parallel_tool_calls: false,
      reasoning: { effort: request.effort },
      max_output_tokens: request.maxOutputTokens,
    };
    const { value, replayed } = await this.cache.call<StoredResponse>(
      "meta",
      model,
      body,
      async () => {
        const r = await this.client.responses.create(
          body as OpenAI.Responses.ResponseCreateParamsNonStreaming,
        );
        return {
          id: r.id,
          output: fromResponsesOutput(r.output),
          ...(r.usage
            ? {
                usage: { input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens },
              }
            : {}),
        };
      },
    );
    return {
      id: value.id,
      output: value.output,
      ...(value.usage ? { usage: value.usage } : {}),
      provider: "meta",
      model,
      tier,
      replayed,
    };
  }
}

export function metaClient(config: ModelConfig): OpenAI {
  // Replay serves recorded outputs only, so it runs without a key; no request is ever sent.
  if (!config.metaApiKey && config.cacheMode !== "replay")
    throw new Error("META_API_KEY is not set");
  return new OpenAI({ baseURL: config.metaBaseUrl, apiKey: config.metaApiKey ?? "replay-only" });
}
