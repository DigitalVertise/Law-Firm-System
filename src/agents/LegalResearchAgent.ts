import { Agent, AgentContext, AgentResult, AgentCapability } from "./AgentInterface";
import { LLMProvider } from "../adapters/llmProvider";

export class LegalResearchAgent implements Agent {
  id = "legal-research";
  name = "Legal Research Agent";
  capabilities = [AgentCapability.LEGAL_RESEARCH];

  constructor(private llm: LLMProvider) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const q = String(ctx.inputs?.query || "").trim();
    if (!q) return { ok: false, errors: ["missing query"] };
    const prompt = `[RESEARCH] Tenant:${ctx.tenantId} Matter:${ctx.matterId}\nQuestion: ${q}\nInstructions: identify sources and short summary.`;
    try {
      const resp = await this.llm.call({ prompt, maxTokens: 800 }, 25_000);
      // Basic structured parse - in real impl, use a schema/JSON output or function-call style
      return {
        ok: true,
        data: {
          summary: resp.text,
          sources: resp.raw?.sources || [],
        },
        metadata: { provider: this.llm.name },
      };
    } catch (err: any) {
      return { ok: false, errors: [err?.message || "llm error"] };
    }
  }
}
