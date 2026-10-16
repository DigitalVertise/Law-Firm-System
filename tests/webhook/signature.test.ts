import { validateHmacSignature } from "../../src/integrations/whatsapp/signatureValidator";
import crypto from "crypto";

test("validates hmac signature", () => {
  const secret = "s3cr3t";
  const payload = '{"x":"y"}';
  const h = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  expect(validateHmacSignature(secret, payload, h)).toBe(true);
  expect(validateHmacSignature(secret, payload, "bad")).toBe(false);
});
