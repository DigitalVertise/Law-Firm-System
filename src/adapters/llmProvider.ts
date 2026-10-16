// Adapter interface for an LLM provider. Do not hardcode provider creds here.
// Provide a real implementation in integrations/ or use the MockLLMProvider for tests.

export type LLMRequest = {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
};

export type LLMResponse = {
  text: string;
  tokens?: number;
  raw?: any;
};

export interface LLMProvider {
  name: string;
  call(request: LLMRequest, timeoutMs?: number): Promise<LLMResponse>;
}

// Mock provider for tests and local runs.
export class MockLLMProvider implements LLMProvider {
  name = "MockLLM";
  async call(request: LLMRequest): Promise<LLMResponse> {
    // Simple deterministic mock driven by prompt markers
    const text =
      request.prompt.includes("[RESEARCH]")
        ? "Mock research findings: [source: example.com]. Summary: Example."
        : request.prompt.includes("[DRAFT]")
        ? "Mock draft document: This is a draft. NOT legal advice."
        : "Mock response.";
    return { text, tokens: 10, raw: { mocked: true } };
  }
}
