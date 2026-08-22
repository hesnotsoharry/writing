// ============================================================================
// verifyTurnstileToken unit tests. Not orchestrator-owned — implementer-authored
// to cover the siteverify HTTP contract (Turnstile Phase 1 permissive rollout).
// ============================================================================
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstileToken } from "./turnstile";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(
    async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("verifyTurnstileToken", () => {
  it("POSTs form-encoded secret + response to the siteverify endpoint", async () => {
    await verifyTurnstileToken("tok-abc", "secret-xyz");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

    const params = new URLSearchParams(init.body);
    expect(params.get("secret")).toBe("secret-xyz");
    expect(params.get("response")).toBe("tok-abc");
    expect(params.has("remoteip")).toBe(false);
  });

  it("includes remoteip when an ip is supplied", async () => {
    await verifyTurnstileToken("tok-abc", "secret-xyz", "203.0.113.7");
    const params = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(params.get("remoteip")).toBe("203.0.113.7");
  });

  it("returns success:true and no errorCodes on a passing verification", async () => {
    const result = await verifyTurnstileToken("tok-abc", "secret-xyz");
    expect(result).toEqual({ success: true, errorCodes: undefined });
  });

  it("returns success:false with the error-codes list on a failing verification", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }),
        { status: 200 },
      ),
    );
    const result = await verifyTurnstileToken("tok-bad", "secret-xyz");
    expect(result.success).toBe(false);
    expect(result.errorCodes).toEqual(["invalid-input-response"]);
  });
});
