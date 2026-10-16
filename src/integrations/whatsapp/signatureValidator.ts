import crypto from "crypto";

/**
 * Validate a webhook signature using HMAC-SHA256.
 * This is a conservative generic validator — adapt to your provider's spec (Twilio, Meta, etc.).
 *
 * Env var: WHATSAPP_WEBHOOK_SECRET
 */

export function validateHmacSignature(secret: string, payload: string, headerSig: string): boolean {
  if (!secret || !headerSig) return false;
  const h = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  // headerSig may include prefix like "sha256=..."
  const cleaned = headerSig.includes("=") ? headerSig.split("=").pop() || headerSig : headerSig;
  // Use timing-safe compare
  try {
    return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(cleaned));
  } catch (e) {
    return false;
  }
}
