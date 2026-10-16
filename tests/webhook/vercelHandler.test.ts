import crypto from "crypto";
import { Readable } from "stream";

const SECRET = "test-secret";

function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

// Minimal VercelRequest/VercelResponse stand-ins: a readable stream with
// method/headers, and a response that captures status + JSON.
function makeReq(body: string, headers: Record<string, string>, method = "POST") {
  const r: any = Readable.from([Buffer.from(body)]);
  r.method = method;
  r.headers = headers;
  return r;
}
function makeRes() {
  const res: any = { statusCode: 0, body: undefined, headers: {} };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  return res;
}

describe("api/ai/whatsapp handler", () => {
  let handler: any;
  beforeAll(async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = SECRET;
    handler = (await import("../../api/ai/whatsapp")).default;
  });

  test("rejects invalid signature with 401", async () => {
    const body = JSON.stringify({ id: "evt-bad", from: "+1", text: "Hi" });
    const res = makeRes();
    await handler(makeReq(body, { "x-whatsapp-signature": "deadbeef" }), res);
    expect(res.statusCode).toBe(401);
  });

  test("valid signature enqueues approval, then dedups", async () => {
    // Whitespace on purpose: proves HMAC is checked against raw bytes.
    const body = '{ "id": "evt-1",  "from": "+15550001111", "text": "Hello" }';
    const headers = { "x-whatsapp-signature": sign(body) };

    const res1 = makeRes();
    await handler(makeReq(body, headers), res1);
    expect(res1.statusCode).toBe(200);
    expect(res1.body.ok).toBe(true);
    expect(res1.body.approvalId).toMatch(/[0-9a-f-]{36}/);

    const res2 = makeRes();
    await handler(makeReq(body, headers), res2);
    expect(res2.statusCode).toBe(200);
    expect(res2.body.duplicate).toBe(true);
  });

  test("rejects payload without id", async () => {
    const body = JSON.stringify({ from: "+1", text: "no id" });
    const res = makeRes();
    await handler(makeReq(body, { "x-whatsapp-signature": sign(body) }), res);
    expect(res.statusCode).toBe(400);
  });

  test("405 on non-POST", async () => {
    const res = makeRes();
    await handler(makeReq("", {}, "GET"), res);
    expect(res.statusCode).toBe(405);
  });
});
