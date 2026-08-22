/**
 * POST /api/ai/trial-session
 *
 * Issues a short-lived HMAC session token for trial AI access. Two modes:
 *
 *   RE-EXCHANGE (body.trialKey is a non-empty string):
 *     Validates the key exists in subscriptions with status='trial', then
 *     issues a fresh token. Does NOT call grant_trial (no new budget spent).
 *
 *   FIRST GRANT (no trialKey in body):
 *     Checks the TRIAL_AI_ENABLED kill-switch, generates a new trial key,
 *     hashes the client IP, calls grant_trial RPC (returns null if the IP
 *     has hit PER_IP_DAILY_GRANT_CAP), then issues a token.
 *
 * Wave 39 Decisions 1-3.
 */
import { buildToken, hashIp } from "../../_lib/ai-token";
import { getCorsHeaders, handleOptions } from "../../_lib/cors";
import { PER_IP_DAILY_GRANT_CAP, TRIAL_ALLOWANCE } from "../../_lib/credits";
import { AiEnv, makeServiceClient } from "../../_lib/supabase";
import { verifyTurnstileToken } from "../../_lib/turnstile";

interface TrialSessionBody {
  trialKey?: unknown;
  turnstileToken?: unknown;
}

interface SubscriptionStatusRow {
  status: string;
}

export const onRequestOptions: PagesFunction<AiEnv> = (context) => {
  return handleOptions(context.request);
};

/**
 * Phase 1 permissive gate for the FIRST GRANT path only (re-exchange never calls this).
 * Returns a Response to short-circuit with, or null to let the grant proceed.
 *   - TURNSTILE_SECRET_KEY unset            → today's behavior, always null.
 *   - token present                         → verify; 403 turnstile_failed on failure.
 *   - token absent, TURNSTILE_ENFORCED=true → 403 update_required (Phase 3).
 *   - token absent, otherwise               → allow through, log telemetry (Phase 1).
 */
async function checkTurnstileFirstGrant(
  env: AiEnv,
  token: string | null,
  ip: string,
  cors: Record<string, string>,
): Promise<Response | null> {
  if (!env.TURNSTILE_SECRET_KEY) return null;

  if (token) {
    const verified = await verifyTurnstileToken(token, env.TURNSTILE_SECRET_KEY, ip || undefined);
    if (verified.success) return null;
    return new Response(JSON.stringify({ error: "turnstile_failed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  if (env.TURNSTILE_ENFORCED === "true") {
    return new Response(
      JSON.stringify({
        error: "update_required",
        message: "Please update WritersNook to activate the free trial.",
      }),
      { status: 403, headers: { "Content-Type": "application/json", ...cors } },
    );
  }

  console.log("trial-session: no turnstile token (permissive)");
  return null;
}

export const onRequestPost: PagesFunction<AiEnv> = async (context) => {
  const cors = getCorsHeaders(context.request);
  const env = context.env;
  const db = makeServiceClient(env);

  const body = (await context.request.json()) as TrialSessionBody;
  const trialKey =
    typeof body.trialKey === "string" && body.trialKey.trim() !== ""
      ? body.trialKey
      : null;
  const turnstileToken =
    typeof body.turnstileToken === "string" && body.turnstileToken.trim() !== ""
      ? body.turnstileToken
      : null;

  if (trialKey !== null) {
    // ── RE-EXCHANGE path ─────────────────────────────────────────────────────
    const { data, error } = await db
      .from("subscriptions")
      .select("status")
      .eq("license_key", trialKey)
      .single();
    if (error || !data) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }
    const row = data as unknown as SubscriptionStatusRow;
    if (row.status !== "trial") {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }
    let token: string;
    let expiresAt: number;
    try {
      ({ token, expiresAt } = await buildToken(trialKey, env.PROXY_SESSION_SECRET));
    } catch {
      return new Response("Internal Server Error", { status: 500, headers: cors });
    }
    return new Response(JSON.stringify({ trialKey, token, expiresAt }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  // ── FIRST GRANT path ───────────────────────────────────────────────────────
  if (env.TRIAL_AI_ENABLED !== "true") {
    return new Response(JSON.stringify({ error: "trial_disabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const ip = context.request.headers.get("CF-Connecting-IP") ?? "";
  const turnstileResponse = await checkTurnstileFirstGrant(env, turnstileToken, ip, cors);
  if (turnstileResponse) return turnstileResponse;

  const newKey = "trial_" + crypto.randomUUID();
  const ipHashSecret = env.IP_HASH_SECRET;
  if (!ipHashSecret) {
    // Fail closed on the privacy guarantee: without the salt, hashIp would run HMAC
    // with an empty key, producing a precomputable (reversible) IP hash — silently
    // breaking the "raw IP is never stored" property. Refuse rather than degrade
    // (mirrors buildToken's required-secret posture). Set IP_HASH_SECRET to enable grants.
    return new Response("Internal Server Error", { status: 500, headers: cors });
  }
  const ipHash = await hashIp(ip, ipHashSecret);

  const { data: grantData } = await db.rpc("grant_trial", {
    p_license_key: newKey,
    p_ip_hash: ipHash,
    p_allowance: TRIAL_ALLOWANCE,
    p_ip_cap: PER_IP_DAILY_GRANT_CAP,
  });

  if (!grantData) {
    return new Response(JSON.stringify({ error: "trial_ip_capped" }), {
      status: 429,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  let token: string;
  let expiresAt: number;
  try {
    ({ token, expiresAt } = await buildToken(newKey, env.PROXY_SESSION_SECRET));
  } catch {
    return new Response("Internal Server Error", { status: 500, headers: cors });
  }

  return new Response(
    JSON.stringify({ trialKey: newKey, token, expiresAt, allowance: TRIAL_ALLOWANCE }),
    { status: 200, headers: { "Content-Type": "application/json", ...cors } },
  );
};
