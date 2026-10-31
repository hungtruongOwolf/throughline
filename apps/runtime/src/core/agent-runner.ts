import { randomUUID } from "node:crypto";
import type { ModelCallRecord } from "@throughline/shared";
import type { ModelGateway, ModelInputItem, ModelResponse } from "../models/types";
import type { Agent, HandlerContext, HandlerResult, ModelAgent } from "./agent";

export class RequiredToolError extends Error {
  constructor(
    readonly agent: string,
    readonly problem: "missing" | "duplicated",
  ) {
    super(`${agent}: required tool ${problem}`);
  }
}

export interface RunOutcome {
  result: HandlerResult;
  usedFallback: boolean;
}

/**
 * Executes an agent (spec 4.3 step 6). Deterministic agents run directly. Model agents run a
 * tool loop; the required tool must be called exactly once with arguments that pass its zod
 * schema. Failure → one retry with the error in context → deterministic fallback.
 */
export class AgentRunner {
  constructor(
    private readonly gateway: ModelGateway,
    private readonly record: (r: ModelCallRecord) => void,
  ) {}

  async run(agent: Agent, ctx: HandlerContext): Promise<RunOutcome> {
    if (agent.kind === "deterministic") {
      return { result: await agent.handle(ctx), usedFallback: false };
    }
    const modelAgent = agent as unknown as ModelAgent<unknown>;
    let errorNote: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const args = await this.loop(modelAgent, ctx, errorNote);
        return { result: await modelAgent.model.apply(args, ctx), usedFallback: false };
      } catch (e) {
        errorNote = e instanceof Error ? e.message : String(e);
      }
    }
    this.record({
      ...this.baseRecord(modelAgent, ctx),
      provider: "meta",
      model: "fallback",
      tier: "none",
      tools_invoked: [],
      latency_ms: 0,
      success: false,
      used_fallback: true,
      replayed: false,
    });
    return { result: await modelAgent.fallback(ctx), usedFallback: true };
  }

  private baseRecord(agent: ModelAgent<unknown>, ctx: HandlerContext) {
    return {
      id: randomUUID(),
      at: ctx.now,
      capability: ctx.capability,
      required_tool: agent.model.requiredTool,
      ...(ctx.journey ? { journey_id: ctx.journey.id } : {}),
    };
  }

  private async loop(agent: ModelAgent<unknown>, ctx: HandlerContext, errorNote?: string) {
    const spec = agent.model;
    const userText = errorNote
      ? `${spec.input(ctx)}\n\nYour previous attempt failed: ${errorNote}. Call ${spec.requiredTool} exactly once with valid arguments.`
      : spec.input(ctx);
    const history: ModelInputItem[] = [
      { role: "system", content: spec.system },
      { role: "user", content: userText },
    ];
    let required: { args: unknown } | undefined;

    for (let step = 0; step < spec.maxSteps && !required; step++) {
      const started = performance.now();
      let response: ModelResponse;
      try {
        response = await this.gatewayCall(agent, ctx, history);
      } catch (e) {
        this.record({
          ...this.baseRecord(agent, ctx),
          provider: "meta",
          model: "unknown",
          tier: "cloud",
          tools_invoked: [],
          latency_ms: performance.now() - started,
          success: false,
          used_fallback: false,
          replayed: false,
        });
        throw e;
      }
      const calls = response.output.filter((o) => o.type === "function_call");
      let valid: boolean | undefined;
      let requiredCount = 0;
      for (const call of calls) {
        history.push(call);
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(call.arguments);
        } catch {
          history.push(output(call.call_id, { error: "arguments are not valid JSON" }));
          continue;
        }
        if (call.name === spec.requiredTool) {
          requiredCount++;
          const parsed = spec.requiredSchema.safeParse(parsedJson);
          valid = parsed.success;
          if (!parsed.success) {
            history.push(output(call.call_id, { error: parsed.error.issues }));
            continue;
          }
          required = { args: parsed.data };
          history.push(output(call.call_id, { ok: true }));
          continue;
        }
        const schema = spec.readSchemas[call.name];
        const tool = spec.readTools[call.name];
        if (!schema || !tool) {
          history.push(output(call.call_id, { error: `unknown tool ${call.name}` }));
          continue;
        }
        const parsed = schema.safeParse(parsedJson);
        history.push(
          output(
            call.call_id,
            parsed.success ? await tool(parsed.data, ctx) : { error: parsed.error.issues },
          ),
        );
      }
      this.record({
        ...this.baseRecord(agent, ctx),
        provider: response.provider,
        model: response.model,
        tier: response.tier,
        tools_invoked: calls.map((c) => c.name),
        ...(valid === undefined ? {} : { required_tool_valid: valid }),
        latency_ms: performance.now() - started,
        ...(response.usage?.input_tokens === undefined
          ? {}
          : { tokens_in: response.usage.input_tokens }),
        ...(response.usage?.output_tokens === undefined
          ? {}
          : { tokens_out: response.usage.output_tokens }),
        success: true,
        used_fallback: false,
        replayed: response.replayed,
      });
      if (requiredCount > 1) throw new RequiredToolError(agent.name, "duplicated");
      if (calls.length === 0) break;
    }
    if (!required) throw new RequiredToolError(agent.name, "missing");
    return required.args;
  }

  private gatewayCall(agent: ModelAgent<unknown>, ctx: HandlerContext, history: ModelInputItem[]) {
    const spec = agent.model;
    return this.gateway.respond({
      capability: ctx.capability,
      input: [...history],
      tools: spec.tools,
      effort: spec.effort,
      maxOutputTokens: spec.maxOutputTokens,
      phiProbe: spec.input(ctx),
    });
  }
}

function output(callId: string, value: unknown): ModelInputItem {
  return { type: "function_call_output", call_id: callId, output: JSON.stringify(value) };
}
