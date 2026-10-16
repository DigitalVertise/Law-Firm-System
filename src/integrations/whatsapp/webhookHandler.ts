import express from "express";
import bodyParser from "body-parser";
import { validateHmacSignature } from "./signatureValidator";
import { normalizeWhatsAppPayload } from "./normalizer";

export { normalizeWhatsAppPayload };
import { DurableStore, InMemoryStore } from "../../store/durableStore";
import { ApprovalQueue } from "../../services/approvalQueue";
import { InMemoryAuditPersister, AuditLog } from "../../services/auditLog";
import { MockLLMProvider } from "../../adapters/llmProvider";
import { ClientServiceAgent } from "../../agents/ClientServiceAgent";
import { AgentRunner } from "../../services/agentRunner";
import { v4 as uuidv4 } from "uuid";

/**
 * Minimal express handler to receive WhatsApp-like webhooks.
 * - Validates signature
 * - Normalizes event
 * - Duplicate protection
 * - Routes to ClientServiceAgent and enqueues approval if needed
 *
 * Note: adapt to repo's server style (serverless handler, etc.) when integrating.
 */

export function createWhatsAppRouter(options?: { secret?: string; store?: DurableStore; audit?: AuditLog }) {
  const router = express.Router();
  const secret = options?.secret || process.env.WHATSAPP_WEBHOOK_SECRET || "";
  const store = options?.store || new InMemoryStore();
  const auditLog = options?.audit || new AuditLog(new InMemoryAuditPersister());
  const approvalQueue = new ApprovalQueue(store);
  const llm = new MockLLMProvider();
  const clientAgent = new ClientServiceAgent(llm);
  const runner = new AgentRunner(auditLog);

  router.use(bodyParser.json({ verify: (req: any, res, buf) => { (req as any).rawBody = buf.toString(); } }));

  router.post("/webhook", async (req, res) => {
    try {
      const raw = (req as any).rawBody || JSON.stringify(req.body);
      const sigHeader = req.header("x-whatsapp-signature") || req.header("x-hub-signature") || "";
      if (!validateHmacSignature(secret, raw, sigHeader)) {
        await auditLog.record({
          tenantId: "unknown",
          actor: "webhook",
          action: "signature_validation",
          status: "failed",
          timestamp: new Date().toISOString(),
          payload: { reason: "invalid signature", headers: Object.fromEntries(Object.entries(req.headers).slice(0,5)) },
        });
        return res.status(401).json({ ok: false, reason: "invalid signature" });
      }

      // Normalize incoming event into standard envelope
      const envelope = normalizeWhatsAppPayload(req.body);
      if (!envelope || !envelope.id) return res.status(400).json({ ok: false, reason: "invalid payload" });

      // Duplicate event protection (ttl 5 minutes)
      const dupKey = `whatsapp:event:${envelope.id}`;
      const seen = await store.get(dupKey);
      if (seen) {
        return res.status(200).json({ ok: true, duplicate: true });
      }
      await store.set(dupKey, "1", 60 * 5);

      // Route to client service agent for classification
      const ctx = {
        tenantId: envelope.tenantId || "unknown",
        matterId: envelope.matterId,
        userId: envelope.from,
        requestId: envelope.id,
        inputs: { message: envelope.text },
        authorizedCapabilities: [ "client_service" ],
      };

      const agentRes = await runner.run(clientAgent as any, ctx);

      // If agent suggests escalate or outbound response, create approval request
      const needsApproval = agentRes.ok && (agentRes.data?.escalate || agentRes.data?.suggestedReply);
      if (needsApproval) {
        const approvalId = uuidv4();
        const approvalReq = {
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
        return res.status(200).json({ ok: true, approvalId });
      }

      await auditLog.record({
        tenantId: ctx.tenantId,
        actor: clientAgent.name,
        action: "classified",
        status: "completed",
        timestamp: new Date().toISOString(),
        payload: { classification: agentRes.data?.classification },
      });

      return res.status(200).json({ ok: true, classified: agentRes.data?.classification });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || "internal error" });
    }
  });

  return router;
}
