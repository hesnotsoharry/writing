import { Env, makeServiceClient } from "../_lib/supabase";
import { isValidEmail } from "../_lib/validate";

interface NewsletterBody {
  email?: unknown;
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
