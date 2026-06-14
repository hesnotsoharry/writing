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

interface TrialSessionBody {
  trialKey?: unknown;
}

interface SubscriptionStatusRow {
  status: string;
}

export const onRequestOptions: PagesFunction<AiEnv> = (context) => {
  return handleOptions(context.request);
};

export const onRequestPost: PagesFunction<AiEnv> = async (context) => {
  const cors = getCorsHeaders(context.request);
  const env = context.env;
  const db = makeServiceClient(env);

  const body = (await context.request.json()) as TrialSessionBody;
  const trialKey =
    typeof body.trialKey === "string" && body.trialKey.trim() !== ""
      ? body.trialKey
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

  const newKey = "trial_" + crypto.randomUUID();
  const ip = context.request.headers.get("CF-Connecting-IP") ?? "";
  const ipHash = await hashIp(ip, env.IP_HASH_SECRET ?? "");

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
