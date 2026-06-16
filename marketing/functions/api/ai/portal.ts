/**
 * GET /api/ai/portal
 *
 * Authenticated (Bearer session token) endpoint that returns a fresh,
 * signed Lemon Squeezy customer-portal URL for the caller's subscription.
 *
 * The URL is short-lived (~24 h) and fetched fresh on every request —
 * it is NEVER cached or persisted.
 *
 * Response shape (200):
 *   { url: string }
 *
 * 401: missing / invalid / expired Bearer token, or no subscription row.
 * 404: subscription row exists but has no ls_subscription_id.
 * 502: Lemon Squeezy returned a non-2xx response, or response missing the URL.
 */
import { verifyToken } from "../../_lib/ai-token";
import { getCorsHeaders } from "../../_lib/cors";
import { AiEnv, makeServiceClient } from "../../_lib/supabase";

/** AiEnv extended with the LS API key needed to call the subscriptions endpoint. */
interface PortalEnv extends AiEnv {
  LS_API_KEY: string;
}

interface SubscriptionRow {
  ls_subscription_id: string | null;
}

interface LsSubscriptionResponse {
  data?: {
    attributes?: {
      urls?: {
        customer_portal?: string;
      };
    };
  };
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

export const onRequestOptions: PagesFunction<PortalEnv> = (context) => {
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

export const onRequestGet: PagesFunction<PortalEnv> = async (context) => {
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
    .select("ls_subscription_id")
    .eq("license_key", licenseKey)
    .single();

  const errCode = (error as { code?: string } | null)?.code;
  if (error && errCode !== "PGRST116") return new Response("Internal Server Error", { status: 500, headers: cors });
  if (!data) return new Response("Unauthorized", { status: 401, headers: cors });

  const sub = data as unknown as SubscriptionRow;
  if (!sub.ls_subscription_id) {
    return new Response("No subscription found", { status: 404, headers: cors });
  }

  let lsRes: Response;
  try {
    lsRes = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${sub.ls_subscription_id}`,
      {
        headers: {
          Authorization: `Bearer ${context.env.LS_API_KEY}`,
          Accept: "application/vnd.api+json",
        },
      },
    );
  } catch {
    return new Response("Upstream error", { status: 502, headers: cors });
  }

  if (!lsRes.ok) {
    return new Response("Upstream error", { status: 502, headers: cors });
  }

  let lsJson: LsSubscriptionResponse;
  try {
    lsJson = (await lsRes.json()) as LsSubscriptionResponse;
  } catch {
    return new Response("Upstream error", { status: 502, headers: cors });
  }

  const portalUrl = lsJson.data?.attributes?.urls?.customer_portal;
  if (!portalUrl) {
    return new Response("Upstream error", { status: 502, headers: cors });
  }

  return new Response(JSON.stringify({ url: portalUrl }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...cors },
  });
};
