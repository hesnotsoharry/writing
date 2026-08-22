import { Env, makeServiceClient } from "../_lib/supabase";
import { verifyTurnstileToken } from "../_lib/turnstile";
import { isValidEmail } from "../_lib/validate";

interface NewsletterBody {
  email?: unknown;
  turnstileToken?: unknown;
}

/**
 * Enforced only when TURNSTILE_SECRET_KEY is set (deploys in lockstep with the
 * form's widget). Unset → today's behavior, no check at all.
 */
async function checkTurnstile(
  env: Env,
  token: unknown,
  ip: string | null,
): Promise<Response | null> {
  if (!env.TURNSTILE_SECRET_KEY) return null;
  if (typeof token !== "string" || token.trim() === "") {
    return Response.json({ ok: false, error: "turnstile token required" }, { status: 400 });
  }
  const verified = await verifyTurnstileToken(token, env.TURNSTILE_SECRET_KEY, ip ?? undefined);
  if (!verified.success) {
    return Response.json({ ok: false, error: "turnstile verification failed" }, { status: 403 });
  }
  return null;
}

export async function onRequestPost(
  context: { request: Request; env: Env },
): Promise<Response> {
  let body: NewsletterBody;
  try {
    body = (await context.request.json()) as NewsletterBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";

  const turnstileFailure = await checkTurnstile(
    context.env,
    body.turnstileToken,
    context.request.headers.get("CF-Connecting-IP"),
  );
  if (turnstileFailure) return turnstileFailure;

  if (!isValidEmail(email)) {
    return Response.json({ ok: false, error: "valid email is required" }, { status: 400 });
  }

  const db = makeServiceClient(context.env);
  const { error } = await db
    .from("newsletter_subscribers")
    .upsert({ email }, { onConflict: "email" });

  if (error) {
    return Response.json({ ok: false, error: "subscription failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
