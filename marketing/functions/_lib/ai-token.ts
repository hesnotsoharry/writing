/**
 * HMAC-SHA256 session token helpers for the AI proxy (Decision 2).
 *
 * Token format: base64url(JSON.stringify({licenseKey, expiresAt})).hexHmac
 * - Payload is base64url-encoded JSON with licenseKey + expiresAt (Unix ms).
 * - Signature is HMAC-SHA256(payload, PROXY_SESSION_SECRET) as a hex string.
 * - Verification is constant-time to prevent timing-oracle attacks.
 * - Uses Web Crypto (crypto.subtle) — compatible with Cloudflare's edge runtime.
 */

// Token TTL: 4 hours (Decision 2)
export const SESSION_TTL_MS = 4 * 60 * 60 * 1000;

/**
 * Credit unit value in USD. 1 credit unit = $0.00001.
 * Canonical definition lives in migration 0002_ai_subscriptions.sql.
 * Mirrored here (server) and in src/features/ai/ai.client.ts (client display).
 */
export const CREDIT_UNIT_USD = 0.00001;

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(b64url: string): string {
  return atob(b64url.replace(/-/g, "+").replace(/_/g, "/"));
}

async function hmacHex(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let acc = 0;
  for (let i = 0; i < a.length; i++) acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return acc === 0;
}

/**
 * Build a signed session token for a license key.
 * @param now - Override for the current timestamp (useful in tests).
 */
export async function buildToken(
  licenseKey: string,
  secret: string,
  now = Date.now(),
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = toBase64Url(JSON.stringify({ licenseKey, expiresAt }));
  const sig = await hmacHex(payload, secret);
  return { token: `${payload}.${sig}`, expiresAt };
}

/**
 * Verify a session token. Returns the licenseKey on success, null on failure
 * (invalid format, bad signature, or expired).
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<string | null> {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacHex(payload, secret);
  if (!constantTimeEqual(expected, sig)) return null;
  try {
    const decoded = fromBase64Url(payload);
    const { licenseKey, expiresAt } = JSON.parse(decoded) as {
      licenseKey: string;
      expiresAt: number;
    };
    if (Date.now() > expiresAt) return null;
    return licenseKey;
  } catch {
    return null;
  }
}
