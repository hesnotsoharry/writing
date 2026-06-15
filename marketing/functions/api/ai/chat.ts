/**
 * POST /api/ai/chat
 *
 * Authenticated (Bearer session token) chat endpoint. Validates the token,
 * checks the per-license rate cap, reserves credits, streams the provider
 * response as a normalized SSE event schema, then reconciles credits from
 * actual token usage (refund-only — balance never goes negative).
 *
 * Normalized SSE schema (Decision 4):
 *   {type:'token', text:string}
 *   {type:'done', inputTokens:number, outputTokens:number, creditsCost:number, balanceAfter:number|null}
 *   {type:'error', message:string}
 *
 * Credit flow (Decision 3 — reserve-then-reconcile):
 *   1. reserve_credits(estimate) — atomic; returns null if insufficient → 429.
 *   2. Stream provider response, relay token events.
 *   3. On stream completion: refund_credits(reserve − actual) if reserve > actual.
 *   4. On stream failure: refund_credits(full reserve).
 *   creditsCost in 'done' = min(reserve, actual) — what was actually charged.
 *   balanceAfter in 'done' = settled credits_balance after reconcile (authoritative;
 *     lets the client update its meter without a follow-up /balance round-trip).
 *
 * 429 shapes (distinct bodies per caller):
 *   Zero-credit:  {creditsRemaining:0, resetAt:string|null}
 *   Rate-cap:     {error:'rate_limit_exceeded', retryAfterSeconds:number}
 *
 * Verb resolution (Decision 1 D1–D2, Wave 37):
 *   Present + valid → VERB_CONFIG[verb] (model / temperature / maxTokens)
 *   Present + unknown → 400
 *   Absent (un-updated client) → FALLBACK_VERB_CONFIG (Haiku, maxTokens 1536)
 *   Client-sent max_tokens is IGNORED — proxy owns policy.
 *
 * Provider routing (W44 Decision 1): getAdapter(model) reads RATES[model].provider
 * and dispatches to AnthropicAdapter or OpenAIAdapter. The refund-on-error path
 * (Q4 outage policy) is provider-agnostic — covers both Anthropic and OpenAI errors.
 *
 * No request/response body logging anywhere in this file (Decision 4 privacy).
 * Credit unit: 1 unit = $0.00001 USD (see migration 0002_ai_subscriptions.sql).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyToken } from "../../_lib/ai-token";
import { getCorsHeaders, handleOptions } from "../../_lib/cors";
import {
  GLOBAL_DAILY_TRIAL_SPEND_CAP,
  INPUT_UNITS_PER_TOKEN,
  OUTPUT_UNITS_PER_TOKEN,
  RATE_CAP_PER_MINUTE,
  RATE_WINDOW_SECONDS,
  actualCredits,
  estimateCredits,
} from "../../_lib/credits";
import { getAdapter } from "../../_lib/providers/index";
import type { Message, ResolvedConfig } from "../../_lib/providers/types";
import { AiEnv, makeServiceClient } from "../../_lib/supabase";
import type { VerbKey } from "../../_lib/verb-config";
import { FALLBACK_VERB_CONFIG, VERB_CONFIG } from "../../_lib/verb-config";

// ── Constants ─────────────────────────────────────────────────────────────────

const SYSTEM_LENGTH_CAP = 32_000;

// Re-export deprecated Haiku rate constants for consumers that import from chat.ts.
export { INPUT_UNITS_PER_TOKEN, OUTPUT_UNITS_PER_TOKEN };

// ── Model allowlist (W44 Phase C) ─────────────────────────────────────────────

/**
 * The models offered to the managed tier.
 * MUST be a subset of Object.keys(RATES) — a model here but missing from RATES
 * would silently bill at the Haiku fallback (the acceptance test guards this invariant).
 *
 * Standard tier:  Haiku / Sonnet / GPT-5.4-mini / GPT-5.4
 * Premium tier:   Opus / GPT-5.5  (~3× cost; no paywall — all subscribers may pick these)
 */
export const MANAGED_MODELS: ReadonlySet<string> = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'gpt-5.4-mini',
  'gpt-5.4',
  'claude-opus-4-8',
  'gpt-5.5',
]);

/**
 * Resolve the effective per-request config from the verb default and an optional
 * client-supplied model override.
 *
 * Rules (Decision 4 + Q2 + Q5):
 *   - proofread: ALWAYS uses its cheap verb-default (mechanical, un-bypassable).
 *   - absent client model: verb default.
 *   - present client model in MANAGED_MODELS: override just the model; preserve
 *     verb temperature / maxTokens / thinking policy.
 *   - present client model NOT in MANAGED_MODELS, or not a string: { ok: false }
 *     → handler returns 400.
 */
export function resolveModelConfig(
  verbKey: VerbKey | undefined,
  verbConfig: ResolvedConfig,
  clientModel: unknown,
): { ok: true; config: ResolvedConfig } | { ok: false } {
  // proofread always uses its cheap verb-default — client model ignored (Q2, mechanical).
  if (verbKey === 'proofread') return { ok: true, config: verbConfig };
  // absent client model → verb default.
  if (clientModel === undefined || clientModel === null) return { ok: true, config: verbConfig };
  // present client model: must be a string AND in the allowlist, else 400.
  if (typeof clientModel !== 'string' || !MANAGED_MODELS.has(clientModel)) return { ok: false };
  // override the model, preserve verb's temperature/maxTokens/thinking policy.
  return { ok: true, config: { ...verbConfig, model: clientModel } as ResolvedConfig };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatBody {
  messages?: unknown;
  system?: unknown;
  /** Optional verb key — determines model / temperature / max_tokens server-side. */
  verb?: unknown;
  /** Optional model override — validated against MANAGED_MODELS; ignored for proofread. */
  model?: unknown;
}

interface SubscriptionRow {
  status: string;
  credits_balance: number;
  reset_at: string | null;
}

interface StreamArgs {
  anthropicKey: string;
  openaiKey: string;
  messages: Message[];
  verbConfig: ResolvedConfig;
  system?: string;
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  db: SupabaseClient;
  licenseKey: string;
  reserve: number;
  requestId: string;
  isTrial: boolean;
  /** Credits balance immediately after the reserve deduction; used as balanceAfter when no refund fires. */
  balanceAfterReserve: number | null;
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

// ── Credit helpers ────────────────────────────────────────────────────────────

async function reserveCredits(
  db: SupabaseClient,
  licenseKey: string,
  amount: number,
  requestId: string,
): Promise<number | null> {
  const { data } = await db.rpc("reserve_credits", {
    p_license_key: licenseKey,
    p_amount: amount,
    p_request_id: requestId,
  });
  return typeof data === 'number' ? data : null;
}

async function refundCredits(
  db: SupabaseClient,
  licenseKey: string,
  amount: number,
  requestId: string,
  meta: Record<string, unknown>,
): Promise<number | null> {
  const { data } = await db.rpc("refund_credits", {
    p_license_key: licenseKey,
    p_amount: amount,
    p_request_id: requestId,
    p_meta: meta,
  });
  return typeof data === 'number' ? data : null;
}

interface TrialReserveResult {
  ok: boolean;
  reason: string | null;
  newBalance: number | null;
}

async function reserveTrialCredits(
  db: SupabaseClient,
  licenseKey: string,
  amount: number,
  requestId: string,
): Promise<TrialReserveResult> {
  const { data, error } = await db.rpc("reserve_trial_credits", {
    p_license_key: licenseKey,
    p_amount: amount,
    p_request_id: requestId,
    p_daily_cap: GLOBAL_DAILY_TRIAL_SPEND_CAP,
  });
  const row = (data as Array<{ reason: string | null; new_balance: number | null }> | null)?.[0];
  // Fail closed: an RPC error or a missing return row must NOT count as a successful reserve —
  // otherwise a trial stream could run unmetered (the subscriber path fails closed the same way).
  // `ok` requires a real row whose reason is null; on error/no-row the caller denies the stream.
  const ok = !error && !!row && row.reason == null;
  return { ok, reason: row?.reason ?? null, newBalance: row?.new_balance ?? null };
}

async function refundTrialCredits(
  db: SupabaseClient,
  licenseKey: string,
  amount: number,
  requestId: string,
  meta: Record<string, unknown>,
): Promise<number | null> {
  const { data } = await db.rpc("refund_trial_credits", {
    p_license_key: licenseKey,
    p_amount: amount,
    p_request_id: requestId,
    p_meta: meta ?? null,
  });
  return typeof data === 'number' ? data : null;
}

// ── Stream runner (runs in waitUntil) ─────────────────────────────────────────

async function runStream(args: StreamArgs): Promise<void> {
  const {
    anthropicKey, openaiKey, messages, verbConfig, system,
    writer, encoder, db, licenseKey, reserve, requestId, isTrial, balanceAfterReserve,
  } = args;
  const doRefund = isTrial ? refundTrialCredits : refundCredits;
  let refunded = false;
  try {
    const adapter = getAdapter(verbConfig.model);
    const apiKey = adapter.provider === "openai" ? openaiKey : anthropicKey;
    const { url, headers, body } = adapter.buildRequest({ messages, config: verbConfig, system, apiKey });
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok || !res.body) {
      await doRefund(db, licenseKey, reserve, requestId, { reason: "upstream_error" });
      refunded = true;
      await writeSse(writer, encoder, { type: "error", message: "Upstream error" });
      return;
    }
    const usage = await adapter.pump(res.body, (text) =>
      writeSse(writer, encoder, { type: "token", text }),
    );
    // Pass cache buckets separately — inputTokens is non-cached input only.
    // Do not double-count: cacheCreationTokens and cacheReadTokens are billed at their
    // own rates (1.25x and 0.1x respectively for Anthropic), not at the base input rate.
    // For OpenAI, the adapter already subtracts cached_tokens from prompt_tokens (Decision 3).
    const actual = actualCredits(
      usage.inputTokens,
      usage.outputTokens,
      verbConfig.model,
      usage.cacheCreationTokens,
      usage.cacheReadTokens,
      "1h",
    );
    const refundAmount = Math.max(0, reserve - actual);
    const charged = reserve - refundAmount;
    // Compute the authoritative settled balance:
    //   - Refund path: the refund RPC returns the new balance after restoring unused credits.
    //   - No-refund path (actual >= reserve): no credits were returned, so the balance right
    //     after the reserve deduction IS the settled balance (balanceAfterReserve).
    let balanceAfter: number | null;
    if (refundAmount > 0) {
      balanceAfter = await doRefund(db, licenseKey, refundAmount, requestId, {
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        model: verbConfig.model,
      });
    } else {
      balanceAfter = balanceAfterReserve;
    }
    await writeSse(writer, encoder, {
      type: "done",
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      creditsCost: charged,
      balanceAfter,
    });
  } catch {
    if (!refunded) {
      await doRefund(db, licenseKey, reserve, requestId, { reason: "stream_error" }).catch(
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

  // Verb resolution (Decision 1 D2): proxy owns the model/maxTokens/temperature policy.
  // Client-sent max_tokens is intentionally ignored.
  const verbStr = typeof body.verb === "string" ? body.verb.toLowerCase() : undefined;
  if (verbStr !== undefined && !Object.hasOwn(VERB_CONFIG, verbStr)) {
    return new Response("Bad Request", { status: 400, headers: cors });
  }
  const verbConfig: ResolvedConfig = verbStr
    ? VERB_CONFIG[verbStr as VerbKey]
    : FALLBACK_VERB_CONFIG;

  // Model selection (W44 Phase C Decision 4): validate client model against allowlist.
  // proofread always uses the cheap verb-default regardless; unlisted model → 400.
  const resolved = resolveModelConfig(verbStr as VerbKey | undefined, verbConfig, body.model);
  if (!resolved.ok) return new Response("Bad Request", { status: 400, headers: cors });
  const effectiveConfig = resolved.config;

  // W51 P1: explicit adapter pre-flight — unknown model → 400 before any credit or stream work.
  // resolveModelConfig+MANAGED_MODELS already prevents this in practice; this guard ensures
  // getAdapter's throw never surfaces as an unhandled 500 or a silent fallback.
  try {
    getAdapter(effectiveConfig.model);
  } catch (e) {
    const msg = e instanceof Error ? e.message : `Unknown model: ${effectiveConfig.model}`;
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...cors },
    });
  }

  const db = makeServiceClient(context.env);

  // Subscription check
  const { data, error: subErr } = await db
    .from("subscriptions")
    .select("status, credits_balance, reset_at")
    .eq("license_key", licenseKey)
    .single();
  if (subErr || !data) return new Response("Forbidden", { status: 403, headers: cors });
  const sub = data as unknown as SubscriptionRow;
  if (sub.status !== "active" && sub.status !== "trial") return new Response("Forbidden", { status: 403, headers: cors });
  const isTrial = sub.status === "trial";

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
  const reserve = estimateCredits(totalChars, effectiveConfig.maxTokens, effectiveConfig.model, system?.length ?? 0);
  const requestId = crypto.randomUUID();

  let balanceAfterReserve: number | null = null;
  if (isTrial) {
    const trialReserve = await reserveTrialCredits(db, licenseKey, reserve, requestId);
    if (!trialReserve.ok) {
      if (trialReserve.reason === "budget") {
        return new Response(
          JSON.stringify({ error: "trial_budget_exhausted", resetAt: "" }),
          { status: 429, headers: { "Content-Type": "application/json", ...cors } },
        );
      }
      // reason === 'balance': per-trial allowance exhausted — fire the existing credits-exhausted handler
      return new Response(
        JSON.stringify({ creditsRemaining: sub.credits_balance, resetAt: sub.reset_at ?? "" }),
        { status: 429, headers: { "Content-Type": "application/json", ...cors } },
      );
    }
    balanceAfterReserve = trialReserve.newBalance;
  } else {
    const reserved = await reserveCredits(db, licenseKey, reserve, requestId);
    if (reserved === null) {
      return new Response(
        JSON.stringify({ creditsRemaining: sub.credits_balance, resetAt: sub.reset_at ?? "" }),
        { status: 429, headers: { "Content-Type": "application/json", ...cors } },
      );
    }
    balanceAfterReserve = reserved;
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  context.waitUntil(
    runStream({
      anthropicKey: context.env.ANTHROPIC_API_KEY,
      openaiKey: context.env.OPENAI_API_KEY,
      messages,
      verbConfig: effectiveConfig,
      system,
      writer,
      encoder,
      db,
      licenseKey,
      reserve,
      requestId,
      isTrial,
      balanceAfterReserve,
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
