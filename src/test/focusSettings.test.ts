// @vitest-environment jsdom
/**
 * useFocusSettings — contract tests.
 *
 * Tests the hook itself via renderHook so every assertion exercises the
 * actual production code path (lazy initialiser, toggle, localStorage writes).
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useFocusSettings } from "../features/focus/useFocusSettings";

afterEach(() => {
  localStorage.clear();
});

describe("useFocusSettings — defaults all options ON", () => {
  it("defaults typewriter to true when localStorage is empty", () => {
    const { result } = renderHook(() => useFocusSettings());
    expect(result.current.settings.typewriter).toBe(true);
  });

  it("defaults dimParagraphs to true when localStorage is empty", () => {
    const { result } = renderHook(() => useFocusSettings());
    expect(result.current.settings.dimParagraphs).toBe(true);
  });

  it("defaults hud to true when localStorage is empty", () => {
    const { result } = renderHook(() => useFocusSettings());
    expect(result.current.settings.hud).toBe(true);
  });

  it("defaults timer to true when localStorage is empty", () => {
    const { result } = renderHook(() => useFocusSettings());
    expect(result.current.settings.timer).toBe(true);
  });
});

describe("useFocusSettings — toggling persists to localStorage", () => {
  it("toggling typewriter off writes false to localStorage and updates settings", () => {
    const { result } = renderHook(() => useFocusSettings());
    act(() => { result.current.toggle("typewriter"); });
    expect(result.current.settings.typewriter).toBe(false);
    expect(localStorage.getItem("focus.typewriter")).toBe("false");
  });

  it("toggling dimParagraphs off then on round-trips correctly", () => {
    const { result } = renderHook(() => useFocusSettings());
    act(() => { result.current.toggle("dimParagraphs"); });
    expect(result.current.settings.dimParagraphs).toBe(false);
    act(() => { result.current.toggle("dimParagraphs"); });
    expect(result.current.settings.dimParagraphs).toBe(true);
    expect(localStorage.getItem("focus.dimParagraphs")).toBe("true");
  });

  it("toggling hud off persists false to localStorage key 'focus.hud'", () => {
    const { result } = renderHook(() => useFocusSettings());
    act(() => { result.current.toggle("hud"); });
    expect(result.current.settings.hud).toBe(false);
    expect(localStorage.getItem("focus.hud")).toBe("false");
  });

  it("toggling timer off then on restores true in localStorage", () => {
    const { result } = renderHook(() => useFocusSettings());
    act(() => { result.current.toggle("timer"); });
    expect(result.current.settings.timer).toBe(false);
    act(() => { result.current.toggle("timer"); });
    expect(result.current.settings.timer).toBe(true);
    expect(localStorage.getItem("focus.timer")).toBe("true");
  });
});

describe("useFocusSettings — re-mounting reads persisted localStorage", () => {
  it("re-mount reads false from localStorage for typewriter after it was toggled off", () => {
    const first = renderHook(() => useFocusSettings());
    act(() => { first.result.current.toggle("typewriter"); });
    first.unmount();
    const second = renderHook(() => useFocusSettings());
    expect(second.result.current.settings.typewriter).toBe(false);
  });

  it("re-mount reads current state for all keys after multiple toggles", () => {
    const first = renderHook(() => useFocusSettings());
    act(() => { first.result.current.toggle("hud"); });
    act(() => { first.result.current.toggle("timer"); });
    first.unmount();
    const second = renderHook(() => useFocusSettings());
    expect(second.result.current.settings).toEqual({
      typewriter: true,
      dimParagraphs: true,
      hud: false,
      timer: false,
    });
  });

  it("re-mount after localStorage.clear reverts all to defaults (true)", () => {
    const first = renderHook(() => useFocusSettings());
    act(() => { first.result.current.toggle("typewriter"); });
    first.unmount();
    localStorage.clear();
    const second = renderHook(() => useFocusSettings());
    expect(second.result.current.settings).toEqual({
      typewriter: true,
      dimParagraphs: true,
      hud: true,
      timer: true,
    });
  });
});
