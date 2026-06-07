// @vitest-environment jsdom
/**
 * snapshotRail.acceptance.test.ts — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 2.
 *
 * ⚠️ Implementers (Claude OR Codex): DO NOT MODIFY THIS FILE. Make it pass without editing it.
 *
 * Contract (the stale-scene bug): the History rail must show the snapshots of the CURRENTLY ACTIVE
 * scene, and must refetch when the active scene changes — WITHOUT the version-history overlay being
 * opened. Today App.tsx only fetches when `showHistory && historySceneId`, keyed on a manually-set
 * `historySceneId`, so switching scenes leaves the rail showing the previous scene's snapshots.
 *
 * The fix must expose a small, testable hook that loads the active scene's snapshots:
 *
 *     // in src/App.snapshots.ts
 *     export function useActiveSceneSnapshots(
 *       store: SnapshotStore,
 *       activeSceneId: string | null,
 *     ): Snapshot[]
 *
 * It returns [] for a null scene, returns the active scene's snapshots, and refetches when
 * `activeSceneId` changes. The History rail must be wired through this hook (verified live via smoke).
 *
 * The CSS port, the title-bar ↺ entry, and the restoring spinner are visual — verified by CDP smoke,
 * not here.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useActiveSceneSnapshots } from "../App.snapshots";
import { InMemorySnapshotStore } from "../db/inMemorySnapshotStore";

function seeded(): InMemorySnapshotStore {
  const store = new InMemorySnapshotStore();
  void store.takeSnapshot({ sceneId: "A", label: "a1", stateBase64: "AA", wordCount: 1, kind: "manual" });
  void store.takeSnapshot({ sceneId: "B", label: "b1", stateBase64: "BB", wordCount: 2, kind: "manual" });
  void store.takeSnapshot({ sceneId: "B", label: "b2", stateBase64: "BB", wordCount: 3, kind: "manual" });
  return store;
}

describe("Wave 28 P2 acceptance — History rail tracks the active scene", () => {
  it("returns an empty list when there is no active scene", () => {
    const { result } = renderHook(() => useActiveSceneSnapshots(new InMemorySnapshotStore(), null));
    expect(result.current).toEqual([]);
  });

  it("loads the active scene's snapshots", async () => {
    const store = seeded();
    const { result } = renderHook(({ id }) => useActiveSceneSnapshots(store, id), {
      initialProps: { id: "A" as string | null },
    });
    await waitFor(() => expect(result.current.map((s) => s.label)).toEqual(["a1"]));
  });

  it("refetches for the new scene when the active scene changes (no overlay needed)", async () => {
    const store = seeded();
    const { result, rerender } = renderHook(({ id }) => useActiveSceneSnapshots(store, id), {
      initialProps: { id: "A" as string | null },
    });
    await waitFor(() => expect(result.current.map((s) => s.label)).toEqual(["a1"]));

    rerender({ id: "B" });
    await waitFor(() => expect(result.current.map((s) => s.label).sort()).toEqual(["b1", "b2"]));
    expect(result.current.map((s) => s.label)).not.toContain("a1");
  });
});
