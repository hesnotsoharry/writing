/**
 * Verifies a Lemon Squeezy X-Signature header against the raw request body.
 *
 * Uses Web Crypto (crypto.subtle) — compatible with Cloudflare's edge runtime.
 * The comparison is constant-time to prevent timing-oracle attacks: we XOR
 * every character pair and check that the accumulator is zero, rather than
 * short-circuiting on the first mismatch.
 */
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (signatureHeader === null) return false;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(rawBody),
  );
  const digestHex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare: lengths differ → reject immediately (no oracle leak
  // from length — lengths are equal for any valid LS signature).
  if (digestHex.length !== signatureHeader.length) return false;

  let acc = 0;
  for (let i = 0; i < digestHex.length; i++) {
    acc |= digestHex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return acc === 0;
}
