/**
 * GET /api/ai/balance
 *
 * Authenticated (Bearer session token) balance endpoint.
 * Returns the caller's current credit balance, monthly allowance, reset date,
 * and subscription status. The client uses this to render the billing meter
 * and guardrail states (Phase G — Wave 35).
 *
 * Response shape (200):
 *   { creditsBalance: number, monthlyAllowance: number, resetAt: string, status: 'active'|'expired' }
 *
 * 401: missing/invalid/expired Bearer token.
 * CORS: GET, OPTIONS — same origin allowlist as /api/ai/chat.
 */
import { verifyToken } from "../../_lib/ai-token";
import { getCorsHeaders } from "../../_lib/cors";
import { MONTHLY_ALLOWANCE } from "../../_lib/credits";
import { AiEnv, makeServiceClient } from "../../_lib/supabase";

interface SubscriptionRow {
  status: string;
  credits_balance: number;
  credits_monthly: number;
  reset_at: string | null;
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export const onRequestOptions: PagesFunction<AiEnv> = (context) => {
  const origin = context.request.headers.get("Origin");
  const cors = getCorsHeaders(context.request);
  const hasCors = Boolean(origin && cors["Access-Control-Allow-Origin"]);
  return new Response(null, {
    status: 204,
    headers: hasCors
      ? { ...cors, "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "86400" }
      : {},
  });
};

export const onRequestGet: PagesFunction<AiEnv> = async (context) => {
  const cors = getCorsHeaders(context.request);

  const rawToken = extractBearer(context.request);
  if (!rawToken) return new Response("Unauthorized", { status: 401, headers: cors });

  let licenseKey: string | null;
  try {
    licenseKey = await verifyToken(rawToken, context.env.PROXY_SESSION_SECRET);
  } catch {
    return new Response("Internal Server Error", { status: 500, headers: cors });
  }
  if (!licenseKey) return new Response("Unauthorized", { status: 401, headers: cors });

  const db = makeServiceClient(context.env);
  const { data, error } = await db
    .from("subscriptions")
    .select("status, credits_balance, credits_monthly, reset_at")
    .eq("license_key", licenseKey)
    .single();
  // Real transport error (any error except PGRST116 "no rows") → 500.
  // PGRST116 = no subscription row — treat as "not subscribed" → 401.
  const errCode = (error as { code?: string } | null)?.code;
  if (error && errCode !== "PGRST116") return new Response("Internal Server Error", { status: 500, headers: cors });
  if (!data) return new Response("Unauthorized", { status: 401, headers: cors });
  const sub = data as unknown as SubscriptionRow;

  let responseBody: {
    creditsBalance: number;
    monthlyAllowance: number;
    resetAt: string;
    status: "active" | "trial" | "expired";
  };
  if (sub.status === "trial") {
    // Trial rows: meter denominator is the trial allowance stored on the row
    // (credits_monthly == TRIAL_ALLOWANCE), not the subscriber MONTHLY_ALLOWANCE.
    responseBody = {
      creditsBalance: sub.credits_balance,
      monthlyAllowance: sub.credits_monthly,
      resetAt: sub.reset_at ?? "",
      status: "trial",
    };
  } else if (sub.status === "active") {
    responseBody = {
      creditsBalance: sub.credits_balance,
      monthlyAllowance: MONTHLY_ALLOWANCE,
      resetAt: sub.reset_at ?? "",
      status: "active",
    };
  } else {
    responseBody = {
      creditsBalance: sub.credits_balance,
      monthlyAllowance: MONTHLY_ALLOWANCE,
      resetAt: sub.reset_at ?? "",
      status: "expired",
    };
  }
  return new Response(JSON.stringify(responseBody), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
};
