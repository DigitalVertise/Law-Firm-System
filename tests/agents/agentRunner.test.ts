import { AgentRunner } from "../../src/services/agentRunner";
import { InMemoryAuditPersister, AuditLog } from "../../src/services/auditLog";
import { MockLLMProvider } from "../../src/adapters/llmProvider";
import { ClientServiceAgent } from "../../src/agents/ClientServiceAgent";

test("agent runner enforces capability and audits", async () => {
  const persister = new InMemoryAuditPersister();
  const audit = new AuditLog(persister);
  const runner = new AgentRunner(audit, 5000);
  const llm = new MockLLMProvider();
  const agent = new ClientServiceAgent(llm);

  const ctx = {
    tenantId: "t1",
    userId: "u1",
    inputs: { message: "hello" },
    authorizedCapabilities: ["client_service"],
  };

  const res = await runner.run(agent as any, ctx);
  expect(res.ok).toBe(true);
  // Audit recorded: requested and completed
  expect(persister.events.length).toBeGreaterThanOrEqual(2);
});

test("agent runner blocks missing capability", async () => {
  const persister = new InMemoryAuditPersister();
  const audit = new AuditLog(persister);
  const runner = new AgentRunner(audit, 5000);
  const llm = new MockLLMProvider();
  const agent = new ClientServiceAgent(llm);

  const ctx = {
    tenantId: "t1",
    inputs: { message: "hello" },
    authorizedCapabilities: [], // missing
  };

  const res = await runner.run(agent as any, ctx);
  expect(res.ok).toBe(false);
  expect(res.errors?.[0]).toMatch(/unauthorized/);
});
