/**
 * snapUndoReplace.seam.test.ts
 *
 * Contract: snapUndoReplace must call reloadScene(sid) AFTER the DB restore
 * resolves — not before, not in parallel. This guarantees the editor re-hydrates
 * from canonical DB state (scene-reload approach, Bug 2).
 *
 * When reloadScene is NOT provided the function falls back to applyEncoded on
 * the live doc (backward-compat). When no auto-snapshot exists for a scene,
 * neither save nor reloadScene is called.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { snapshotStore, snapUndoReplace } from "../App.snapshots";
import type { Snapshot } from "../db/snapshotStore";

function makeAutoSnap(sceneId: string): Snapshot {
  return { id: `snap-${sceneId}`, sceneId, label: null, wordCount: 10, createdAt: Date.now(), kind: "auto" };
}

/** Flush all pending microtasks by yielding to the macrotask queue. */
function flushAsync(): Promise<void> {
  return new Promise<void>((res) => { setTimeout(res, 0); });
}

describe("snapUndoReplace — reloadScene fires after DB restore resolves", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("calls reloadScene with the scene ID only after save resolves, preserving call order", async () => {
    const callOrder: string[] = [];
    let saveResolve!: () => void;
    const basePromise = new Promise<void>((res) => { saveResolve = res; });
    const save = vi.fn().mockReturnValue(basePromise.then(() => { callOrder.push("save"); }));
    const reloadScene = vi.fn().mockImplementation((sid: string) => { callOrder.push(`reload:${sid}`); });
    const snap = makeAutoSnap("s-1");

    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([snap]);
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue({ meta: snap, stateBase64: "state-a" });

    snapUndoReplace(["s-1"], save, () => null, reloadScene);

    // Allow listSnapshots + getSnapshot microtasks to settle; save is called but not yet resolved.
    await flushAsync();

    expect(save).toHaveBeenCalledWith("s-1", "state-a", null);
    expect(reloadScene).not.toHaveBeenCalled();

    saveResolve();
    await flushAsync();

    expect(reloadScene).toHaveBeenCalledWith("s-1");
    expect(callOrder).toStrictEqual(["save", "reload:s-1"]);
  });

  it("does NOT call reloadScene when no auto-snapshot exists for the scene", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const reloadScene = vi.fn();
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    snapUndoReplace(["s-no-snap"], save, () => null, reloadScene);

    await flushAsync();

    expect(save).not.toHaveBeenCalled();
    expect(reloadScene).not.toHaveBeenCalled();
  });
});
