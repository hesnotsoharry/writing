import { describe, expect, it, vi } from "vitest";
import { onRequest } from "./health";

// ---------------------------------------------------------------------------
// Mock @supabase/supabase-js at the boundary.
// createClient is a vi.fn() so individual tests can override it via
// mockReturnValueOnce without touching the default happy-path stub.
// ---------------------------------------------------------------------------

const CANNED_ROW = { id: 42, note: "heartbeat", created_at: "2026-06-04T12:00:00Z" };

/** Builds a chainable Supabase query stub that resolves to `result` on `.single()`. */
function makeQueryStub(result: { data: unknown; error: null | { message: string } }) {
  const chain: Record<string, () => unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get: (_t, prop) => {
      if (prop === "single") return () => Promise.resolve(result);
      return () => proxy;
    },
  });
  return proxy;
}

/** Default happy-path client: every query returns CANNED_ROW. */
function makeHappyClient() {
  return { from: () => makeQueryStub({ data: CANNED_ROW, error: null }) };
}

const mockCreateClient = vi.fn(makeHappyClient);

vi.mock("@supabase/supabase-js", () => ({
  createClient: (..._args: unknown[]) => mockCreateClient(),
}));

// ---------------------------------------------------------------------------
// Fake EventContext shape — only the fields health.ts accesses (env).
// ---------------------------------------------------------------------------
function fakeContext() {
  return {
    env: {
      SUPABASE_URL: "https://placeholder.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role",
      SUPABASE_ANON_KEY: "placeholder-anon",
      LEMON_SQUEEZY_SIGNING_SECRET: "placeholder-ls",
    },
    request: new Request("https://placeholder.pages.dev/api/health"),
  } as unknown as Parameters<typeof onRequest>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("health handler write→read→respond wiring", () => {
  it("returns 200 with ok:true and readBack matching the inserted row", async () => {
    const response = await onRequest(fakeContext());

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      ok: boolean;
      wrote: number;
      readBack: typeof CANNED_ROW;
    };

    expect(body.ok).toBe(true);
    expect(body.wrote).toBe(CANNED_ROW.id);
    expect(body.readBack).toEqual(CANNED_ROW);
  });

  it("returns 500 with ok:false when the insert errors", async () => {
    mockCreateClient.mockReturnValueOnce({
      from: () =>
        makeQueryStub({ data: null, error: { message: "insert failed" } }),
    } as unknown as ReturnType<typeof makeHappyClient>);

    const response = await onRequest(fakeContext());

    expect(response.status).toBe(500);
    const body = (await response.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe("insert failed");
  });
});
