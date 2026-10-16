// Framework-free WhatsApp payload normalizer.
// Kept separate from webhookHandler.ts so serverless functions can use it
// without pulling in express/body-parser.

export type WhatsAppEnvelope = {
  id: string;
  from?: string;
  text: string;
  tenantId?: string;
  matterId?: string;
  raw: any;
};

export function normalizeWhatsAppPayload(body: any): WhatsAppEnvelope | null {
  // Minimal normalizer — adapt to your provider payload schema
  if (!body || typeof body !== "object") return null;
  // Expecting fields: id, from, text, tenantId, matterId (optional)
  const id = body?.id || body?.entry?.[0]?.id || body?.message?.id;
  const from = body?.from || body?.sender || body?.message?.from;
  const text = body?.text || body?.message?.text?.body || JSON.stringify(body);
  const tenantId = body?.tenantId || undefined;
  const matterId = body?.matterId || undefined;
  return { id, from, text, tenantId, matterId, raw: body };
}
