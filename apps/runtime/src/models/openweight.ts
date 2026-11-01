import OpenAI from "openai";
import type { ModelCache } from "./cache";
import type {
  ModelGateway,
  ModelInputItem,
  ModelOutputItem,
  ModelRequest,
  ModelResponse,
} from "./types";

export interface OpenWeightConfig {
  provider: "baseten";
  baseURL: string;
  apiKey?: string;
  model: string;
}

interface StoredResponse {
  id: string;
  output: ModelOutputItem[];
  usage?: ModelResponse["usage"];
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/** Our provider-agnostic items → chat messages; consecutive tool calls share one turn. */
function toMessages(items: ModelInputItem[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const item of items) {
    if ("role" in item) {
      const text =
        typeof item.content === "string"
          ? item.content
          : item.content.map((p) => (p.type === "input_text" ? p.text : "")).join("\n");
      out.push({ role: item.role, content: text } as ChatMessage);
    } else if (item.type === "function_call") {
      const call = {
        id: item.call_id,
        type: "function" as const,
        function: { name: item.name, arguments: item.arguments },
      };
      const last = out.at(-1);
      if (last?.role === "assistant" && "tool_calls" in last && last.tool_calls) {
        last.tool_calls.push(call);
      } else {
        out.push({ role: "assistant", content: null, tool_calls: [call] });
      }
    } else {
      out.push({ role: "tool", tool_call_id: item.call_id, content: item.output });
    }
  }
  return out;
}

/**
 * The open-weight tier (spec 8.1, D4-4): Muse Spark Open through an OpenAI-compatible chat
 * completions endpoint (Baseten). The provider does not enforce JSON schemas, so the runner's
 * validation is what makes the required tool safe. Every call goes through the cache.
 */
export class OpenWeightGateway implements ModelGateway {
  private readonly client: OpenAI;

  constructor(
    private readonly config: OpenWeightConfig,
    private readonly cache: ModelCache,
  ) {
    // Replay serves recorded outputs only; no request is sent without a key.
    this.client = new OpenAI({ baseURL: config.baseURL, apiKey: config.apiKey ?? "replay-only" });
  }

  async respond(request: ModelRequest): Promise<ModelResponse> {
    const body = {
      model: this.config.model,
      messages: toMessages(request.input),
      tools: request.tools.map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: "auto" as const,
      // Reasoning is always on for Spark Open; effort maps to its reasoning_effort.
      reasoning_effort: request.effort === "minimal" ? "low" : request.effort,
      max_tokens: request.maxOutputTokens,
    };
    const { value, replayed } = await this.cache.call<StoredResponse>(
      this.config.provider,
      this.config.model,
      body,
      async () => {
        const r = await this.client.chat.completions.create(
          body as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        );
        const message = r.choices[0]?.message;
        const output: ModelOutputItem[] = [
          ...(message?.content ? [{ type: "message" as const, text: message.content }] : []),
          ...(message?.tool_calls ?? []).flatMap((c) =>
            c.type === "function"
              ? [
                  {
                    type: "function_call" as const,
                    call_id: c.id,
                    name: c.function.name,
                    arguments: c.function.arguments,
                  },
                ]
              : [],
          ),
        ];
        return {
          id: r.id,
          output,
          ...(r.usage
            ? {
                usage: {
                  input_tokens: r.usage.prompt_tokens,
                  output_tokens: r.usage.completion_tokens,
                },
              }
            : {}),
        };
      },
    );
    return {
      id: value.id,
      output: value.output,
      ...(value.usage ? { usage: value.usage } : {}),
      provider: this.config.provider,
      model: this.config.model,
      tier: "cloud",
      replayed,
    };
  }
}

/** Sends ops proposals to the open-weight brain when OPS_BRAIN=open; everything else to Meta. */
export class BrainRouter implements ModelGateway {
  constructor(
    private readonly meta: ModelGateway,
    private readonly open: ModelGateway | undefined,
    private readonly brain: () => "cloud" | "open",
  ) {}

  respond(request: ModelRequest): Promise<ModelResponse> {
    const open = this.brain() === "open" && request.capability === "ops_action.propose";
    return (open && this.open ? this.open : this.meta).respond(request);
  }
}
