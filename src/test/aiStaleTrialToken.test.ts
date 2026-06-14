/**
 * aiStaleTrialToken.test.ts — Wave 39 Fix C regression.
 *
 * Contract: once a real subscription is active (aiLicenseKey non-empty),
 * acquireAnyToken MUST mint a SUBSCRIBER token via acquireSession — it must NOT
 * return a stale cached trial token even when that token is still fresh.
 * This is the owner-identity guard introduced in ai.trialToken.ts.
 *
 * Boundary mocks: settings.store (controls aiLicenseKey), fetch (network).
 * Subject under test: acquireAnyToken (NOT mocked).
 */
import type { MutableRefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionResult } from "../features/ai/ai.client";
import { acquireAnyToken } from "../features/ai/ai.trialToken";
import { getTweak } from "../features/settings/settings.store";

// Mock the settings boundary — lets each test control aiLicenseKey independently.
vi.mock("../features/settings/settings.store", () => ({
  getTweak: vi.fn(),
  setStoredTweak: vi.fn(),
}));

/** A ref holding a fresh trial token (valid for ~1 hour — still within TTL). */
function makeFreshTrialRef(): MutableRefObject<SessionResult | null> {
  return { current: { token: "trial-token-xyz", expiresAt: Date.now() + 3_600_000 } };
}

function stubSubscriberFetch(subscriberToken = "sub-token-abc"): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ token: subscriberToken, expiresAt: Date.now() + 3_600_000 }),
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  // Default: no license key (trial user) — individual tests override as needed.
  vi.mocked(getTweak).mockImplementation((_key, fallback) => fallback as string);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("Fix C — acquireAnyToken: stale trial token discarded on subscription activation", () => {
  it("returns a subscriber token (not the cached trial token) when aiLicenseKey becomes set mid-session", async () => {
    const ref = makeFreshTrialRef(); // fresh trial token in ref
    // Subscription activated: aiLicenseKey now non-empty
    vi.mocked(getTweak).mockImplementation((key, fallback) =>
      key === "aiLicenseKey" ? "lk-sub-abc" : (fallback as string),
    );
    stubSubscriberFetch("sub-token-abc");

    const token = await acquireAnyToken(ref);

    expect(token).toBe("sub-token-abc");
  });

  it("calls /api/ai/session (not /api/ai/trial-session) when aiLicenseKey is set, ref holds a stale trial token", async () => {
    const ref = makeFreshTrialRef();
    vi.mocked(getTweak).mockImplementation((key, fallback) =>
      key === "aiLicenseKey" ? "lk-sub-abc" : (fallback as string),
    );
    const fetchSpy = stubSubscriberFetch();

    await acquireAnyToken(ref);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/ai\/session$/);
    expect(String(url)).not.toMatch(/trial/);
  });

  it("returns the fresh cached trial token (no fetch) when aiLicenseKey is empty and the ref is still fresh", async () => {
    const ref = makeFreshTrialRef();
    // aiLicenseKey is empty — trial path; ref is fresh so no network call needed
    vi.mocked(getTweak).mockImplementation((_key, fallback) => fallback as string);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const token = await acquireAnyToken(ref);

    expect(token).toBe("trial-token-xyz");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Finding 2a — subscriber cache-hit: _refOwnerLk.set(ref, lk) must be exercised", () => {
  it("returns the cached subscriber token (no second fetch) when aiLicenseKey matches the ref owner", async () => {
    // Proves _refOwnerLk.set(ref, lk) at ai.trialToken.ts is load-bearing:
    // removing that line makes prevLk = null ≠ lk, forcing a redundant re-fetch on the second call.
    const ref: MutableRefObject<SessionResult | null> = { current: null };
    vi.mocked(getTweak).mockImplementation((key, fallback) =>
      key === "aiLicenseKey" ? "lk-sub-abc" : (fallback as string),
    );
    const fetchSpy = stubSubscriberFetch("sub-token-abc");

    // First call: cold — must fetch and store in ref + _refOwnerLk.
    const first = await acquireAnyToken(ref);
    expect(first).toBe("sub-token-abc");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call: same ref, same lk — must be a cache hit with NO new fetch.
    const second = await acquireAnyToken(ref);
    expect(second).toBe("sub-token-abc");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // still 1 — subscriber token reused
  });
});

describe("Finding 2b — reverse-transition (subscriber→trial): fresh subscriber token must NOT be reused", () => {
  it("mints a fresh trial token (hits /api/ai/trial-session) when aiLicenseKey is cleared after a subscriber session", async () => {
    // Proves the Finding 1 reverse-transition guard: before the fix, acquireTrialTokenCached would
    // see isFresh(ref)=true and return the subscriber token; after the fix, ref is nulled first.
    const ref: MutableRefObject<SessionResult | null> = { current: null };

    // Step 1 — populate ref via subscriber path so _refOwnerLk["ref"] = "lk-sub-abc".
    vi.mocked(getTweak).mockImplementation((key, fallback) =>
      key === "aiLicenseKey" ? "lk-sub-abc" : (fallback as string),
    );
    stubSubscriberFetch("sub-token-abc");
    await acquireAnyToken(ref);
    // ref.current is now a fresh subscriber token.

    // Step 2 — clear the license key (simulates the "Change license key" button).
    vi.mocked(getTweak).mockImplementation((_key, fallback) => fallback as string);
    const trialFetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "trial-token-fresh", expiresAt: Date.now() + 3_600_000 }),
    });
    vi.stubGlobal("fetch", trialFetchSpy);

    const token = await acquireAnyToken(ref);

    expect(token).toBe("trial-token-fresh");
    expect(trialFetchSpy).toHaveBeenCalledTimes(1);
    const [url] = trialFetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toMatch(/\/api\/ai\/trial-session$/);
    expect(String(url)).not.toMatch(/\/api\/ai\/session$/); // NOT the subscriber endpoint
  });
});
