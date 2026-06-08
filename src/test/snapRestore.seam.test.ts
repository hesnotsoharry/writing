/**
 * snapRestore.seam.test.ts
 *
 * Contract: snapRestore must write restored bytes to the TARGET scene only,
 * regardless of which scene is currently open in the live editor.
 *
 * The bug fixed: restoring snapshot of scene B while A was active used to call
 * applyEncoded on A's in-memory doc (data loss on A) and attribute the auto-backup
 * to A's sceneId. The fix: snapRestore now receives an explicit targetSceneId +
 * isActive flag + load/save callbacks, and never touches the active doc when
 * isActive is false.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import type { SnapRestoreOpts } from "../App.snapshots";
import { snapCapture, snapRestore, snapshotStore, snapTakeFromMenu } from "../App.snapshots";
import type { Snapshot } from "../db/snapshotStore";

const RESTORED_BYTES = "cmVzdG9yZWQ="; // stable placeholder — exact Yjs bytes not load-bearing at this seam
const CURRENT_B_BYTES = "Y3VycmVudEI=";

function makeSnapshot(sceneId: string): Snapshot {
  return { id: "snap-1", sceneId, label: null, wordCount: 10, createdAt: 0, kind: "auto" };
}

function makeRecord(sceneId: string): { meta: Snapshot; stateBase64: string } {
  return { meta: makeSnapshot(sceneId), stateBase64: RESTORED_BYTES };
}

// ─── cross-scene path (target B, active A) ──────────────────────────────────

describe("snapRestore — cross-scene path (target scene ≠ active scene)", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("attributes auto-backup takeSnapshot to B, never to A", async () => {
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(makeRecord("B"));
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("B"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const opts: SnapRestoreOpts = {
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(), currentWords: 0,
      set: vi.fn(), load: vi.fn().mockResolvedValue(CURRENT_B_BYTES),
      save: vi.fn().mockResolvedValue(undefined), reloadScene: vi.fn(),
    };
    await snapRestore(opts, "snap-1");

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ sceneId: "B" }));
    // Verify A's sceneId never appears (the non-active path must not touch A's namespace).
    expect(takeSnapshot).not.toHaveBeenCalledWith(expect.objectContaining({ sceneId: "A" }));
  });

  it("persists restored bytes to B's store entry, not A's", async () => {
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(makeRecord("B"));
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("B"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const save = vi.fn().mockResolvedValue(undefined);
    const opts: SnapRestoreOpts = {
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(), currentWords: 0,
      set: vi.fn(), load: vi.fn().mockResolvedValue(CURRENT_B_BYTES), save, reloadScene: vi.fn(),
    };
    await snapRestore(opts, "snap-1");

    expect(save).toHaveBeenCalledWith("B", RESTORED_BYTES, null);
    expect(save).not.toHaveBeenCalledWith("A", expect.anything(), expect.anything());
  });

  it("does NOT call reloadScene when target is not the active scene", async () => {
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(makeRecord("B"));
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("B"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const reloadScene = vi.fn();
    const opts: SnapRestoreOpts = {
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(), currentWords: 0,
      set: vi.fn(), load: vi.fn().mockResolvedValue(CURRENT_B_BYTES),
      save: vi.fn().mockResolvedValue(undefined), reloadScene,
    };
    await snapRestore(opts, "snap-1");

    expect(reloadScene).not.toHaveBeenCalled();
  });

  it("resolves current bytes via load(B), not from the active doc, for the auto-backup", async () => {
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(makeRecord("B"));
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("B"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const load = vi.fn().mockResolvedValue(CURRENT_B_BYTES);
    const opts: SnapRestoreOpts = {
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(), currentWords: 0,
      set: vi.fn(), load, save: vi.fn().mockResolvedValue(undefined), reloadScene: vi.fn(),
    };
    await snapRestore(opts, "snap-1");

    // The non-active path must fetch B's bytes from persistent storage (load), not encode the live doc.
    expect(load).toHaveBeenCalledWith("B");
  });
});

// ─── active-scene path ───────────────────────────────────────────────────────

describe("snapRestore — active-scene path (target scene === active scene)", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("persists restored bytes to store BEFORE calling reloadScene (ordering is load-bearing)", async () => {
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(makeRecord("A"));
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("A"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const callOrder: string[] = [];
    const save = vi.fn().mockImplementation(() =>
      Promise.resolve().then(() => { callOrder.push("save"); }),
    );
    const reloadScene = vi.fn().mockImplementation(() => { callOrder.push("reload"); });

    const opts: SnapRestoreOpts = {
      targetSceneId: "A", isActive: true, activeDoc: new Y.Doc(), currentWords: 5,
      set: vi.fn(), load: vi.fn(), save, reloadScene,
    };
    await snapRestore(opts, "snap-1");

    // Reload must not precede the DB write — the scene reload reads from storage.
    expect(callOrder).toStrictEqual(["save", "reload"]);
  });

  it("calls reloadScene with the target id", async () => {
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(makeRecord("A"));
    vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("A"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const reloadScene = vi.fn();
    const opts: SnapRestoreOpts = {
      targetSceneId: "A", isActive: true, activeDoc: new Y.Doc(), currentWords: 5,
      set: vi.fn(), load: vi.fn(), save: vi.fn().mockResolvedValue(undefined), reloadScene,
    };
    await snapRestore(opts, "snap-1");

    expect(reloadScene).toHaveBeenCalledWith("A");
    expect(reloadScene).toHaveBeenCalledTimes(1);
  });

  it("does not call reloadScene when snapshot record is not found", async () => {
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(null);
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const reloadScene = vi.fn();
    const opts: SnapRestoreOpts = {
      targetSceneId: "A", isActive: true, activeDoc: new Y.Doc(), currentWords: 5,
      set: vi.fn(), load: vi.fn(), save: vi.fn(), reloadScene,
    };
    await snapRestore(opts, "snap-missing");

    expect(reloadScene).not.toHaveBeenCalled();
  });
});

// ─── snapCapture target attribution ──────────────────────────────────────────

describe("snapCapture — target attribution", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("attributes takeSnapshot to the targetSceneId, not to a different active scene", async () => {
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("B"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    await snapCapture({
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(), currentWords: 0,
      set: vi.fn(), load: vi.fn().mockResolvedValue(CURRENT_B_BYTES),
    });

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ sceneId: "B" }));
  });
});

// ─── snapTakeFromMenu target attribution ─────────────────────────────────────

describe("snapTakeFromMenu — target attribution (binder context-menu path)", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("attributes takeSnapshot to the binder target id, not the active scene", async () => {
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("B"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    await snapTakeFromMenu({
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(), currentWords: 0,
      set: vi.fn(), setShowHistory: vi.fn(), load: vi.fn().mockResolvedValue(CURRENT_B_BYTES),
    });

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ sceneId: "B" }));
    expect(takeSnapshot).not.toHaveBeenCalledWith(expect.objectContaining({ sceneId: "A" }));
  });
});
