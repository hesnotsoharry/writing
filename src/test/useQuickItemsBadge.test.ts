// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useQuickItemsBadge } from "../features/quickcapture/useQuickItemsBadge";

describe("useQuickItemsBadge", () => {
  it("calls setHasQuickItems(true) when countUnfiled resolves > 0", async () => {
    const store = { countUnfiled: vi.fn().mockResolvedValue(2) };
    const setHasQuickItems = vi.fn();
    renderHook(() =>
      useQuickItemsBadge("proj-1", setHasQuickItems, store),
    );
    await vi.waitFor(() => {
      expect(store.countUnfiled).toHaveBeenCalledWith("proj-1");
      expect(setHasQuickItems).toHaveBeenCalledWith(true);
    });
  });

  it("calls setHasQuickItems(false) when countUnfiled resolves 0", async () => {
    const store = { countUnfiled: vi.fn().mockResolvedValue(0) };
    const setHasQuickItems = vi.fn();
    renderHook(() =>
      useQuickItemsBadge("proj-1", setHasQuickItems, store),
    );
    await vi.waitFor(() => {
      expect(setHasQuickItems).toHaveBeenCalledWith(false);
    });
  });

  it("calls setHasQuickItems(false) immediately and does not call countUnfiled when activeProjectId is null", async () => {
    const store = { countUnfiled: vi.fn() };
    const setHasQuickItems = vi.fn();
    renderHook(() =>
      useQuickItemsBadge(null, setHasQuickItems, store),
    );
    await vi.waitFor(() => {
      expect(setHasQuickItems).toHaveBeenCalledWith(false);
    });
    expect(store.countUnfiled).not.toHaveBeenCalled();
  });

  it("re-queries countUnfiled when activeProjectId changes and updates badge", async () => {
    const store = {
      countUnfiled: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0),
    };
    const setHasQuickItems = vi.fn();
    const { rerender } = renderHook(
      ({ id }: { id: string }) =>
        useQuickItemsBadge(id, setHasQuickItems, store),
      { initialProps: { id: "A" } },
    );
    await vi.waitFor(() => {
      expect(setHasQuickItems).toHaveBeenCalledWith(true);
    });
    rerender({ id: "B" });
    await vi.waitFor(() => {
      expect(setHasQuickItems).toHaveBeenCalledWith(false);
    });
    expect(store.countUnfiled).toHaveBeenCalledWith("A");
    expect(store.countUnfiled).toHaveBeenCalledWith("B");
  });

  it("does not call setHasQuickItems after unmount (cancelled flag guard)", async () => {
    let resolve!: (n: number) => void;
    const promise = new Promise<number>((r) => { resolve = r; });
    const store = { countUnfiled: vi.fn().mockReturnValue(promise) };
    const setHasQuickItems = vi.fn();
    const { unmount } = renderHook(() =>
      useQuickItemsBadge("proj-1", setHasQuickItems, store),
    );
    unmount();
    resolve(3);
    // allow microtasks to flush
    await Promise.resolve();
    expect(setHasQuickItems).not.toHaveBeenCalled();
  });
});
