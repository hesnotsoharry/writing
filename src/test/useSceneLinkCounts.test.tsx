// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SqliteStoryBibleStore } from "../db/sqliteStoryBibleStore";
import { useSceneLinkCounts } from "../editor/useSceneLinkCounts";

// ---------------------------------------------------------------------------
// Minimal stub — only loadSceneEntities is exercised by this hook
// ---------------------------------------------------------------------------

function makeStore(
  loadSceneEntities: SqliteStoryBibleStore["loadSceneEntities"],
): SqliteStoryBibleStore {
  return { loadSceneEntities } as unknown as SqliteStoryBibleStore;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSceneLinkCounts", () => {
  it("returns {characters:2,locations:1} after async resolves for a real sceneId", async () => {
    const load = vi.fn().mockResolvedValue([
      { type: "character", entities: [{ id: "a" }, { id: "b" }] },
      { type: "location",  entities: [{ id: "c" }] },
    ]);
    const store = makeStore(load);
    const { result } = renderHook(() =>
      useSceneLinkCounts(store, "scene-1", 0),
    );
    await waitFor(() => expect(result.current.characters).toBe(2));
    expect(result.current.locations).toBe(1);
  });

  it("returns {0,0} and does NOT call the store when sceneId is null", () => {
    const load = vi.fn();
    const store = makeStore(load);
    const { result } = renderHook(() =>
      useSceneLinkCounts(store, null, 0),
    );
    expect(result.current).toEqual({ characters: 0, locations: 0 });
    expect(load).not.toHaveBeenCalled();
  });

  it("re-fetches when refreshKey changes and updates counts", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce([{ type: "character", entities: [{ id: "a" }] }])
      .mockResolvedValueOnce([
        { type: "character", entities: [{ id: "a" }, { id: "b" }] },
        { type: "location",  entities: [{ id: "c" }] },
      ]);
    const store = makeStore(load);
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) => useSceneLinkCounts(store, "scene-1", key),
      { initialProps: { key: 0 } },
    );
    await waitFor(() => expect(result.current.characters).toBe(1));
    expect(result.current.locations).toBe(0);

    rerender({ key: 1 });
    await waitFor(() => expect(result.current.characters).toBe(2));
    expect(result.current.locations).toBe(1);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("(race) stale result from old sceneId does not overwrite newer sceneId result", async () => {
    // Deferred promises let us control resolution order.
    type Groups = { type: string; entities: unknown[] }[];
    let resolveA!: (v: Groups) => void;
    let resolveB!: (v: Groups) => void;
    const promiseA = new Promise<Groups>((res) => { resolveA = res; });
    const promiseB = new Promise<Groups>((res) => { resolveB = res; });

    const load = vi.fn()
      .mockReturnValueOnce(promiseA)  // called with sceneId="A"
      .mockReturnValueOnce(promiseB); // called with sceneId="B"

    const store = makeStore(load);
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useSceneLinkCounts(store, id, 0),
      { initialProps: { id: "A" } },
    );

    // Switch to B before A resolves
    rerender({ id: "B" });

    // Resolve B first (2 chars), then A (99 chars — should be ignored)
    resolveB([{ type: "character", entities: [{ id: "x" }, { id: "y" }] }]);
    await waitFor(() => expect(result.current.characters).toBe(2));

    resolveA([{ type: "character", entities: new Array(99).fill({ id: "z" }) }]);
    // After a tick, state must still reflect B (2), not A (99)
    await waitFor(() => expect(result.current.characters).toBe(2));
  });
});
