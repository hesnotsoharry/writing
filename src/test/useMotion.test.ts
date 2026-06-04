// @vitest-environment jsdom
/**
 * useMotion — unit tests for the readMotion logic inside useMotion.ts.
 *
 * Seam strategy:
 *   - motion tweak:   controlled via localStorage (same seam settings.store uses)
 *   - window.matchMedia: replaced with a stub that returns a configurable .matches value
 *
 * The hook itself is tested via renderHook; readMotion is exercised through it.
 * Neither the subject nor its immediate dependencies (getTweak, useState) are mocked.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SETTINGS_NS } from "../features/settings/settings.store";
import { useMotion } from "../theme/useMotion";

// Helpers ─────────────────────────────────────────────────────────────────────

function setMotionTweak(value: boolean): void {
  localStorage.setItem(`${SETTINGS_NS}motion`, JSON.stringify(value));
}

function stubMatchMedia(reducedMotionPreferred: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("reduce") ? reducedMotionPreferred : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function removeMatchMedia(): void {
  // Simulate environments (jsdom default) where matchMedia is absent.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: undefined,
  });
}

// Setup / teardown ────────────────────────────────────────────────────────────

afterEach(() => {
  localStorage.clear();
  // Restore a no-op matchMedia so other tests aren't affected.
  stubMatchMedia(false);
});

// Tests ───────────────────────────────────────────────────────────────────────

describe("useMotion — motion enabled in settings, OS allows motion", () => {
  beforeEach(() => {
    setMotionTweak(true);
    stubMatchMedia(false); // OS does NOT prefer reduced motion
  });

  it("returns true when the motion tweak is ON and OS has no reduced-motion preference", () => {
    const { result } = renderHook(() => useMotion());
    expect(result.current).toBe(true);
  });
});

describe("useMotion — motion disabled in settings", () => {
  beforeEach(() => {
    setMotionTweak(false);
    stubMatchMedia(false); // OS allows motion, but the tweak is OFF
  });

  it("returns false when the motion tweak is OFF regardless of OS preference", () => {
    const { result } = renderHook(() => useMotion());
    expect(result.current).toBe(false);
  });
});

describe("useMotion — OS prefers-reduced-motion: reduce", () => {
  beforeEach(() => {
    setMotionTweak(true);
    stubMatchMedia(true); // OS requests reduced motion
  });

  it("returns false when OS prefers-reduced-motion even though the tweak is ON", () => {
    const { result } = renderHook(() => useMotion());
    expect(result.current).toBe(false);
  });
});

describe("useMotion — matchMedia absent (jsdom / SSR-like env)", () => {
  beforeEach(() => {
    setMotionTweak(true);
    removeMatchMedia(); // window.matchMedia is undefined
  });

  it("does not throw and returns true (tweak ON, no matchMedia means no reduce signal)", () => {
    // Fix 2 regression guard: before the fix, .matches access on undefined threw TypeError.
    expect(() => renderHook(() => useMotion())).not.toThrow();
    const { result } = renderHook(() => useMotion());
    expect(result.current).toBe(true);
  });
});

describe("useMotion — default state (no localStorage, no matchMedia)", () => {
  beforeEach(() => {
    // localStorage is clear; TWEAK_DEFAULTS.motion is true
    stubMatchMedia(false);
  });

  it("returns true by default (TWEAK_DEFAULTS.motion is true, OS allows motion)", () => {
    const { result } = renderHook(() => useMotion());
    expect(result.current).toBe(true);
  });
});
