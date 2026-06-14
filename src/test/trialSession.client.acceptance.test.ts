// @vitest-environment jsdom
/**
 * Orchestrator-owned acceptance test — Wave 39 Phase 3: app-side trial-session client.
 *
 * The implementer may NOT modify this file. It pins the app↔worker boundary the trial
 * path consumes: acquireTrialSession() must POST to /api/ai/trial-session with the right
 * body (empty for first-grant, { trialKey } for re-exchange) and surface the parsed result,
 * throwing on a non-ok response so the caller can fall back to a fresh first-grant.
 *
 * (The rendered meter + exhaustion behavior is validated by the Phase 4 CDP smoke — the
 * project oracle — not jsdom; green vitest here is necessary, not sufficient.)
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { acquireTrialSession } from "../features/ai/ai.client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("acquireTrialSession — trial-session boundary consumer", () => {
  it("first grant: POSTs to /api/ai/trial-session with an empty body; returns the parsed result", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_abc", token: "payload.sig", expiresAt: 999, allowance: 150000 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await acquireTrialSession();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/ai\/trial-session$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({});
    expect(res.trialKey).toBe("trial_abc");
    expect(res.token).toBe("payload.sig");
    expect(res.allowance).toBe(150000);
  });

  it("re-exchange: POSTs with { trialKey } when a stored key is provided", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_abc", token: "payload.sig", expiresAt: 999 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await acquireTrialSession("trial_abc");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ trialKey: "trial_abc" });
  });

  it("throws on a non-ok response so the caller can clear the stale key and re-grant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(acquireTrialSession("trial_stale")).rejects.toThrow();
  });
});
