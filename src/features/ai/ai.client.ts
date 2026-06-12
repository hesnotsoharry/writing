/**
 * AI proxy client — session exchange + normalized SSE stream consumer.
 *
 * Decision 4: the app speaks ONLY the normalized event schema from the proxy.
 * There is no @anthropic-ai/sdk import here and no Anthropic wire-format parsing.
 *
 * Credit unit (informational): 1 unit = $0.00001 USD
 * The credit value reported in 'done' events is in these units.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export type NormalizedEvent =
  | { type: "token"; text: string }
  | { type: "done"; inputTokens: number; outputTokens: number; creditsCost: number }
  | { type: "error"; message: string };

export interface SessionResult {
  token: string;
  expiresAt: number;
}

/**
 * Credit unit value in USD. 1 credit unit = $0.00001.
 * Canonical definition: migration 0002_ai_subscriptions.sql.
 * Mirrored from marketing/functions/_lib/ai-token.ts (server copy).
 * Display use only on the client — no arithmetic here.
 */
export const CREDIT_UNIT_USD = 0.00001;

// ── Config ────────────────────────────────────────────────────────────────────

// Set VITE_AI_PROXY_URL in .env.local to point at a local wrangler dev server.
// Default: production proxy at writersnook.app (requires migration + secrets applied).
const API_BASE: string =
  (import.meta.env.VITE_AI_PROXY_URL as string | undefined) ?? "https://writersnook.app";

// ── Session exchange ──────────────────────────────────────────────────────────

/**
 * Exchange a subscription license key for a short-lived session token.
 * Throws on network error or non-200 response.
 */
export async function acquireSession(licenseKey: string): Promise<SessionResult> {
  const res = await fetch(`${API_BASE}/api/ai/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseKey }),
  });
  if (!res.ok) {
    throw new Error(`Session exchange failed: ${res.status}`);
  }
  return res.json() as Promise<SessionResult>;
}

// ── SSE line parser ───────────────────────────────────────────────────────────

function parseSseLine(line: string): NormalizedEvent | null {
  if (!line.startsWith("data: ")) return null;
  try {
    return JSON.parse(line.slice(6)) as NormalizedEvent;
  } catch {
    return null;
  }
}

// ── Streaming chat ────────────────────────────────────────────────────────────

/**
 * Stream a chat request through the proxy. Calls onEvent for each normalized
 * SSE event. Resolves when the stream closes (after the 'done' event).
 *
 * No Anthropic wire-format parsing occurs here — the proxy normalizes all events.
 */
export async function streamChat(
  token: string,
  messages: AiMessage[],
  onEvent: (ev: NormalizedEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    onEvent({ type: "error", message: `Chat request failed: ${res.status} ${errBody}` });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const ev = parseSseLine(line);
      if (ev) onEvent(ev);
    }
  }
  if (buffer.length > 0) {
    const ev = parseSseLine(buffer);
    if (ev) onEvent(ev);
  }
}
