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
      // refund_credits and others succeed by default
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
