import { Agent, AgentContext, AgentResult } from "../agents/AgentInterface";
import { AuditLog } from "./auditLog";

export class AgentRunner {
  constructor(private auditLog: AuditLog, private defaultTimeout = 30_000) {}

  // Run an agent with timeout, capability checks, auditing and safe error handling.
  async run(agent: Agent, ctx: AgentContext, opts?: { timeoutMs?: number }): Promise<AgentResult> {
    const timeoutMs = opts?.timeoutMs ?? this.defaultTimeout;
    const start = Date.now();
    // Capability guard
    const allowed = ctx.authorizedCapabilities || [];
    const requiredCaps = agent.capabilities.map((c) => c.toString());
    const ok = requiredCaps.every((rc) => allowed.includes(rc));
    const auditBase = {
      tenantId: ctx.tenantId,
      matterId: ctx.matterId,
      userId: ctx.userId,
      actor: agent.name,
      action: "agent_run",
    };
    if (!ok) {
      const res: AgentResult = { ok: false, errors: ["unauthorized: missing capability"] };
      await this.auditLog.record({
        ...auditBase,
        status: "failed",
        timestamp: new Date().toISOString(),
        payload: { reason: "missing capability", required: requiredCaps, provided: allowed },
      });
      return res;
    }

    await this.auditLog.record({
      ...auditBase,
      status: "requested",
      timestamp: new Date().toISOString(),
      payload: { requestId: ctx.requestId },
    });

    // Run with timeout
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const p = agent.run(ctx, { timeoutMs });
      const res = await Promise.race([
        p,
        new Promise<AgentResult>((_, reject) => {
          timer = setTimeout(() => reject(new Error("agent timeout")), timeoutMs);
        }),
      ]).finally(() => clearTimeout(timer));
      await this.auditLog.record({
        ...auditBase,
        status: res.ok ? "completed" : "failed",
        timestamp: new Date().toISOString(),
        payload: { durationMs: Date.now() - start, resultOk: res.ok },
      });
      return res;
    } catch (err: any) {
      await this.auditLog.record({
        ...auditBase,
        status: "failed",
        timestamp: new Date().toISOString(),
        payload: { error: err?.message || String(err) },
      });
      return { ok: false, errors: [err?.message || "unknown error"] };
    }
  }
}
