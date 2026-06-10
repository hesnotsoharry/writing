import { Env } from "./supabase";

interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
}

interface SendResult {
  id: string | null;
  skipped?: boolean;
}

export async function sendEmail(env: Env, msg: EmailMessage): Promise<SendResult> {
  const key = env.RESEND_API_KEY;
  if (!key || key.startsWith("replace-") || !env.RESEND_FROM) {
    console.warn("[resend] RESEND_API_KEY or RESEND_FROM is missing or a placeholder — skipping send.");
    return { id: null, skipped: true };
  }

  const payload: Record<string, unknown> = {
    from: env.RESEND_FROM,
    to: Array.isArray(msg.to) ? msg.to : [msg.to],
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  };
  if (msg.replyTo) payload["reply_to"] = msg.replyTo;
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (msg.idempotencyKey) headers["Idempotency-Key"] = msg.idempotencyKey;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body,
    });

    if (!resp.ok) {
      console.warn(`[resend] Non-OK response: ${resp.status}`);
      return { id: null };
    }

    const data = await resp.json() as { id?: string | null };
    return { id: data.id ?? null };
  } catch (err) {
    console.warn("[resend] Send failed:", err);
    return { id: null };
  }
}
