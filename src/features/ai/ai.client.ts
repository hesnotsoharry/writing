/**
 * AI proxy client — session exchange + normalized SSE stream consumer.
 *
 * Decision 4: the app speaks ONLY the normalized event schema from the proxy.
 * There is no @anthropic-ai/sdk import here and no Anthropic wire-format parsing.
 *
 * Credit unit (informational): 1 unit = $0.00001 USD
 * The credit value reported in 'done' events is in these units.
 */

import { parseResetAt } from "./ai.helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export type NormalizedEvent =
  | { type: "token"; text: string }
  | { type: "done"; inputTokens: number; outputTokens: number; creditsCost: number }
  | { type: "error"; message: string }
  /** Proxy returned 429 — credit balance exhausted. */
  | { type: "credits-exhausted"; resetAt: string }
  /** Proxy returned 403 — session token invalid or subscription expired. */
  | { type: "session-expired" };

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
 * Optional parameters for streamChat.
 * - maxTokens: per-verb output cap (proxy uses this to reserve credits).
 * - system: system prompt forwarded to Anthropic's `system` field by the proxy.
 * - signal: AbortSignal for stop-button support.
 */
export interface BalanceResult {
  creditsBalance: number;
  monthlyAllowance: number;
  resetAt: string;
  status: "active" | "expired";
}

export interface StreamChatOptions {
  maxTokens?: number;
  system?: string;
  signal?: AbortSignal;
}

/**
 * Fetch the current credit balance for a session token.
 * Throws on network error or non-200 response.
 */
export async function getBalance(token: string): Promise<BalanceResult> {
  const res = await fetch(`${API_BASE}/api/ai/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
  return res.json() as Promise<BalanceResult>;
}

function buildChatBody(
  messages: AiMessage[],
  options: StreamChatOptions | undefined,
): Record<string, unknown> {
  const body: Record<string, unknown> = { messages };
  if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens;
  if (options?.system) body.system = options.system;
  return body;
}

async function drainStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (ev: NormalizedEvent) => void,
): Promise<void> {
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
  options?: StreamChatOptions,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(buildChatBody(messages, options)),
    signal: options?.signal,
  });
  if (res.status === 429) {
    const raw = await res.json().catch(() => null);
    const resetAt =
      raw !== null && typeof raw === "object" && "resetAt" in raw
        ? parseResetAt((raw as { resetAt: unknown }).resetAt)
        : "";
    onEvent({ type: "credits-exhausted", resetAt });
    return;
  }
  if (res.status === 403) {
    onEvent({ type: "session-expired" });
    return;
  }
  if (!res.ok || !res.body) {
    const errBody = await res.text().catch(() => "");
    onEvent({ type: "error", message: `Chat request failed: ${res.status} ${errBody}` });
    return;
  }
  await drainStream(res.body.getReader(), onEvent);
}
