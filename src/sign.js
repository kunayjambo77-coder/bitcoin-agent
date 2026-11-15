import crypto from "node:crypto";

// HMAC-SHA256 helpers for Agent Games message signing.
// - Every agent RESPONSE is signed: header `x-agent-games-signature` = HMAC(secret, rawResponseBody).
// - Incoming platform tasks are also signed the same way over their raw body; verify before parsing.

export function hmacHex(secret, rawBody) {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function signResponse(secret, rawBody) {
  return hmacHex(secret, rawBody);
}

export function verifyIncoming(secret, rawBody, signature) {
  if (!secret || !signature) return false;
  const expected = hmacHex(secret, rawBody);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
