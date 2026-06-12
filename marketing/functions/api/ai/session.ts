/**
 * POST /api/ai/session
 *
 * Exchange a subscription license key for a short-lived HMAC session token.
 * The token is used to authenticate subsequent requests to /api/ai/chat.
 *
 * Decision 2: token held in React state only (never persisted to SQLite).
 * Decision 6: endpoint is auth-gated from first commit.
 */
import { buildToken } from "../../_lib/ai-token";
import { getCorsHeaders, handleOptions } from "../../_lib/cors";
import { AiEnv, makeServiceClient } from "../../_lib/supabase";

interface SessionBody {
  licenseKey?: unknown;
}

interface SubscriptionStatusRow {
  status: string;
}

export const onRequestOptions: PagesFunction<AiEnv> = (context) => {
  return handleOptions(context.request);
};

export const onRequestPost: PagesFunction<AiEnv> = async (context) => {
  const cors = getCorsHeaders(context.request);

  const body = (await context.request.json()) as SessionBody;
  if (typeof body.licenseKey !== "string" || body.licenseKey.trim() === "") {
    return new Response("Bad Request", { status: 400, headers: cors });
  }
  const licenseKey = body.licenseKey;

  const db = makeServiceClient(context.env);
  const { data, error } = await db
    .from("subscriptions")
    .select("status")
    .eq("license_key", licenseKey)
    .single();

  if (error || !data) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }
  const row = data as unknown as SubscriptionStatusRow;
  if (row.status !== "active") {
    return new Response("Forbidden", { status: 403, headers: cors });
  }

  let token: string;
  let expiresAt: number;
  try {
    ({ token, expiresAt } = await buildToken(licenseKey, context.env.PROXY_SESSION_SECRET));
  } catch {
    return new Response("Internal Server Error", { status: 500, headers: cors });
  }
  return new Response(JSON.stringify({ token, expiresAt }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
};
