// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useQuickCount } from "../features/quickcapture/useQuickCount";
import { QUICK_NOTES_CHANGED_EVENT } from "../lib/settings";

afterEach(cleanup);

describe("useQuickCount", () => {
  it("returns 0 initially and then the store count after the async call resolves", async () => {
    const store = { countUnfiled: vi.fn().mockResolvedValue(5) };
    const { result } = renderHook(() => useQuickCount("proj-1", store));
    // Initial synchronous render: 0 before effect settles.
    expect(result.current).toBe(0);
    await vi.waitFor(() => {
      expect(result.current).toBe(5);
    });
    expect(store.countUnfiled).toHaveBeenCalledWith("proj-1");
  });

  it("returns 0 and does not call countUnfiled when activeProjectId is null", async () => {
    const store = { countUnfiled: vi.fn() };
    const { result } = renderHook(() => useQuickCount(null, store));
    // Allow any microtasks to flush.
    await Promise.resolve();
    expect(result.current).toBe(0);
    expect(store.countUnfiled).not.toHaveBeenCalled();
  });

  it("re-queries countUnfiled when activeProjectId changes and returns the updated count", async () => {
    const store = {
      countUnfiled: vi
        .fn()
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7),
    };
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useQuickCount(id, store),
      { initialProps: { id: "A" as string | null } },
    );
    await vi.waitFor(() => {
      expect(result.current).toBe(3);
    });
    rerender({ id: "B" });
    await vi.waitFor(() => {
      expect(result.current).toBe(7);
    });
    expect(store.countUnfiled).toHaveBeenCalledWith("A");
    expect(store.countUnfiled).toHaveBeenCalledWith("B");
  });

  it("resets to 0 synchronously when activeProjectId transitions from a value to null", async () => {
    const store = { countUnfiled: vi.fn().mockResolvedValue(4) };
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useQuickCount(id, store),
      { initialProps: { id: "proj-1" as string | null } },
    );
    await vi.waitFor(() => {
      expect(result.current).toBe(4);
    });
    rerender({ id: null });
    // After rerender with null the synchronous derived-state reset fires.
    expect(result.current).toBe(0);
  });

  it("does not update state after unmount (cancelled flag guard)", async () => {
    let resolve!: (n: number) => void;
    const promise = new Promise<number>((r) => { resolve = r; });
    const store = { countUnfiled: vi.fn().mockReturnValue(promise) };
    const { result, unmount } = renderHook(() => useQuickCount("proj-1", store));
    unmount();
    resolve(99);
    await Promise.resolve();
    // State must remain at the initial value — 99 must not have been applied.
    expect(result.current).toBe(0);
  });

  it("re-fetches countUnfiled and updates count when QUICK_NOTES_CHANGED_EVENT fires", async () => {
    // Plain function (not vi.fn()) so it never exhausts and always returns a Promise.
    const cell = { value: 1 };
    const store = { countUnfiled: () => Promise.resolve(cell.value) };
    const { result } = renderHook(() => useQuickCount("proj-1", store));
    await vi.waitFor(() => { expect(result.current).toBe(1); });
    cell.value = 2;
    act(() => { window.dispatchEvent(new CustomEvent(QUICK_NOTES_CHANGED_EVENT)); });
    await vi.waitFor(() => { expect(result.current).toBe(2); });
  });

  it("leaves count unchanged on store error (does not reset to 0)", async () => {
    const store = {
      countUnfiled: vi
        .fn()
        .mockResolvedValueOnce(2)
        .mockRejectedValueOnce(new Error("db down")),
    };
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useQuickCount(id, store),
      { initialProps: { id: "proj-1" } },
    );
    await vi.waitFor(() => {
      expect(result.current).toBe(2);
    });
    // Trigger a re-render that causes the second (failing) countUnfiled call.
    rerender({ id: "proj-2" });
    await vi.waitFor(() => {
      expect(store.countUnfiled).toHaveBeenCalledWith("proj-2");
    });
    // On error the count stays at whatever it was before — not reset.
    expect(result.current).toBe(2);
  });
});
