// @vitest-environment jsdom
/**
 * Regression tests for useGlobalKeybindings (App.keybindings.ts).
 *
 * Guards:
 *  - FLAG-1: ⌘K and ⌘. must call setters with a functional updater (not a
 *    stale direct-negation) — verified by inspecting the argument type and
 *    testing both input branches of the returned function.
 *  - FLAG-2: Escape with a modifier held must still trigger close-all.
 *  - Listener cleanup on unmount (no leak).
 */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { type KeybindingSetters, useGlobalKeybindings } from "../App.keybindings";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSetters(): KeybindingSetters {
  return {
    setShowQuickCapture: vi.fn(),
    setShowInbox: vi.fn(),
    setShowArchive: vi.fn(),
    setShowGoals: vi.fn(),
    setShowExport: vi.fn(),
    setShowSettings: vi.fn(),
    setFocusMode: vi.fn(),
  };
}

function fireKey(key: string, opts: { metaKey?: boolean; ctrlKey?: boolean } = {}) {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, ...opts }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGlobalKeybindings", () => {
  // --- FLAG-1: functional-updater toggles ---

  it("⌘K calls setShowQuickCapture with a functional updater that toggles false→true", () => {
    const setters = makeSetters();
    renderHook(() => useGlobalKeybindings(setters));

    fireKey("k", { metaKey: true });

    expect(setters.setShowQuickCapture).toHaveBeenCalledTimes(1);
    const arg = (setters.setShowQuickCapture as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof arg).toBe("function");
    expect(arg(false)).toBe(true);
    expect(arg(true)).toBe(false);
  });

  it("⌘. calls setFocusMode with a functional updater that toggles false→true", () => {
    const setters = makeSetters();
    renderHook(() => useGlobalKeybindings(setters));

    fireKey(".", { metaKey: true });

    expect(setters.setFocusMode).toHaveBeenCalledTimes(1);
    const arg = (setters.setFocusMode as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(typeof arg).toBe("function");
    expect(arg(false)).toBe(true);
    expect(arg(true)).toBe(false);
  });

  // --- Non-toggle open shortcuts ---

  it("⌘E calls setShowExport(true)", () => {
    const setters = makeSetters();
    renderHook(() => useGlobalKeybindings(setters));

    fireKey("e", { metaKey: true });

    expect(setters.setShowExport).toHaveBeenCalledOnce();
    expect(setters.setShowExport).toHaveBeenCalledWith(true);
  });

  it("⌘, calls setShowSettings(true)", () => {
    const setters = makeSetters();
    renderHook(() => useGlobalKeybindings(setters));

    fireKey(",", { metaKey: true });

    expect(setters.setShowSettings).toHaveBeenCalledOnce();
    expect(setters.setShowSettings).toHaveBeenCalledWith(true);
  });

  // --- Escape (no modifier) closes all ---

  it("Escape (no modifier) calls all six show-setters with false and setFocusMode(false)", () => {
    const setters = makeSetters();
    renderHook(() => useGlobalKeybindings(setters));

    fireKey("Escape");

    expect(setters.setShowQuickCapture).toHaveBeenCalledWith(false);
    expect(setters.setShowInbox).toHaveBeenCalledWith(false);
    expect(setters.setShowArchive).toHaveBeenCalledWith(false);
    expect(setters.setShowGoals).toHaveBeenCalledWith(false);
    expect(setters.setShowExport).toHaveBeenCalledWith(false);
    expect(setters.setShowSettings).toHaveBeenCalledWith(false);
    expect(setters.setFocusMode).toHaveBeenCalledWith(false);
  });

  // --- FLAG-2: Escape WITH modifier held still closes all ---

  it("Escape WITH metaKey held also triggers close-all (FLAG-2 guard)", () => {
    const setters = makeSetters();
    renderHook(() => useGlobalKeybindings(setters));

    fireKey("Escape", { metaKey: true });

    expect(setters.setShowQuickCapture).toHaveBeenCalledWith(false);
    expect(setters.setShowInbox).toHaveBeenCalledWith(false);
    expect(setters.setShowArchive).toHaveBeenCalledWith(false);
    expect(setters.setShowGoals).toHaveBeenCalledWith(false);
    expect(setters.setShowExport).toHaveBeenCalledWith(false);
    expect(setters.setShowSettings).toHaveBeenCalledWith(false);
    expect(setters.setFocusMode).toHaveBeenCalledWith(false);
  });

  // --- Listener cleanup on unmount ---

  it("unmount removes the keydown listener — subsequent keydown does not call setters", () => {
    const setters = makeSetters();
    const { unmount } = renderHook(() => useGlobalKeybindings(setters));

    unmount();

    fireKey("k", { metaKey: true });
    fireKey("Escape");

    expect(setters.setShowQuickCapture).not.toHaveBeenCalled();
    expect(setters.setFocusMode).not.toHaveBeenCalled();
  });
});
