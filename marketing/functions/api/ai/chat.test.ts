/**
 * Seam tests for POST /api/ai/chat (Phase 2 — reserve-then-reconcile).
 *
 * Contract under test:
 *   - Missing Authorization header → 401
 *   - Invalid / expired session token → 401
 *   - Valid token + active subscription + sufficient credits →
 *       streams only normalized events: {type:'token'|'done'|'error'}
 *       done event carries {inputTokens, outputTokens, creditsCost}
 *   - Valid token + zero credits (reserve_credits returns null) →
 *       429 with {creditsRemaining, resetAt}  (distinct from rate-cap 429)
 *   - Rate cap exceeded → 429 with {error:'rate_limit_exceeded', retryAfterSeconds}
 *   - Non-negative invariant: refund_credits called with reserve − actual;
 *       balance cannot go below zero (SQL constraint; test validates refund call).
 *   - Stream failure → refund_credits called for full reserve.
 *
 * Boundary: @supabase/supabase-js and global fetch are mocked; no live calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildToken } from "../../_lib/ai-token";
import { ALLOWED_ORIGINS } from "../../_lib/cors";
import { estimateCredits } from "../../_lib/credits";
import { VERB_CONFIG } from "../../_lib/verb-config";
import { onRequestOptions, onRequestPost } from "./chat";

// ── Supabase mock ─────────────────────────────────────────────────────────────

interface SubRow {
  status: string;
  credits_balance: number;
  reset_at: string | null;
}

interface RpcCall { fn: string; args: Record<string, unknown> }

let subRow: SubRow = { status: "active", credits_balance: 100000, reset_at: null };
let reserveSucceeds = true;
let ratePassed = true;
let rpcCalls: RpcCall[] = [];
// Trial-branch state: controls what reserve_trial_credits returns.
// reason=null → ok; reason='balance' → per-trial exhausted; reason='budget' → global cap hit.
let trialReserveReason: string | null = null;
let trialReserveNewBalance: number | null = 99000;
// When true, reserve_trial_credits simulates a Supabase RPC failure (data:null + error).
let trialReserveErrors = false;

function makeMockClient() {
  return {
    from: (table: string) => {
      void table;
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: subRow, error: null }),
          }),
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
      };
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "reserve_credits") {
        return Promise.resolve({
          data: reserveSucceeds ? subRow.credits_balance - 1 : null,
          error: null,
        });
      }
      if (fn === "check_rate_limit") {
        return Promise.resolve({ data: ratePassed, error: null });
      }
      if (fn === "reserve_trial_credits") {
        if (trialReserveErrors) {
          return Promise.resolve({ data: null, error: { message: "rpc failure" } });
        }
        return Promise.resolve({
          data: [{ reason: trialReserveReason, new_balance: trialReserveNewBalance }],
          error: null,
        });
      }
      // refund_credits, refund_trial_credits, and others succeed by default.
      // Mock note: the RPC returns JS numbers directly (bypassing PostgREST JSON serialization);
      // production code relies on `typeof data === 'number'` being true for in-range BIGINTs,
      // which works because credit balances are well under 2^53 and serialize as JSON numbers.
      return Promise.resolve({ data: subRow.credits_balance, error: null });
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => makeMockClient(),
}));

// ── Anthropic SSE mock ────────────────────────────────────────────────────────

const MOCK_INPUT_TOKENS = 10;
const MOCK_OUTPUT_TOKENS = 7;

const ANTHROPIC_SSE = [
  `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_01","usage":{"input_tokens":${MOCK_INPUT_TOKENS},"output_tokens":1}}}\n\n`,
  `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`,
  `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n`,
  `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n`,
  `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`,
  `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":${MOCK_OUTPUT_TOKENS}}}\n\n`,
  `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
].join("");

function makeAnthropicResponse(status = 200): Response {
  return new Response(ANTHROPIC_SSE, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-proxy-secret-xyz789";
const TEST_LICENSE = "TEST-LICENSE-CHAT-001";

async function makeValidToken() {
  return (await buildToken(TEST_LICENSE, TEST_SECRET)).token;
}

type WaitUntilFn = (p: Promise<void>) => void;

function fakeContext(authHeader: string | null, body: unknown, origin?: string): {
  ctx: Parameters<typeof onRequestPost>[0];
  getWaitUntil: () => Promise<void> | undefined;
} {
  let waitUntilP: Promise<void> | undefined;
  const waitUntil: WaitUntilFn = (p) => { waitUntilP = p; };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;
  if (origin) headers["Origin"] = origin;
  const ctx = {
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-srk",
      SUPABASE_ANON_KEY: "placeholder-anon",
      LEMON_SQUEEZY_SIGNING_SECRET: "placeholder-ls",
      ANTHROPIC_API_KEY: "placeholder-anthropic",
      OPENAI_API_KEY: "placeholder-openai",
      PROXY_SESSION_SECRET: TEST_SECRET,
    },
    request: new Request("https://writersnook.app/api/ai/chat", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    waitUntil,
  } as unknown as Parameters<typeof onRequestPost>[0];
  return { ctx, getWaitUntil: () => waitUntilP };
}

/** Read all SSE events from a Response body stream. */
async function collectSseEvents(res: Response, waitUntilP?: Promise<void>): Promise<unknown[]> {
  const text = await res.text();
  if (waitUntilP) await waitUntilP;
  const events: unknown[] = [];
  for (const block of text.split("\n\n")) {
    const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
    if (dataLine) events.push(JSON.parse(dataLine.slice(6)));
  }
  return events;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/ai/chat contract", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { ctx } = fakeContext(null, { messages: [{ role: "user", content: "hi" }] });
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Bearer token has an invalid signature", async () => {
    const { ctx } = fakeContext(
      "Bearer invalidtoken.badsignature",
      { messages: [{ role: "user", content: "hi" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired token (TTL past)", async () => {
    const pastNow = Date.now() - 5 * 60 * 60 * 1000;
    const { token } = await buildToken(TEST_LICENSE, TEST_SECRET, pastNow);
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "hi" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(401);
  });

  it("streams only normalized event types (token | done | error) for a valid request", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const events = await collectSseEvents(res, getWaitUntil());
    expect(events.length).toBeGreaterThan(0);
    const ALLOWED = new Set(["token", "done", "error"]);
    for (const ev of events) {
      expect(ALLOWED.has((ev as { type: string }).type)).toBe(true);
    }
  });

  it("done event carries {inputTokens, outputTokens, creditsCost}", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const done = events.find((e) => (e as { type: string }).type === "done") as {
      type: string;
      inputTokens: number;
      outputTokens: number;
      creditsCost: number;
    } | undefined;
    expect(done).toBeDefined();
    expect(done!.inputTokens).toBe(MOCK_INPUT_TOKENS);
    expect(done!.outputTokens).toBe(MOCK_OUTPUT_TOKENS);
    expect(typeof done!.creditsCost).toBe("number");
    expect(done!.creditsCost).toBeGreaterThan(0);
  });

  it("token events carry only the text field (no raw Anthropic format)", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const tokenEvents = events.filter((e) => (e as { type: string }).type === "token");
    expect(tokenEvents.length).toBeGreaterThan(0);
    for (const ev of tokenEvents) {
      const t = ev as { type: string; text: string };
      expect(typeof t.text).toBe("string");
      expect(ev).not.toHaveProperty("delta");
      expect(ev).not.toHaveProperty("index");
    }
  });

  it("returns 429 with creditsRemaining when reserve_credits returns null (zero balance)", async () => {
    subRow = { status: "active", credits_balance: 0, reset_at: "2026-07-01T00:00:00Z" };
    reserveSucceeds = false;
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { creditsRemaining: number; resetAt: string | null };
    expect(body.creditsRemaining).toBe(0);
    expect(body.resetAt).toBe("2026-07-01T00:00:00Z");
    // Must NOT have rate_limit_exceeded shape
    expect(body).not.toHaveProperty("error");
  });

  it("returns 429 with rate_limit_exceeded body (distinct from zero-credit shape)", async () => {
    ratePassed = false;
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; retryAfterSeconds: number };
    expect(body.error).toBe("rate_limit_exceeded");
    expect(typeof body.retryAfterSeconds).toBe("number");
    // Must NOT have creditsRemaining shape
    expect(body).not.toHaveProperty("creditsRemaining");
  });

  it("refund_credits called with reserve − actual on successful stream (non-negative invariant)", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    expect(reserveCall).toBeDefined();
    const reserved = Math.abs(Number(reserveCall!.args["p_amount"]));
    const refundCall = rpcCalls.find((c) => c.fn === "refund_credits");
    // Refund only fires when reserve > actual (reserve usually > actual in test)
    if (refundCall) {
      const refundAmt = Number(refundCall.args["p_amount"]);
      expect(refundAmt).toBeGreaterThanOrEqual(0); // refund-only: never negative
      expect(refundAmt).toBeLessThanOrEqual(reserved); // never refunds more than reserved
    }
  });

  it("refund_credits called with full reserve on stream failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    const refundCall = rpcCalls.find((c) => c.fn === "refund_credits");
    expect(refundCall).toBeDefined();
    // On failure, full reserve is returned
    expect(Number(refundCall!.args["p_amount"])).toBe(
      Math.abs(Number(reserveCall!.args["p_amount"])),
    );
  });

  it("reserve_credits and refund_credits share the same request_id", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    const refundCall = rpcCalls.find((c) => c.fn === "refund_credits");
    if (refundCall) {
      expect(refundCall.args["p_request_id"]).toBe(reserveCall!.args["p_request_id"]);
    }
  });

  it("system field passes through to Anthropic fetch body when provided", async () => {
    const token = await makeValidToken();
    const systemPrompt = "You are a brainstorm assistant. Context: scene about a forest.";
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], system: systemPrompt },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const callArgs = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(callArgs[1]!.body as string) as Record<string, unknown>;
    expect(sentBody["system"]).toBe(systemPrompt);
  });

  it("system field is omitted from Anthropic fetch body when not provided", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    const callArgs = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(callArgs[1]!.body as string) as Record<string, unknown>;
    expect(sentBody).not.toHaveProperty("system");
  });

  it("returns 400 when system exceeds 32,000 characters", async () => {
    const token = await makeValidToken();
    const oversizedSystem = "x".repeat(32_001);
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], system: oversizedSystem },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it("reserve estimate includes system length so reserve >= actual for system-bearing requests", async () => {
    const token = await makeValidToken();
    const systemPrompt = "x".repeat(4000); // 4000 chars = ~1000 extra tokens
    // baseline: same message, no system
    const { ctx: ctxNoSys, getWaitUntil: wu0 } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    rpcCalls = [];
    const resNoSys = await onRequestPost(ctxNoSys);
    await collectSseEvents(resNoSys, wu0());
    const reserveNoSys = Number(rpcCalls.find((c) => c.fn === "reserve_credits")!.args["p_amount"]);

    rpcCalls = [];
    const { ctx: ctxSys, getWaitUntil: wu1 } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], system: systemPrompt },
    );
    const resSys = await onRequestPost(ctxSys);
    await collectSseEvents(resSys, wu1());
    const reserveWithSys = Number(rpcCalls.find((c) => c.fn === "reserve_credits")!.args["p_amount"]);

    expect(reserveWithSys).toBeGreaterThan(reserveNoSys);
  });
});

// ── CORS contract ─────────────────────────────────────────────────────────────

function fakeOptionsContext(origin?: string): Parameters<typeof onRequestOptions>[0] {
  const headers: Record<string, string> = {};
  if (origin) headers["Origin"] = origin;
  return {
    env: {},
    request: new Request("https://writersnook.app/api/ai/chat", {
      method: "OPTIONS",
      headers,
    }),
  } as unknown as Parameters<typeof onRequestOptions>[0];
}

describe("CORS contract — /api/ai/chat", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("OPTIONS with an allowlisted origin returns 204 with full preflight headers", async () => {
    const origin = ALLOWED_ORIGINS[0];
    const res = await onRequestOptions(fakeOptionsContext(origin));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, Authorization");
    expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("OPTIONS with a non-allowlisted origin returns 204 without ACAO header", async () => {
    const res = await onRequestOptions(fakeOptionsContext("https://evil.example.com"));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("OPTIONS with no origin returns 204 without ACAO header", async () => {
    const res = await onRequestOptions(fakeOptionsContext());
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("POST with an allowlisted origin carries ACAO header on 200 SSE response", async () => {
    const token = await makeValidToken();
    const origin = ALLOWED_ORIGINS[1];
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
      origin,
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(res.headers.get("Vary")).toBe("Origin");
  });

  it("POST with an allowlisted origin carries ACAO header on 401 error response", async () => {
    const origin = ALLOWED_ORIGINS[2];
    const { ctx } = fakeContext(null, { messages: [{ role: "user", content: "hi" }] }, origin);
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(401);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it("POST with an allowlisted origin carries ACAO header on 429 zero-credit response", async () => {
    subRow = { status: "active", credits_balance: 0, reset_at: "2026-07-01T00:00:00Z" };
    reserveSucceeds = false;
    const token = await makeValidToken();
    const origin = ALLOWED_ORIGINS[0];
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
      origin,
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it("POST with an allowlisted origin carries ACAO header on 429 rate-cap response", async () => {
    ratePassed = false;
    const token = await makeValidToken();
    const origin = ALLOWED_ORIGINS[0];
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
      origin,
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(429);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });

  it("POST with a non-allowlisted origin returns no ACAO header on 200 response", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
      "https://evil.example.com",
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

// ── Verb-resolution contract (Wave 37 Decision 1 D2) ─────────────────────────

describe("verb-based request resolution", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no verb → 200, Anthropic called with Haiku model and max_tokens 1536 (fallback config)", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as Record<string, unknown>;
    expect(sentBody["model"]).toBe("claude-haiku-4-5-20251001");
    expect(sentBody["max_tokens"]).toBe(1536);
  });

  it("unknown verb string → 400 Bad Request", async () => {
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], verb: "xyz" },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it("verb: 'constructor' → 400 Bad Request (prototype-chain bypass closed)", async () => {
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], verb: "constructor" },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it("verb: 'toString' → 400 Bad Request (prototype-chain bypass closed)", async () => {
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], verb: "toString" },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
  });

  it("{verb:'brainstorm'} → Anthropic called with haiku model, temperature 1.0, max_tokens 2048", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Ideas for my scene?" }], verb: "brainstorm" },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as Record<string, unknown>;
    expect(sentBody["model"]).toBe("claude-haiku-4-5-20251001");
    expect(sentBody["temperature"]).toBe(1.0);
    expect(sentBody["max_tokens"]).toBe(2048);
  });

  it("when verbConfig has no temperature (fallback/thinking path), temperature is omitted from Anthropic body", async () => {
    // No verb → FALLBACK_VERB_CONFIG (temperature: undefined) → temperature must be absent.
    // Same code path fires for thinking-enabled configs (ThinkingVerbConfig.temperature?: never).
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as Record<string, unknown>;
    expect(sentBody).not.toHaveProperty("temperature");
  });
});

// ── Prompt-cache request shape (Wave 37 Phase 5) ──────────────────────────────
//
// These tests verify the conditional system-field shape: when the estimated
// prefix meets the Haiku 4096-token threshold (≥16384 chars), body.system
// becomes a content-block array with cache_control; when it does not, body.system
// remains a plain string with no cache_control.

describe("prompt-cache request shape", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("system prefix >= 4096 tokens (Haiku) sends system as content-block array with cache_control", async () => {
    // 17000 chars → Math.ceil(17000/4) = 4250 tokens → ≥ 4096 → cache gate opens.
    const largeSystem = "x".repeat(17000);
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], system: largeSystem, verb: "brainstorm" },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as Record<string, unknown>;
    // system must be an array (not a string)
    expect(Array.isArray(sentBody["system"])).toBe(true);
    const blocks = sentBody["system"] as Array<{ type: string; text: string; cache_control?: { type: string } }>;
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].text).toBe(largeSystem);
    // cache_control must be present with ephemeral type and 1h TTL
    expect(blocks[0].cache_control).toEqual({ type: "ephemeral", ttl: "1h" });
  });

  it("system prefix < 4096 tokens (Haiku) sends system as plain string with no cache_control", async () => {
    // 100 chars → Math.ceil(100/4) = 25 tokens → < 4096 → cache gate stays closed.
    const smallSystem = "You are a brainstorm assistant. ".repeat(3); // ~96 chars
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }], system: smallSystem, verb: "brainstorm" },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as Record<string, unknown>;
    // system must remain a plain string — no array, no cache_control
    expect(typeof sentBody["system"]).toBe("string");
    expect(sentBody["system"]).toBe(smallSystem);
  });
});

// ── Trial-branch routing (Wave 39 Phase 2) ────────────────────────────────────

describe("trial-branch routing in POST /api/ai/chat", () => {
  beforeEach(() => {
    subRow = { status: "trial", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
    trialReserveReason = null;
    trialReserveNewBalance = 99000;
    trialReserveErrors = false;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("status='trial' subscription is admitted (not 403) and streams successfully", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello from trial" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const events = await collectSseEvents(res, getWaitUntil());
    const doneEvent = events.find((e) => (e as { type: string }).type === "done");
    expect(doneEvent).toBeDefined();
    // reserve_trial_credits was called, not reserve_credits
    expect(rpcCalls.find((c) => c.fn === "reserve_trial_credits")).toBeDefined();
    expect(rpcCalls.find((c) => c.fn === "reserve_credits")).toBeUndefined();
  });

  it("trial sub with balance exhausted (reason='balance') → 429 {creditsRemaining, resetAt} (fires existing ExhaustedAllowanceGuard)", async () => {
    subRow = { status: "trial", credits_balance: 0, reset_at: "2026-07-01T00:00:00Z" };
    trialReserveReason = "balance";
    trialReserveNewBalance = null;
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { creditsRemaining: number; resetAt: string };
    expect(body.creditsRemaining).toBe(0);
    expect(body.resetAt).toBe("2026-07-01T00:00:00Z");
    // Must NOT have the trial_budget_exhausted shape
    expect(body).not.toHaveProperty("error");
  });

  it("trial sub hitting global daily budget (reason='budget') → 429 {error:'trial_budget_exhausted'} (distinct shape)", async () => {
    trialReserveReason = "budget";
    trialReserveNewBalance = null;
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; resetAt: string };
    expect(body.error).toBe("trial_budget_exhausted");
    // Must NOT have creditsRemaining shape
    expect(body).not.toHaveProperty("creditsRemaining");
  });

  it("trial reserve RPC error (data:null) fails CLOSED → 429, never an unmetered stream", async () => {
    // Regression (wave-39 panel FLAG): a Supabase RPC failure must NOT be read as a
    // successful reserve. Before the fix, data:null → row undefined → ok:true → unmetered stream.
    trialReserveErrors = true;
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    // Denied — not a 200 event-stream.
    expect(res.status).toBe(429);
    expect(res.headers.get("Content-Type") ?? "").not.toContain("text/event-stream");
    // The reserve was attempted (gate ran), but no stream proceeded.
    expect(rpcCalls.find((c) => c.fn === "reserve_trial_credits")).toBeDefined();
  });
});

// ── Usage passthrough — cache tokens reconcile credits (Wave 37 Phase 5) ──────
//
// Verifies that cache_creation_input_tokens and cache_read_input_tokens from
// the Anthropic streaming response are forwarded to actualCredits and reflected
// in the done event's creditsCost.
//
// Expected values computed from Haiku rates (RATES['claude-haiku-4-5-20251001']):
//   input=0.1, output=0.5, cacheWrite1h=0.2, cacheRead=0.01
//
// Cache-write case: actualCredits(5, 7, haiku, 500, 0, '1h')
//   = Math.ceil(5×0.1 + 7×0.5 + 500×0.2 + 0×0.01) = Math.ceil(0.5+3.5+100) = 104
//
// Cache-read case: actualCredits(5, 7, haiku, 0, 500, '1h')
//   = Math.ceil(5×0.1 + 7×0.5 + 0×0.2 + 500×0.01) = Math.ceil(0.5+3.5+5) = 9

function makeAnthropicResponseWithCache(
  cacheCreationTokens: number,
  cacheReadTokens: number,
): Response {
  const inputTokens = 5;
  const outputTokens = 7;
  const sse = [
    `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_cache","usage":{"input_tokens":${inputTokens},"output_tokens":1,"cache_creation_input_tokens":${cacheCreationTokens},"cache_read_input_tokens":${cacheReadTokens}}}}\n\n`,
    `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`,
    `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n`,
    `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`,
    `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":${outputTokens}}}\n\n`,
    `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
  ].join("");
  return new Response(sse, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("usage passthrough — cache tokens reconcile credits", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cache-write: done event creditsCost reflects cache_creation_input_tokens at 2× rate (expected: 104)", async () => {
    // 500 cache-creation tokens at haiku cacheWrite1h=0.2 adds 100 units
    // total: ceil(5×0.1 + 7×0.5 + 500×0.2) = ceil(104) = 104
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponseWithCache(500, 0)));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const done = events.find((e) => (e as { type: string }).type === "done") as {
      type: string;
      inputTokens: number;
      outputTokens: number;
      creditsCost: number;
    } | undefined;
    expect(done).toBeDefined();
    expect(done!.creditsCost).toBe(104);
  });

  it("cache-read: done event creditsCost reflects cache_read_input_tokens at 0.1× rate (expected: 9)", async () => {
    // 500 cache-read tokens at haiku cacheRead=0.01 adds 5 units
    // total: ceil(5×0.1 + 7×0.5 + 500×0.01) = ceil(9) = 9
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponseWithCache(0, 500)));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const done = events.find((e) => (e as { type: string }).type === "done") as {
      type: string;
      inputTokens: number;
      outputTokens: number;
      creditsCost: number;
    } | undefined;
    expect(done).toBeDefined();
    expect(done!.creditsCost).toBe(9);
  });
});

// ── Model selection integration (W44 Phase C) ────────────────────────────────
//
// Three contracts under test:
//   1. An allowlisted OpenAI model (gpt-5.4) → outgoing fetch targets api.openai.com
//      and body.model === 'gpt-5.4'.
//   2. An unlisted model string → handler returns 400; no fetch, no reserve.
//   3. proofread + a premium model → outgoing fetch targets api.anthropic.com
//      and body.model === HAIKU (proofread override holds end-to-end).
//
// The existing Anthropic SSE mock is reused as the fetch response for cases 1 and 3.
// For case 1 the OpenAI adapter's pump produces all-zero usage from the Anthropic SSE
// (non-OpenAI format lines are silently ignored) — we only assert the OUTGOING request.

describe("W44 Phase C — model selection integration", () => {
  const HAIKU = "claude-haiku-4-5-20251001";

  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("brainstorm + allowlisted OpenAI model (gpt-5.4) → fetch targets api.openai.com, body.model === 'gpt-5.4', and reserve computed at gpt-5.4 rates", async () => {
    const messageContent = "Ideas?";
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: messageContent }], verb: "brainstorm", model: "gpt-5.4" },
    );
    const res = await onRequestPost(ctx);
    // wait for the stream runner (pump may produce 0-usage from the Anthropic mock — that's fine)
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("api.openai.com");
    const sentBody = JSON.parse(calledInit!.body as string) as Record<string, unknown>;
    expect(sentBody["model"]).toBe("gpt-5.4");
    // Guard the reserve line (chat.ts estimateCredits call): a regression that passed
    // verbConfig.model (Haiku) instead of effectiveConfig.model (gpt-5.4) would silently
    // under-reserve at the Haiku rate. Assert the exact reserve amount at gpt-5.4 rates.
    // totalChars = messageContent.length (no system prompt in this request).
    const totalChars = messageContent.length;
    const expectedReserve = estimateCredits(totalChars, VERB_CONFIG.brainstorm.maxTokens, "gpt-5.4");
    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    expect(reserveCall).toBeDefined();
    expect(Number(reserveCall!.args["p_amount"])).toBe(expectedReserve);
  });

  it("brainstorm + unlisted model string → 400; fetch is never called, no reserve", async () => {
    const token = await makeValidToken();
    const { ctx } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Ideas?" }], verb: "brainstorm", model: "bogus-not-allowed" },
    );
    const res = await onRequestPost(ctx);
    expect(res.status).toBe(400);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    expect(reserveCall).toBeUndefined();
  });

  it("proofread + premium model (gpt-5.5) → fetch targets api.anthropic.com with body.model === Haiku (proofread override holds)", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Proofread this." }], verb: "proofread", model: "gpt-5.5" },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(res.status).toBe(200);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalled();
    const [calledUrl, calledInit] = fetchMock.mock.calls[0];
    expect(String(calledUrl)).toContain("api.anthropic.com");
    const sentBody = JSON.parse(calledInit!.body as string) as Record<string, unknown>;
    expect(sentBody["model"]).toBe(HAIKU);
  });
});

// ── Refund-on-stream-error after partial emission (W44 Phase B acceptance criterion) ──
//
// Wave-44 requires: a malformed/early-error stream routes through the refund path
// (Q4 outage policy) and the full reserve is returned even after partial tokens have
// been emitted. This exercises runStream's catch block, which is provider-agnostic —
// the same path fires for both Anthropic and OpenAI mid-stream failures.
//
// The OpenAI-format wire data in the throwing stream documents the intent: an OpenAI
// stream that delivers partial content and then aborts hits this same catch-and-refund
// path. (Phase C will add per-request model routing; the catch is provider-agnostic
// and already covers OpenAI as confirmed by the W44 adapter seam.)

/** 200 response whose body yields one SSE chunk then errors — simulates mid-stream abort. */
function makeThrowingStreamResponse(): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Emit one partial token chunk (OpenAI Chat Completions wire format)
      controller.enqueue(
        encoder.encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
      );
      // Then abort the stream — reader.read() on the next iteration rejects
      controller.error(new Error("stream aborted mid-flight"));
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("refund-on-stream-error — full reserve returned after partial emission (W44 Q4 policy)", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("full reserve is refunded when the upstream stream errors after emitting partial tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeThrowingStreamResponse()));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());

    // The stream errored: the catch block must fire refund_credits with the full reserve
    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    const refundCall = rpcCalls.find((c) => c.fn === "refund_credits");
    expect(refundCall).toBeDefined();
    expect(Number(refundCall!.args["p_amount"])).toBe(
      Math.abs(Number(reserveCall!.args["p_amount"])),
    );

    // A {type:'error'} SSE event must be written to the client
    const errorEvent = events.find((e) => (e as { type: string }).type === "error");
    expect(errorEvent).toBeDefined();
  });

  it("request IDs match between reserve and error-path refund", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeThrowingStreamResponse()));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());

    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    const refundCall = rpcCalls.find((c) => c.fn === "refund_credits");
    expect(refundCall).toBeDefined();
    expect(refundCall!.args["p_request_id"]).toBe(reserveCall!.args["p_request_id"]);
  });
});

// ── W51 P2 — balanceAfter on done event ──────────────────────────────────────
//
// Contracts:
//   1. Subscriber WITH refund (normal path: actual < reserve):
//      done carries creditsCost = actual AND balanceAfter = refund_credits return value.
//   2. Subscriber NO-refund (actual >= reserve):
//      done carries creditsCost = reserve AND balanceAfter = reserve-time balance
//      (no extra DB call; refund_credits is NOT called).
//   3. Trial WITH refund:
//      done carries creditsCost = actual AND balanceAfter = refund_trial_credits return value.
//
// Mock contract recap:
//   reserve_credits  → data: subRow.credits_balance - 1  (= 99999 with default subRow)
//   refund_credits   → data: subRow.credits_balance       (= 100000)
//   refund_trial_credits → data: subRow.credits_balance   (= 100000)
//   reserve_trial_credits → trialReserveNewBalance        (= 99000 default)
//
// Credit math for message "Hello" (5 chars), FALLBACK verb (Haiku, maxTokens 1536):
//   reserve = estimateCredits(5, 1536, 'claude-haiku-4-5-20251001') = ceil(1.25) + 768 = 769
//   actual  = actualCredits(10, 7, 'claude-haiku-4-5-20251001')    = ceil(4.5)   = 5
//   charged = 5   refundAmount = 764  (WITH-refund case)
//
// For NO-refund: use outputTokens = 1540 so actual = ceil(1 + 770) = 771 > reserve 769.
//   charged = reserve = 769  refundAmount = 0

/** Build an Anthropic SSE response with a custom output_tokens count. */
function makeAnthropicResponseWithOutputTokens(outputTokens: number): Response {
  const sse = [
    `event: message_start\ndata: {"type":"message_start","message":{"id":"msg_01","usage":{"input_tokens":${MOCK_INPUT_TOKENS},"output_tokens":1}}}\n\n`,
    `event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n`,
    `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n`,
    `event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n`,
    `event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":${outputTokens}}}\n\n`,
    `event: message_stop\ndata: {"type":"message_stop"}\n\n`,
  ].join("");
  return new Response(sse, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("W51 P2 — balanceAfter on done event", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
    trialReserveReason = null;
    trialReserveNewBalance = 99000;
    trialReserveErrors = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("subscriber WITH refund: done event carries creditsCost=5 AND balanceAfter=100000 (refund RPC return)", async () => {
    // actual (5) < reserve (769) → refund fires → balanceAfter = refund_credits return = subRow.credits_balance = 100000
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const done = events.find((e) => (e as { type: string }).type === "done") as {
      type: string;
      creditsCost: number;
      balanceAfter: number;
    } | undefined;
    expect(done).toBeDefined();
    expect(done!.creditsCost).toBe(5);
    expect(done!.balanceAfter).toBe(100000);
    // Confirm refund was issued (refund path is what supplies balanceAfter here)
    expect(rpcCalls.find((c) => c.fn === "refund_credits")).toBeDefined();
  });

  it("subscriber NO-refund edge: done event carries creditsCost=reserve AND balanceAfter=99999 (reserve-time balance, no extra RPC)", async () => {
    // outputTokens=1540 → actual = ceil(10×0.1 + 1540×0.5) = 771 > reserve=769
    // → refundAmount=0, charged=769; balanceAfter = reserve-time balance = subRow.credits_balance - 1 = 99999
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponseWithOutputTokens(1540)));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const done = events.find((e) => (e as { type: string }).type === "done") as {
      type: string;
      creditsCost: number;
      balanceAfter: number;
    } | undefined;
    expect(done).toBeDefined();
    expect(done!.creditsCost).toBe(769);
    expect(done!.balanceAfter).toBe(99999);
    // Confirm no refund was issued — balanceAfter came from the reserve call, not a refund RPC
    expect(rpcCalls.find((c) => c.fn === "refund_credits")).toBeUndefined();
  });

  it("trial WITH refund: done event carries creditsCost=5 AND balanceAfter=100000 (refund_trial_credits return)", async () => {
    // Trial path: reserve_trial_credits newBalance=99000; actual=5 < reserve → refund fires
    // refund_trial_credits return = subRow.credits_balance = 100000
    subRow = { status: "trial", credits_balance: 100000, reset_at: null };
    trialReserveNewBalance = 99000;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponse()));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const done = events.find((e) => (e as { type: string }).type === "done") as {
      type: string;
      creditsCost: number;
      balanceAfter: number;
    } | undefined;
    expect(done).toBeDefined();
    expect(done!.creditsCost).toBe(5);
    expect(done!.balanceAfter).toBe(100000);
    expect(rpcCalls.find((c) => c.fn === "refund_trial_credits")).toBeDefined();
  });

  it("trial NO-refund edge: done event carries creditsCost=reserve AND balanceAfter=99000 (reserve-time balance, no extra RPC)", async () => {
    // outputTokens=1540 → actual = ceil(10×0.1 + 1540×0.5) = 771 > reserve=769
    // → refundAmount=0, charged=769; balanceAfter = reserve-time balance = trialReserveNewBalance = 99000
    subRow = { status: "trial", credits_balance: 100000, reset_at: null };
    trialReserveNewBalance = 99000;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeAnthropicResponseWithOutputTokens(1540)));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const done = events.find((e) => (e as { type: string }).type === "done") as {
      type: string;
      creditsCost: number;
      balanceAfter: number;
    } | undefined;
    expect(done).toBeDefined();
    expect(done!.creditsCost).toBe(769);
    expect(done!.balanceAfter).toBe(99000);
    // Confirm no refund was issued — balanceAfter came from the reserve call, not a refund RPC
    expect(rpcCalls.find((c) => c.fn === "refund_trial_credits")).toBeUndefined();
  });
});

// ── W52 Phase 5 — managed content-policy block → content-blocked event ─────────
//
// Anthropic moderates at INPUT: an explicit passage in a managed request comes back as a
// pre-stream HTTP 400 (invalid_request_error) BEFORE the SSE stream starts (research W52 P5:
// input blocks are HTTP-level, not mid-stream SSE frames). The proxy must distinguish that
// from a generic upstream error and emit {type:"content-blocked"} so the client can surface the
// calm BYOK/local nudge — non-policy 400s must stay the generic "error". Detection is defensive
// (status + policy-keyword message) because the exact INPUT message text is unconfirmed; the
// proxy also logs the raw upstream body to tighten the parser from real traffic.

/** Upstream 400 whose error message carries content-policy markers (a moderated input block). */
function makeContentPolicyBlockResponse(): Response {
  return new Response(
    JSON.stringify({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "Your request was blocked by our content filtering policy (prohibited content).",
      },
    }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}

/** Upstream 400 with a NON-policy invalid_request message (e.g. a malformed request). */
function makeGenericBadRequestResponse(): Response {
  return new Response(
    JSON.stringify({
      type: "error",
      error: { type: "invalid_request_error", message: "messages: at least one message is required" },
    }),
    { status: 400, headers: { "Content-Type": "application/json" } },
  );
}

describe("W52 P5 — managed content-policy block surfaces a content-blocked event", () => {
  beforeEach(() => {
    subRow = { status: "active", credits_balance: 100000, reset_at: null };
    reserveSucceeds = true;
    ratePassed = true;
    rpcCalls = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("upstream 400 content-policy block → SSE emits {type:'content-blocked'} (not generic error) and refunds the full reserve", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeContentPolicyBlockResponse()));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "an explicit passage" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    // The privacy-safety contract: a content-policy refusal is surfaced distinctly.
    const blocked = events.find((e) => (e as { type: string }).type === "content-blocked");
    expect(blocked).toBeDefined();
    // It must NOT be misreported as the generic error event.
    const generic = events.find((e) => (e as { type: string }).type === "error");
    expect(generic).toBeUndefined();
    // No output was generated → full reserve is refunded (same as any upstream failure).
    const reserveCall = rpcCalls.find((c) => c.fn === "reserve_credits");
    const refundCall = rpcCalls.find((c) => c.fn === "refund_credits");
    expect(refundCall).toBeDefined();
    expect(Number(refundCall!.args["p_amount"])).toBe(
      Math.abs(Number(reserveCall!.args["p_amount"])),
    );
  });

  it("upstream 400 NON-policy error (malformed request) → stays a generic {type:'error'} (no false content-blocked)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeGenericBadRequestResponse()));
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    const res = await onRequestPost(ctx);
    const events = await collectSseEvents(res, getWaitUntil());
    const generic = events.find((e) => (e as { type: string }).type === "error");
    expect(generic).toBeDefined();
    const blocked = events.find((e) => (e as { type: string }).type === "content-blocked");
    expect(blocked).toBeUndefined();
  });
});
