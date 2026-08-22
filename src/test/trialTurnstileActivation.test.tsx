// @vitest-environment jsdom
/**
 * trialTurnstileActivation.test.tsx — Turnstile Phase 2: the desktop
 * activation-card contract that trialSession.client.acceptance.test.ts (locked,
 * orchestrator-owned) doesn't cover — turnstileToken wiring on acquireTrialSession
 * and the TrialActivationCard's postMessage/timeout/error-surfacing seams.
 *
 * jsdom can't run a real cross-origin iframe or Turnstile — the card's iframe just
 * renders inert markup here; the challenge handshake is exercised by dispatching
 * synthetic MessageEvents, matching the precedent in trialWiring.test.tsx.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acquireTrialSession } from "../features/ai/ai.client";
import { runActivation, TrialActivationCard, useTurnstileChallenge } from "../features/ai/AssistantPanel.activation";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── acquireTrialSession(trialKey?, turnstileToken?) wire shape ────────────────

describe("acquireTrialSession — turnstileToken wiring (Phase 2)", () => {
  it("includes turnstileToken on a first grant when provided", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_x", token: "tok", expiresAt: 1 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await acquireTrialSession(undefined, "cf-token-123");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ turnstileToken: "cf-token-123" });
  });

  it("omits turnstileToken from the body when the widget was unavailable (undefined)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_x", token: "tok", expiresAt: 1 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await acquireTrialSession(undefined, undefined);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({});
  });

  it("never sends turnstileToken on re-exchange, even if a caller passes one", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_abc", token: "tok", expiresAt: 1 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await acquireTrialSession("trial_abc", "should-be-dropped");

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ trialKey: "trial_abc" });
  });

  it("surfaces the server's turnstile_failed error as a readable message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "turnstile_failed" }),
    }));

    await expect(acquireTrialSession(undefined, "bad-token")).rejects.toThrow("turnstile_failed");
  });

  it("surfaces the server's update_required message verbatim", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "update_required", message: "Please update WritersNook to activate the free trial." }),
    }));

    await expect(acquireTrialSession(undefined, undefined)).rejects.toThrow(
      "Please update WritersNook to activate the free trial.",
    );
  });
});

// ── useTurnstileChallenge — postMessage handshake + timeout ───────────────────

const ORIGIN = "https://writersnook.app";

describe("useTurnstileChallenge", () => {
  it("starts pending, then transitions to ready on a same-origin wn-turnstile-token message", () => {
    const { result } = renderHook(() => useTurnstileChallenge());
    expect(result.current.status).toBe("pending");

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, data: { type: "wn-turnstile-token", token: "abc" } }));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.token).toBe("abc");
  });

  it("transitions to unavailable on a same-origin wn-turnstile-unavailable message", () => {
    const { result } = renderHook(() => useTurnstileChallenge());

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, data: { type: "wn-turnstile-unavailable" } }));
    });

    expect(result.current.status).toBe("unavailable");
    expect(result.current.token).toBeNull();
  });

  it("ignores a message from an unexpected origin", () => {
    const { result } = renderHook(() => useTurnstileChallenge());

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: "https://evil.example", data: { type: "wn-turnstile-token", token: "spoofed" } }));
    });

    expect(result.current.status).toBe("pending");
  });

  it("does not downgrade an already-ready state back to unavailable (late unavailable message)", () => {
    const { result } = renderHook(() => useTurnstileChallenge());

    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, data: { type: "wn-turnstile-token", token: "abc" } }));
    });
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, data: { type: "wn-turnstile-unavailable" } }));
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.token).toBe("abc");
  });

  it("times out to unavailable after ~8s when nothing arrives", () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useTurnstileChallenge());
      expect(result.current.status).toBe("pending");
      act(() => { vi.advanceTimersByTime(8_000); });
      expect(result.current.status).toBe("unavailable");
    } finally {
      vi.useRealTimers();
    }
  });

  it("onIframeError marks the widget unavailable (offline/blocked load failure)", () => {
    const { result } = renderHook(() => useTurnstileChallenge());
    act(() => { result.current.onIframeError(); });
    expect(result.current.status).toBe("unavailable");
  });
});

// ── runActivation — the explicit first-grant seam the card's button calls ─────

describe("runActivation", () => {
  it("calls acquireTrialSession(undefined, token) and persists the returned trialKey", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_new", token: "tok", expiresAt: 1 }),
    }));
    const persist = vi.fn();

    await runActivation("cf-token", persist);

    expect(persist).toHaveBeenCalledWith("aiTrialKey", "trial_new");
  });

  it("passes undefined (not null) to acquireTrialSession when the widget is unavailable", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_new", token: "tok", expiresAt: 1 }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await runActivation(null, vi.fn());

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({});
  });
});

// ── TrialActivationCard — button gating + inline error surfacing ──────────────

describe("TrialActivationCard", () => {
  beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });

  it("disables Activate while the challenge is still pending", () => {
    render(<TrialActivationCard onActivated={vi.fn()} persistTrialKey={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Activate free trial" })).toBeDisabled();
  });

  it("enables Activate once the widget reports itself unavailable", () => {
    render(<TrialActivationCard onActivated={vi.fn()} persistTrialKey={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, data: { type: "wn-turnstile-unavailable" } }));
    });
    expect(screen.getByRole("button", { name: "Activate free trial" })).not.toBeDisabled();
  });

  it("on click, calls onActivated after a successful acquireTrialSession", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ trialKey: "trial_new", token: "tok", expiresAt: 1 }),
    }));
    const onActivated = vi.fn();
    const persist = vi.fn();
    render(<TrialActivationCard onActivated={onActivated} persistTrialKey={persist} />);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, data: { type: "wn-turnstile-unavailable" } }));
    });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Activate free trial" })); });

    expect(persist).toHaveBeenCalledWith("aiTrialKey", "trial_new");
    expect(onActivated).toHaveBeenCalledTimes(1);
  });

  it("shows the server's readable error inline on failure, without calling onActivated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "turnstile_failed" }),
    }));
    const onActivated = vi.fn();
    render(<TrialActivationCard onActivated={onActivated} persistTrialKey={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, data: { type: "wn-turnstile-unavailable" } }));
    });

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Activate free trial" })); });

    expect(screen.getByText("turnstile_failed")).toBeTruthy();
    expect(onActivated).not.toHaveBeenCalled();
  });
});
