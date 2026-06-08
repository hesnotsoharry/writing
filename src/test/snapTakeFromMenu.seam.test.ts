/**
 * snapTakeFromMenu.seam.test.ts
 *
 * Contract: snapTakeFromMenu must return a Promise so callers (App.tsx) can
 * chain bumpRailKey() after the snapshot is persisted.
 *
 * Before the fix: the function returned void/undefined → chaining was
 * impossible, so the History rail was never refreshed from the binder
 * right-click "Take snapshot" path.
 *
 * After the fix: the function returns Promise<void> that resolves only after
 * takeSnapshot completes, guaranteeing bumpRailKey fires post-DB-write.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { snapshotStore, snapTakeFromMenu } from "../App.snapshots";

function makeOpts(doc: Y.Doc | null, isActive = true) {
  return {
    targetSceneId: "s1",
    isActive,
    activeDoc: doc,
    currentWords: 5,
    set: vi.fn(),
    setShowHistory: vi.fn(),
    load: vi.fn().mockResolvedValue("Y3VycmVudA=="),
  } as const;
}

describe("snapTakeFromMenu — returns a Promise so callers can chain bumpRailKey", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("returns a Promise (not void) when a valid doc is provided", () => {
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(
      { id: "snap-1", sceneId: "s1", label: null, wordCount: 5, createdAt: Date.now(), kind: "manual" },
    );
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const doc = new Y.Doc();
    const result = snapTakeFromMenu(makeOpts(doc));
    expect(result).toBeInstanceOf(Promise);
  });

  it("resolves AFTER takeSnapshot completes so a chained bumpRailKey fires post-DB-write", async () => {
    const callOrder: string[] = [];
    vi.spyOn(snapshotStore, "takeSnapshot").mockImplementation(() =>
      Promise.resolve().then(() => {
        callOrder.push("snapshot");
        return { id: "snap-1", sceneId: "s1", label: null, wordCount: 5, createdAt: Date.now(), kind: "manual" } as const;
      }),
    );
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const doc = new Y.Doc();
    await snapTakeFromMenu(makeOpts(doc)).then(() => callOrder.push("bump"));

    expect(callOrder).toStrictEqual(["snapshot", "bump"]);
  });

  it("returns a resolved Promise when no active doc so the caller chain still works (non-active path uses load)", async () => {
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(
      { id: "snap-1", sceneId: "s1", label: null, wordCount: 0, createdAt: Date.now(), kind: "manual" },
    );
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    // activeDoc=null with isActive=false → resolveTargetBytes uses load() instead of encodeDoc.
    const result = snapTakeFromMenu(makeOpts(null, false));
    expect(result).toBeInstanceOf(Promise);
    await expect(result).resolves.toBeUndefined();
  });
});
