// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useArchivedCount } from "../features/archive/useArchivedCount";

describe("useArchivedCount", () => {
  it("returns 0 initially and then the store count after the async call resolves", async () => {
    const store = { archivedCount: vi.fn().mockResolvedValue(3) };
    const { result } = renderHook(() => useArchivedCount("proj-1", 0, store));
    // Initial synchronous render: 0 before effect settles.
    expect(result.current).toBe(0);
    await vi.waitFor(() => {
      expect(result.current).toBe(3);
    });
    expect(store.archivedCount).toHaveBeenCalledWith("proj-1");
  });

  it("returns 0 and does not call archivedCount when activeProjectId is null", async () => {
    const store = { archivedCount: vi.fn() };
    const { result } = renderHook(() => useArchivedCount(null, 0, store));
    await Promise.resolve();
    expect(result.current).toBe(0);
    expect(store.archivedCount).not.toHaveBeenCalled();
  });

  it("re-queries archivedCount when version bumps and returns the updated count", async () => {
    const store = {
      archivedCount: vi
        .fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(5),
    };
    const { result, rerender } = renderHook(
      ({ version }: { version: number }) => useArchivedCount("proj-1", version, store),
      { initialProps: { version: 0 } },
    );
    await vi.waitFor(() => {
      expect(result.current).toBe(2);
    });
    rerender({ version: 1 });
    await vi.waitFor(() => {
      expect(result.current).toBe(5);
    });
    expect(store.archivedCount).toHaveBeenCalledTimes(2);
    expect(store.archivedCount).toHaveBeenCalledWith("proj-1");
  });

  it("re-queries when activeProjectId changes and returns the updated count", async () => {
    const store = {
      archivedCount: vi
        .fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(4),
    };
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useArchivedCount(id, 0, store),
      { initialProps: { id: "A" as string | null } },
    );
    await vi.waitFor(() => {
      expect(result.current).toBe(1);
    });
    rerender({ id: "B" });
    await vi.waitFor(() => {
      expect(result.current).toBe(4);
    });
    expect(store.archivedCount).toHaveBeenCalledWith("A");
    expect(store.archivedCount).toHaveBeenCalledWith("B");
  });

  it("resets to 0 synchronously when activeProjectId transitions from a value to null", async () => {
    const store = { archivedCount: vi.fn().mockResolvedValue(3) };
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useArchivedCount(id, 0, store),
      { initialProps: { id: "proj-1" as string | null } },
    );
    await vi.waitFor(() => {
      expect(result.current).toBe(3);
    });
    rerender({ id: null });
    // Synchronous derived-state reset fires before effects.
    expect(result.current).toBe(0);
  });

  it("does not update state after unmount (cancelled flag guard)", async () => {
    let resolve!: (n: number) => void;
    const promise = new Promise<number>((r) => { resolve = r; });
    const store = { archivedCount: vi.fn().mockReturnValue(promise) };
    const { result, unmount } = renderHook(() => useArchivedCount("proj-1", 0, store));
    unmount();
    resolve(42);
    await Promise.resolve();
    expect(result.current).toBe(0);
  });

  it("leaves count unchanged on store error (does not reset to 0)", async () => {
    const store = {
      archivedCount: vi
        .fn()
        .mockResolvedValueOnce(2)
        .mockRejectedValueOnce(new Error("db down")),
    };
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useArchivedCount(id, 0, store),
      { initialProps: { id: "proj-1" } },
    );
    await vi.waitFor(() => {
      expect(result.current).toBe(2);
    });
    rerender({ id: "proj-2" });
    await vi.waitFor(() => {
      expect(store.archivedCount).toHaveBeenCalledWith("proj-2");
    });
    // On error the count stays at whatever it was before — not reset.
    expect(result.current).toBe(2);
  });
});
