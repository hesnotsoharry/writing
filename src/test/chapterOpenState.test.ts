// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  isChapterOpen,
  setChapterOpen,
  STORAGE_KEY,
  useChapterOpen,
} from "../binder/chapterOpenState";

beforeEach(() => {
  localStorage.clear();
});

describe("chapterOpenState", () => {
  it("returns true when the storage key is absent (default-open convention)", () => {
    expect(isChapterOpen("ch-absent")).toBe(true);
  });

  it("returns false after setChapterOpen marks the chapter closed", () => {
    setChapterOpen("ch-1", false);
    expect(isChapterOpen("ch-1")).toBe(false);
  });

  it("closing one chapter does not affect a different chapter's open state", () => {
    setChapterOpen("ch-1", false);
    expect(isChapterOpen("ch-2")).toBe(true);
  });

  it("returns true and does not throw when stored JSON is corrupt", () => {
    localStorage.setItem(STORAGE_KEY, "{{not-valid-json}}");
    expect(() => isChapterOpen("ch-corrupt")).not.toThrow();
    expect(isChapterOpen("ch-corrupt")).toBe(true);
  });
});

describe("useChapterOpen", () => {
  it("toggle flips state and persists to localStorage consistently", () => {
    const { result } = renderHook(() => useChapterOpen("ch-hook"));
    expect(result.current[0]).toBe(true);

    act(() => { result.current[1](); });
    expect(result.current[0]).toBe(false);
    expect(isChapterOpen("ch-hook")).toBe(false);

    act(() => { result.current[1](); });
    expect(result.current[0]).toBe(true);
    expect(isChapterOpen("ch-hook")).toBe(true);
  });
});
