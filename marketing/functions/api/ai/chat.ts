/**
 * POST /api/ai/chat
 *
 * Authenticated (Bearer session token) chat endpoint. Validates the token,
 * checks the per-license rate cap, reserves credits, streams the Anthropic
 * Messages API response as a normalized SSE event schema, then reconciles
 * credits from actual token usage (refund-only — balance never goes negative).
 *
 * Normalized SSE schema (Decision 4):
 *   {type:'token', text:string}
 *   {type:'done', inputTokens:number, outputTokens:number, creditsCost:number}
 *   {type:'error', message:string}
 *
 * Credit flow (Decision 3 — reserve-then-reconcile):
 *   1. reserve_credits(estimate) — atomic; returns null if insufficient → 429.
 *   2. Stream Anthropic response, relay token events.
 *   3. On stream completion: refund_credits(reserve − actual) if reserve > actual.
 *   4. On stream failure: refund_credits(full reserve).
 *   creditsCost in 'done' = min(reserve, actual) — what was actually charged.
 *
 * 429 shapes (distinct bodies per caller):
 *   Zero-credit:  {creditsRemaining:0, resetAt:string|null}
 *   Rate-cap:     {error:'rate_limit_exceeded', retryAfterSeconds:number}
 *
 * No request/response body logging anywhere in this file (Decision 4 privacy).
 * Credit unit: 1 unit = $0.00001 USD (see migration 0002_ai_subscriptions.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyToken } from "../../_lib/ai-token";
import { getCorsHeaders, handleOptions } from "../../_lib/cors";
import {
  INPUT_UNITS_PER_TOKEN,
  OUTPUT_UNITS_PER_TOKEN,
  RATE_CAP_PER_MINUTE,
  RATE_WINDOW_SECONDS,
  actualCredits,
  estimateCredits,
} from "../../_lib/credits";
import { AiEnv, makeServiceClient } from "../../_lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Model for Phase 1/2. Pinned to dated variant per reviewer fix (wave-34).
const MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1024;
const MAX_TOKENS_CAP = 4096;
const SYSTEM_LENGTH_CAP = 32_000;

// Re-export for consumers that import from chat.ts (e.g. tests checking rates).
export { INPUT_UNITS_PER_TOKEN, OUTPUT_UNITS_PER_TOKEN };

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  messages?: unknown;
  max_tokens?: unknown;
  system?: unknown;
}

interface SubscriptionRow {
  status: string;
  credits_balance: number;
  reset_at: string | null;
}

interface SseState {
  inputTokens: number;
  outputTokens: number;
}

interface StreamArgs {
  apiKey: string;
  messages: Message[];
  maxTokens: number;
  system?: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  db: SupabaseClient;
  licenseKey: string;
  reserve: number;
  requestId: string;
}

// ── SSE write helper ──────────────────────────────────────────────────────────

async function writeSse(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  payload: unknown,
): Promise<void> {
  await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

// ── Request parsing ───────────────────────────────────────────────────────────

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function parseMessages(raw: unknown): Message[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const msgs: Message[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) return null;
    const { role, content } = item as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    msgs.push({ role, content });
  }
  return msgs;
}

// ── Anthropic SSE parsing ─────────────────────────────────────────────────────

function processAnthropicLine(line: string, state: SseState): string | null {
  if (!line.startsWith("data: ")) return null;
  const json = line.slice(6).trim();
  if (!json || json === "[DONE]") return null;
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
  const type = event.type as string | undefined;
  if (type === "message_start") {
    const msg = event.message as { usage?: { input_tokens?: number } } | undefined;
    state.inputTokens = msg?.usage?.input_tokens ?? 0;
    return null;
  }
  if (type === "content_block_delta") {
    const delta = event.delta as { type?: string; text?: string } | undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") return delta.text;
    return null;
  }
  if (type === "message_delta") {
    const usage = event.usage as { output_tokens?: number } | undefined;
    state.outputTokens = usage?.output_tokens ?? state.outputTokens;
    return null;
  }
  return null;
}

async function pumpAnthropicToClient(
  upstreamBody: ReadableStream<Uint8Array>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
): Promise<SseState> {
  const reader = upstreamBody.getReader();
  const decoder = new TextDecoder();
  const state: SseState = { inputTokens: 0, outputTokens: 0 };
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const text = processAnthropicLine(line, state);
      if (text !== null) await writeSse(writer, encoder, { type: "token", text });
    }
  }
  if (buffer.length > 0) {
    const text = processAnthropicLine(buffer, state);
    if (text !== null) await writeSse(writer, encoder, { type: "token", text });
  }
  return state;
}

// ── Anthropic fetch ───────────────────────────────────────────────────────────

async function callAnthropic(
  messages: Message[],
  maxTokens: number,
  apiKey: string,
  system?: string,
): Promise<Response> {
  const requestBody: Record<string, unknown> = { model: MODEL, max_tokens: maxTokens, stream: true, messages };
  if (system) requestBody["system"] = system;
  return fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
}

// ── Credit helpers ────────────────────────────────────────────────────────────

async function reserveCredits(
  db: SupabaseClient,
  licenseKey: string,
  amount: number,
  requestId: string,
): Promise<boolean> {
  const { data } = await db.rpc("reserve_credits", {
    p_license_key: licenseKey,
    p_amount: amount,
    p_request_id: requestId,
  });
  return data !== null;
}

async function refundCredits(
  db: SupabaseClient,
  licenseKey: string,
  amount: number,
  requestId: string,
  meta: Record<string, unknown>,
): Promise<void> {
  await db.rpc("refund_credits", {
    p_license_key: licenseKey,
    p_amount: amount,
    p_request_id: requestId,
    p_meta: meta,
  });
}

// ── Stream runner (runs in waitUntil) ─────────────────────────────────────────

async function runStream(args: StreamArgs): Promise<void> {
  const { apiKey, messages, maxTokens, system, writer, encoder, db, licenseKey, reserve, requestId } = args;
  let refunded = false;
  try {
    const anthropicRes = await callAnthropic(messages, maxTokens, apiKey, system);
    if (!anthropicRes.ok || !anthropicRes.body) {
      await refundCredits(db, licenseKey, reserve, requestId, { reason: "upstream_error" });
      refunded = true;
      await writeSse(writer, encoder, { type: "error", message: "Upstream error" });
      return;
    }
    const state = await pumpAnthropicToClient(anthropicRes.body, writer, encoder);
    const actual = actualCredits(state.inputTokens, state.outputTokens);
    const refundAmount = Math.max(0, reserve - actual);
    const charged = reserve - refundAmount; // what was actually consumed
    if (refundAmount > 0) {
      await refundCredits(db, licenseKey, refundAmount, requestId, {
        input_tokens: state.inputTokens,
        output_tokens: state.outputTokens,
        model: MODEL,
      });
    }
    await writeSse(writer, encoder, {
      type: "done",
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      creditsCost: charged,
    });
  } catch {
    if (!refunded) {
      await refundCredits(db, licenseKey, reserve, requestId, { reason: "stream_error" }).catch(
        () => {},
      );
    }
    await writeSse(writer, encoder, { type: "error", message: "Stream error" }).catch(() => {});
  } finally {
    await writer.close().catch(() => {});
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const onRequestOptions: PagesFunction<AiEnv> = (context) => {
  return handleOptions(context.request);
};

export const onRequestPost: PagesFunction<AiEnv> = async (context) => {
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

  const body = (await context.request.json()) as ChatBody;
  const messages = parseMessages(body.messages);
  if (!messages) return new Response("Bad Request", { status: 400, headers: cors });
  if (body.system !== undefined && body.system !== null) {
    if (typeof body.system !== "string") return new Response("Bad Request", { status: 400, headers: cors });
    if (body.system.length > SYSTEM_LENGTH_CAP) return new Response("Bad Request", { status: 400, headers: cors });
  }
  const system = typeof body.system === "string" && body.system.length > 0 ? body.system : undefined;
  const maxTokens =
    typeof body.max_tokens === "number"
      ? Math.min(body.max_tokens, MAX_TOKENS_CAP)
      : DEFAULT_MAX_TOKENS;

  const db = makeServiceClient(context.env);

  // Subscription check
  const { data, error: subErr } = await db
    .from("subscriptions")
    .select("status, credits_balance, reset_at")
    .eq("license_key", licenseKey)
    .single();
  if (subErr || !data) return new Response("Forbidden", { status: 403, headers: cors });
  const sub = data as unknown as SubscriptionRow;
  if (sub.status !== "active") return new Response("Forbidden", { status: 403, headers: cors });

  // Per-license rate cap (D3) — checked before credit reserve to fail fast
  const { data: ratePassed } = await db.rpc("check_rate_limit", {
    p_license_key: licenseKey,
    p_cap: RATE_CAP_PER_MINUTE,
    p_window_seconds: RATE_WINDOW_SECONDS,
  });
  if (!ratePassed) {
    return new Response(
      JSON.stringify({ error: "rate_limit_exceeded", retryAfterSeconds: RATE_WINDOW_SECONDS }),
      { status: 429, headers: { "Content-Type": "application/json", ...cors } },
    );
  }

  // Reserve credits (max possible cost for this request)
  const totalChars = messages.reduce((s, m) => s + m.content.length, 0) + (system?.length ?? 0);
  const reserve = estimateCredits(totalChars, maxTokens);
  const requestId = crypto.randomUUID();

  const reserved = await reserveCredits(db, licenseKey, reserve, requestId);
  if (!reserved) {
    return new Response(
      JSON.stringify({ creditsRemaining: sub.credits_balance, resetAt: sub.reset_at ?? "" }),
      { status: 429, headers: { "Content-Type": "application/json", ...cors } },
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  context.waitUntil(
    runStream({
      apiKey: context.env.ANTHROPIC_API_KEY,
      messages,
      maxTokens,
      system,
      writer,
      encoder,
      db,
      licenseKey,
      reserve,
      requestId,
    }),
  );
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...cors,
    },
  });
};
