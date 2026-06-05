import { sendEmail } from "../_lib/resend";
import { Env } from "../_lib/supabase";
import { isValidEmail } from "../_lib/validate";

interface ContactBody {
  name?: unknown;
  email?: unknown;
  message?: unknown;
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
