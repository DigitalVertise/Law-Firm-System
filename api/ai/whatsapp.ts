// api/ai/whatsapp.ts
// Vercel Serverless wrapper for the AI workforce WhatsApp webhook.
// Uses in-repo modules (validator, normalizer, agents, stores).
//
// PREVIEW ONLY: InMemoryStore + MockLLMProvider. State is per function instance
// and is lost on cold start, so dedup/approvals are not durable here.
// Production adapters (Redis/Supabase store, real LLM provider, DB audit
// persister) are required before staging/production.
//
// DO NOT commit secrets. Set WHATSAPP_WEBHOOK_SECRET etc. as Vercel env vars.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "crypto";
import { validateHmacSignature } from "../../src/integrations/whatsapp/signatureValidator";
import { normalizeWhatsAppPayload } from "../../src/integrations/whatsapp/normalizer";
import { InMemoryStore } from "../../src/store/durableStore";
import { ApprovalQueue, ApprovalRequest } from "../../src/services/approvalQueue";
import { InMemoryAuditPersister, AuditLog } from "../../src/services/auditLog";
import { MockLLMProvider } from "../../src/adapters/llmProvider";
import { ClientServiceAgent } from "../../src/agents/ClientServiceAgent";
import { AgentRunner } from "../../src/services/agentRunner";

// Module scope: reused across warm invocations of the same instance.
const store = new InMemoryStore();
const auditLog = new AuditLog(new InMemoryAuditPersister());
const approvalQueue = new ApprovalQueue(store);
const llm = new MockLLMProvider();
const clientAgent = new ClientServiceAgent(llm);
const runner = new AgentRunner(auditLog);

/**
 * Read the exact request bytes. HMAC must be computed over the raw body;
 * re-serializing a parsed object (JSON.stringify(req.body)) changes
 * whitespace/key order and breaks provider signatures.
 */
async function readRawBody(req: VercelRequest): Promise<string> {
  // 1) Read the stream first, before touching req.body (accessing it can
  //    trigger Vercel's lazy JSON parser).
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of req as any) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
  } catch {
    // stream unavailable — fall through
  }
  if (chunks.length) return Buffer.concat(chunks).toString("utf8");

  // 2) Stream already consumed by a helper: use whatever body is present.
  const b: any = (req as any).body;
  if (typeof b === "string") return b;
  if (Buffer.isBuffer(b)) return b.toString("utf8");
  // 3) Last resort: best-effort re-serialization (may not match provider bytes).
  return b ? JSON.stringify(b) : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, reason: "method not allowed" });
    return;
  }

  try {
    const raw = await readRawBody(req);
    const sigHeader =
      (req.headers["x-whatsapp-signature"] as string) ||
      (req.headers["x-hub-signature-256"] as string) ||
      (req.headers["x-hub-signature"] as string) ||
      "";
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET || "";

    if (!validateHmacSignature(secret, raw, sigHeader)) {
      await auditLog.record({
        tenantId: "unknown",
        actor: "webhook",
        action: "signature_validation",
        status: "failed",
        timestamp: new Date().toISOString(),
        payload: { reason: secret ? "invalid signature" : "secret not configured" },
      });
      res.status(401).json({ ok: false, reason: "invalid signature" });
      return;
    }

    let body: any;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      res.status(400).json({ ok: false, reason: "invalid json" });
      return;
    }

    const envelope = normalizeWhatsAppPayload(body);
    if (!envelope || !envelope.id) {
      res.status(400).json({ ok: false, reason: "invalid payload" });
      return;
    }

    // Duplicate event protection (TTL 5 minutes)
    const dupKey = `whatsapp:event:${envelope.id}`;
    if (await store.get(dupKey)) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    await store.set(dupKey, "1", 60 * 5);

    const ctx = {
      tenantId: envelope.tenantId || "unknown",
      matterId: envelope.matterId,
      userId: envelope.from,
      requestId: envelope.id,
      inputs: { message: envelope.text },
      authorizedCapabilities: ["client_service"],
    };

    const agentRes = await runner.run(clientAgent, ctx);

    // Any outbound reply or escalation requires human approval.
    const needsApproval = agentRes.ok && (agentRes.data?.escalate || agentRes.data?.suggestedReply);
    if (needsApproval) {
      const approvalId = randomUUID();
      const approvalReq: ApprovalRequest = {
        id: approvalId,
        tenantId: ctx.tenantId,
        matterId: ctx.matterId,
        actor: clientAgent.name,
        action: "send_message_or_escalate",
        payload: {
          originalEvent: envelope,
          classification: agentRes.data?.classification,
          suggestedReply: agentRes.data?.suggestedReply,
        },
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      await approvalQueue.enqueue(approvalReq);
      await auditLog.record({
        tenantId: ctx.tenantId,
        actor: clientAgent.name,
        action: "approval_requested",
        status: "requested",
        timestamp: new Date().toISOString(),
        payload: { approvalId, requestId: ctx.requestId },
      });
      res.status(200).json({ ok: true, approvalId });
      return;
    }

    await auditLog.record({
      tenantId: ctx.tenantId,
      actor: clientAgent.name,
      action: "classified",
      status: agentRes.ok ? "completed" : "failed",
      timestamp: new Date().toISOString(),
      payload: { classification: agentRes.data?.classification, errors: agentRes.errors },
    });
    res.status(200).json({ ok: agentRes.ok, classified: agentRes.data?.classification });
  } catch (err: any) {
    // Don't leak internals to the caller.
    console.error("whatsapp webhook error", err?.message || err);
    res.status(500).json({ ok: false, error: "internal error" });
  }
}
