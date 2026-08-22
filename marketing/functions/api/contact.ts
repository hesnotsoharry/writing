import { sendEmail } from "../_lib/resend";
import { Env } from "../_lib/supabase";
import { verifyTurnstileToken } from "../_lib/turnstile";
import { isValidEmail } from "../_lib/validate";

interface ContactBody {
  name?: unknown;
  email?: unknown;
  message?: unknown;
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

function buildEmail(name: string, email: string, message: string): { html: string; text: string } {
  const html =
    `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p>` +
    `<p><strong>Message:</strong></p><p>${message.replace(/\n/g, "<br>")}</p>`;
  const text = `From: ${name} <${email}>\n\nMessage:\n${message}`;
  return { html, text };
}

export async function onRequestPost(
  context: { request: Request; env: Env },
): Promise<Response> {
  let body: ContactBody;
  try {
    body = (await context.request.json()) as ContactBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  const turnstileFailure = await checkTurnstile(
    context.env,
    body.turnstileToken,
    context.request.headers.get("CF-Connecting-IP"),
  );
  if (turnstileFailure) return turnstileFailure;

  if (!name) {
    return Response.json({ ok: false, error: "name is required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return Response.json({ ok: false, error: "valid email is required" }, { status: 400 });
  }
  if (!message) {
    return Response.json({ ok: false, error: "message is required" }, { status: 400 });
  }

  const { html, text } = buildEmail(name, email, message);
  await sendEmail(context.env, {
    to: context.env.CONTACT_TO ?? "support@writersnook.app",
    subject: `Contact form: ${name}`,
    html,
    text,
    replyTo: email,
  });

  return Response.json({ ok: true });
}
