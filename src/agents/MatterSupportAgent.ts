import { Agent, AgentContext, AgentResult, AgentCapability } from "./AgentInterface";
import { LLMProvider } from "../adapters/llmProvider";

export class MatterSupportAgent implements Agent {
  id = "matter-support";
  name = "Matter Support Agent";
  capabilities = [AgentCapability.MATTER_SUMMARY];

  constructor(private llm: LLMProvider) {}

  async run(ctx: AgentContext): Promise<AgentResult> {
    const matterData = ctx.inputs?.matterData;
    if (!matterData) return { ok: false, errors: ["missing matterData"] };
    const prompt = `Summarize matter for user. Matter:${JSON.stringify(
      matterData
    )}\nIdentify deadlines, next tasks, and flags.`;
    try {
      const resp = await this.llm.call({ prompt, maxTokens: 600 }, 20_000);
      return {
        ok: true,
        data: { summary: resp.text },
        metadata: { provider: this.llm.name },
      };
    } catch (err: any) {
      return { ok: false, errors: [err?.message || "llm error"] };
    }
  }
}
