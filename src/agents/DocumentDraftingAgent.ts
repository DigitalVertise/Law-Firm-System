import { Agent, AgentContext, AgentResult, AgentCapability } from "./AgentInterface";
import { LLMProvider } from "../adapters/llmProvider";

export class DocumentDraftingAgent implements Agent {
  id = "document-drafting";
  name = "Document Drafting Agent";
  capabilities = [AgentCapability.DOCUMENT_DRAFT];

  constructor(private llm: LLMProvider) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const template = ctx.inputs?.template || "generic";
    const matter = ctx.inputs?.matterData || {};
    // Always produce a draft and indicate NOT legal advice
    const prompt = `[DRAFT] Tenant:${ctx.tenantId} Matter:${ctx.matterId}\nTemplate:${template}\nMatter:${JSON.stringify(
      matter
    )}\nProduce a clear draft and prepend a notice: THIS IS A DRAFT AND NOT LEGAL ADVICE.`;
    try {
      const resp = await this.llm.call({ prompt, maxTokens: 1200 }, 30_000);
      return {
        ok: true,
        data: {
          draft: resp.text,
          advisory: "THIS IS A DRAFT AND NOT LEGAL ADVICE",
        },
        metadata: { provider: this.llm.name },
      };
    } catch (err: any) {
      return { ok: false, errors: [err?.message || "llm error"] };
    }
  }
}
