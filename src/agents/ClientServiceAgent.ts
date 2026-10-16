import { Agent, AgentContext, AgentResult, AgentCapability } from "./AgentInterface";
import { LLMProvider } from "../adapters/llmProvider";

export class ClientServiceAgent implements Agent {
  id = "client-service";
  name = "Client Service Agent";
  capabilities = [AgentCapability.CLIENT_SERVICE];

  constructor(private llm: LLMProvider) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const message = ctx.inputs?.message;
    if (!message) return { ok: false, errors: ["missing message"] };
    const prompt = `Classify and draft a short response and determine escalation. Message: ${message}`;
    try {
      const resp = await this.llm.call({ prompt, maxTokens: 400 }, 10_000);
      // Expected structured result in real implementation
      return {
        ok: true,
        data: {
          classification: resp.raw?.classification || "general",
          suggestedReply: resp.text,
          escalate: resp.raw?.escalate || false,
        },
        metadata: { provider: this.llm.name },
      };
    } catch (err: any) {
      return { ok: false, errors: [err?.message || "llm error"] };
    }
  }
}
