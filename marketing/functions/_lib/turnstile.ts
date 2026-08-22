/**
 * Cloudflare Turnstile server-side verification helper.
 *
 * Phase 1 (permissive rollout): callers decide whether a missing/invalid token
 * blocks the request — this helper only wraps the `siteverify` HTTP contract.
 * See research/turnstile-trial-session-scout.md for the rollout plan.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
}

interface SiteverifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

/**
 * Verifies a Turnstile response token against Cloudflare's siteverify endpoint.
 * @param token - the `cf-turnstile-response` token produced by the client widget.
 * @param secret - the Turnstile secret key (server-side only, never shipped to clients).
 * @param ip - optional client IP (CF-Connecting-IP) to include as `remoteip`.
 */
export async function verifyTurnstileToken(
  token: string,
  secret: string,
  ip?: string,
): Promise<TurnstileVerifyResult> {
  const params = new URLSearchParams();
  params.set("secret", secret);
  params.set("response", token);
  if (ip) params.set("remoteip", ip);

  const res = await fetch(SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await res.json()) as SiteverifyResponse;
  return { success: data.success === true, errorCodes: data["error-codes"] };
}
