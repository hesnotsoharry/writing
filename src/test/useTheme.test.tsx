// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  ACCENT_KEY,
  type AccentPalette,
  DEFAULT_ACCENT,
  THEME_KEY,
  useTheme,
} from "../theme/useTheme";

afterEach(() => {
  // Clean up any mutations to document.documentElement so tests don't leak.
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.style.removeProperty("--accent-deep");
  document.documentElement.style.removeProperty("--accent-tint");
  document.documentElement.style.removeProperty("--accent-wash");
  document.documentElement.style.removeProperty("--accent-ring");
  document.documentElement.style.removeProperty("--selection");
  document.documentElement.style.removeProperty("--character");
  document.documentElement.style.removeProperty("--character-tint");
});

describe("useTheme", () => {
  it("initial render defaults to light theme — no data-theme attribute on documentElement", () => {
    renderHook(() => useTheme());
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("setTheme('dark') sets [data-theme='dark'] on documentElement", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme("dark");
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("setTheme('light') after dark removes the data-theme attribute", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme("dark");
    });
    act(() => {
      result.current.setTheme("light");
    });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("initial render writes the default --accent custom property to documentElement", () => {
    renderHook(() => useTheme());
    // Default accent hero is #b25a38.
    expect(
      document.documentElement.style.getPropertyValue("--accent"),
    ).toBe("#b25a38");
  });

  it("setAccent writes the new hero to --accent on documentElement", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setAccent(["#2a6fdb", "#1a5fc0", "#d6e6fb"]);
    });
    expect(
      document.documentElement.style.getPropertyValue("--accent"),
    ).toBe("#2a6fdb");
  });

  it("setAccent writes all derived accent custom properties", () => {
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setAccent(["#2a6fdb", "#1a5fc0", "#d6e6fb"]);
    });
    const style = document.documentElement.style;
    expect(style.getPropertyValue("--accent-deep")).toBe("#1a5fc0");
    expect(style.getPropertyValue("--accent-tint")).toBe("#d6e6fb");
    // Wash, ring, selection are rgba() computed from the hero channel.
    expect(style.getPropertyValue("--accent-wash")).toBe("rgba(42,111,219,0.10)");
    expect(style.getPropertyValue("--accent-ring")).toBe("rgba(42,111,219,0.30)");
    expect(style.getPropertyValue("--selection")).toBe("rgba(42,111,219,0.16)");
    expect(style.getPropertyValue("--character")).toBe("#2a6fdb");
    expect(style.getPropertyValue("--character-tint")).toBe("#d6e6fb");
  });

  it("derives rgba() correctly from a 3-digit short-form hex accent", () => {
    // #abc expands to #aabbcc → 170,187,204; must not produce NaN channels.
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setAccent(["#abc", "#9ab", "#def"]);
    });
    expect(
      document.documentElement.style.getPropertyValue("--accent-wash"),
    ).toBe("rgba(170,187,204,0.10)");
  });
});

// Acceptance oracle for Phase 2 (cross-boundary: persistent storage).
// Authored by the orchestrator before implementation. Proves theme + accent
// survive a hook remount via the writing.* localStorage keys.
describe("persistence seam (wave-15)", () => {
  it("restores a persisted theme from localStorage on mount", () => {
    localStorage.setItem(THEME_KEY, JSON.stringify("dark"));
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("dark");
  });

  it("persists setTheme across hook instances (survives remount)", () => {
    const { result, unmount } = renderHook(() => useTheme());
    act(() => {
      result.current.setTheme("dark");
    });
    unmount();
    const { result: remounted } = renderHook(() => useTheme());
    expect(remounted.current.theme).toBe("dark");
  });

  it("restores a persisted accent and persists setAccent across instances", () => {
    const palette: AccentPalette = ["#3f6f9e", "#315e89", "#dde7f1"];
    const { result } = renderHook(() => useTheme());
    act(() => {
      result.current.setAccent(palette);
    });
    const { result: remounted } = renderHook(() => useTheme());
    expect(remounted.current.accent).toEqual(palette);
  });

  it("falls back to defaults when persisted values are corrupt", () => {
    localStorage.setItem(THEME_KEY, "not json{");
    localStorage.setItem(ACCENT_KEY, "not json{");
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe("light");
    expect(result.current.accent).toEqual(DEFAULT_ACCENT);
  });
});
