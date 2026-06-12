/**
 * Seam tests for POST /api/ai/chat.
 *
 * Contract under test:
 *   - Missing Authorization header → 401
 *   - Invalid / expired session token → 401
 *   - Valid token + active subscription + sufficient credits →
 *       streams only normalized events: {type:'token'|'done'|'error'}
 *       done event carries {inputTokens, outputTokens, creditsCost}
 *   - Valid token + zero credits → 429 with {creditsRemaining, resetAt}
 *   - credits_balance can never go negative (conditional decrement)
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

let subRow: SubRow = { status: "active", credits_balance: 100000, reset_at: null };
let decrementSucceeds = true;
let insertCalled = false;

function makeMockClient() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: subRow, error: null }),
        }),
      }),
      insert: () => {
        if (table === "credit_events") insertCalled = true;
        return Promise.resolve({ data: null, error: null });
      },
    }),
    // Mock for the atomic decrement_credits RPC (fix: TOCTOU double-spend).
    // Returns new balance (non-null) on success; null when credits insufficient.
    rpc: (fn: string) => {
      if (fn === "decrement_credits") {
        return Promise.resolve({
          data: decrementSucceeds ? subRow.credits_balance - 1 : null,
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
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
    decrementSucceeds = true;
    insertCalled = false;
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
    // Build a token with an already-expired timestamp
    const pastNow = Date.now() - 5 * 60 * 60 * 1000; // 5h ago
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
      // Must NOT contain Anthropic-specific fields
      expect(ev).not.toHaveProperty("delta");
      expect(ev).not.toHaveProperty("index");
    }
  });

  it("returns 429 with creditsRemaining when credits_balance is 0", async () => {
    subRow = { status: "active", credits_balance: 0, reset_at: "2026-07-01T00:00:00Z" };
    decrementSucceeds = false;
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
  });

  it("credit_events ledger insert is called after a successful stream", async () => {
    const token = await makeValidToken();
    const { ctx, getWaitUntil } = fakeContext(
      `Bearer ${token}`,
      { messages: [{ role: "user", content: "Hello" }] },
    );
    // Must consume the response body to unblock the TransformStream pump.
    const res = await onRequestPost(ctx);
    await collectSseEvents(res, getWaitUntil());
    expect(insertCalled).toBe(true);
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
    decrementSucceeds = true;
    insertCalled = false;
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

  it("POST with an allowlisted origin carries ACAO header on 429 response", async () => {
    subRow = { status: "active", credits_balance: 0, reset_at: "2026-07-01T00:00:00Z" };
    decrementSucceeds = false;
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
