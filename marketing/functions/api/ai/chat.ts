/**
 * POST /api/ai/chat
 *
 * Authenticated (Bearer session token) chat endpoint. Validates the token,
 * checks credit balance, streams the Anthropic Messages API response as a
 * normalized SSE event schema, and decrements credits.
 *
 * Normalized SSE schema (Decision 4):
 *   {type:'token', text:string}
 *   {type:'done', inputTokens:number, outputTokens:number, creditsCost:number}
 *   {type:'error', message:string}
 *
 * No request/response body logging anywhere in this file (Decision 4 privacy).
 * Credit unit: 1 unit = $0.00001 USD (see migration 0002_ai_subscriptions.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyToken } from "../../_lib/ai-token";
import { getCorsHeaders, handleOptions } from "../../_lib/cors";
import { AiEnv, makeServiceClient } from "../../_lib/supabase";

// ── Constants ─────────────────────────────────────────────────────────────────

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Model for Phase 1. Pinned to dated variant per reviewer fix (wave-34).
const MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_TOKENS = 1024;
const MAX_TOKENS_CAP = 4096;
// Haiku 4.5 pricing: $1/MTok input, $5/MTok output → units per token
const INPUT_UNITS_PER_TOKEN = 0.1;
const OUTPUT_UNITS_PER_TOKEN = 0.5;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  messages?: unknown;
  max_tokens?: unknown;
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
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  db: SupabaseClient;
  licenseKey: string;
  estimatedCost: number;
}

// ── Credit helpers ────────────────────────────────────────────────────────────

function estimateCredits(charCount: number, maxTokens: number): number {
  const inputEst = Math.ceil((charCount / 4) * INPUT_UNITS_PER_TOKEN);
  const outputReserve = Math.ceil(maxTokens * OUTPUT_UNITS_PER_TOKEN);
  return inputEst + outputReserve;
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
): Promise<Response> {
  return fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, stream: true, messages }),
  });
}

// ── Credit decrement ──────────────────────────────────────────────────────────

async function attemptDecrement(
  db: SupabaseClient,
  licenseKey: string,
  cost: number,
): Promise<boolean> {
  // Atomic: single UPDATE … WHERE credits_balance >= p_cost RETURNING credits_balance.
  // Returns NULL (no row) when credits are insufficient or subscription is inactive,
  // preventing the TOCTOU double-spend where two concurrent requests both pass a
  // pre-flight balance check before either writes.
  const { data } = await db.rpc("decrement_credits", {
    p_license_key: licenseKey,
    p_cost: cost,
  });
  return data !== null;
}

// ── Stream runner (runs in waitUntil) ─────────────────────────────────────────

async function runStream(args: StreamArgs): Promise<void> {
  const { apiKey, messages, maxTokens, writer, encoder, db, licenseKey, estimatedCost } = args;
  try {
    const anthropicRes = await callAnthropic(messages, maxTokens, apiKey);
    if (!anthropicRes.ok || !anthropicRes.body) {
      await writeSse(writer, encoder, { type: "error", message: "Upstream error" });
      return;
    }
    const state = await pumpAnthropicToClient(anthropicRes.body, writer, encoder);
    await writeSse(writer, encoder, {
      type: "done",
      inputTokens: state.inputTokens,
      outputTokens: state.outputTokens,
      creditsCost: estimatedCost,
    });
    await db.from("credit_events").insert({
      license_key: licenseKey,
      event_type: "decrement",
      delta: -estimatedCost,
      meta: { input_tokens: state.inputTokens, output_tokens: state.outputTokens, model: MODEL },
    });
  } catch {
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
  const licenseKey = await verifyToken(rawToken, context.env.PROXY_SESSION_SECRET);
  if (!licenseKey) return new Response("Unauthorized", { status: 401, headers: cors });

  const body = (await context.request.json()) as ChatBody;
  const messages = parseMessages(body.messages);
  if (!messages) return new Response("Bad Request", { status: 400, headers: cors });
  const maxTokens =
    typeof body.max_tokens === "number"
      ? Math.min(body.max_tokens, MAX_TOKENS_CAP)
      : DEFAULT_MAX_TOKENS;

  const db = makeServiceClient(context.env);
  const { data, error: subErr } = await db
    .from("subscriptions")
    .select("status, credits_balance, reset_at")
    .eq("license_key", licenseKey)
    .single();
  if (subErr || !data) return new Response("Forbidden", { status: 403, headers: cors });
  const sub = data as unknown as SubscriptionRow;
  if (sub.status !== "active") return new Response("Forbidden", { status: 403, headers: cors });

  const totalChars = messages.reduce((s, m) => s + m.content.length, 0);
  const estimatedCost = estimateCredits(totalChars, maxTokens);
  const decremented = await attemptDecrement(db, licenseKey, estimatedCost);
  if (!decremented) {
    return new Response(
      JSON.stringify({ creditsRemaining: sub.credits_balance, resetAt: sub.reset_at }),
      { status: 429, headers: { "Content-Type": "application/json", ...cors } },
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  context.waitUntil(
    runStream({ apiKey: context.env.ANTHROPIC_API_KEY, messages, maxTokens, writer, encoder, db, licenseKey, estimatedCost }),
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
