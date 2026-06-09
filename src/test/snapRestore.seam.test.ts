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
import { backfillSnapshotWordCounts, reloadSnapshotList, snapCapture, snapRestore, snapshotStore, snapTakeFromMenu } from "../App.snapshots";
import { InMemorySnapshotStore } from "../db/inMemorySnapshotStore";
import type { Snapshot } from "../db/snapshotStore";
import { encodeDoc } from "../yjs/serialize";

const RESTORED_BYTES = "cmVzdG9yZWQ="; // stable placeholder — exact Yjs bytes not load-bearing at this seam

/** Build a Y.Doc with a single paragraph containing the given text. */
function docWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const p = new Y.XmlElement("paragraph");
  const t = new Y.XmlText();
  t.insert(0, text);
  p.insert(0, [t]);
  frag.insert(0, [p]);
  return doc;
}
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
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(),
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
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(),
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
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(),
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
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(),
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
      targetSceneId: "A", isActive: true, activeDoc: new Y.Doc(),
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
      targetSceneId: "A", isActive: true, activeDoc: new Y.Doc(),
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
      targetSceneId: "A", isActive: true, activeDoc: new Y.Doc(),
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
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(),
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
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(),
      set: vi.fn(), setShowHistory: vi.fn(), load: vi.fn().mockResolvedValue(CURRENT_B_BYTES),
    });

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ sceneId: "B" }));
    expect(takeSnapshot).not.toHaveBeenCalledWith(expect.objectContaining({ sceneId: "A" }));
  });
});

// ─── wordCount derived from persisted content (not caller-supplied) ───────────

describe("snapCapture — wordCount derives from persisted content", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("persists wordCount computed from the active doc's content (active-scene path)", async () => {
    const doc = docWithText("hello world");  // 2 words
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("s1"));

    await snapCapture({
      targetSceneId: "s1", isActive: true, activeDoc: doc,
      set: vi.fn(), load: vi.fn(),
    });

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 2 }));
  });

  it("persists wordCount computed from stored bytes for a non-active scene", async () => {
    const doc = docWithText("three word scene");  // 3 words
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("s2"));

    await snapCapture({
      targetSceneId: "s2", isActive: false, activeDoc: null,
      set: vi.fn(), load: vi.fn().mockResolvedValue(encodeDoc(doc)),
    });

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 3 }));
  });
});

describe("snapRestore — pre-restore backup derives wordCount from stored bytes", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("pre-restore auto-backup uses wordCount from the target scene's bytes (non-active path)", async () => {
    const doc = docWithText("five word backup content");  // 4 words
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue(makeRecord("B"));
    const takeSnapshot = vi.spyOn(snapshotStore, "takeSnapshot").mockResolvedValue(makeSnapshot("B"));
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([]);

    const opts: SnapRestoreOpts = {
      targetSceneId: "B", isActive: false, activeDoc: new Y.Doc(),
      set: vi.fn(), load: vi.fn().mockResolvedValue(encodeDoc(doc)),
      save: vi.fn().mockResolvedValue(undefined), reloadScene: vi.fn(),
    };
    await snapRestore(opts, "snap-1");

    expect(takeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ wordCount: 4 }));
  });
});

// ─── backfillSnapshotWordCounts ───────────────────────────────────────────────

describe("backfillSnapshotWordCounts", () => {
  it("updates wordCount for a 0-count row that has real content", async () => {
    const store = new InMemorySnapshotStore();
    const doc = docWithText("hello world three");  // 3 words
    await store.takeSnapshot({
      sceneId: "s1", label: null, stateBase64: encodeDoc(doc), wordCount: 0, kind: "auto",
    });

    await backfillSnapshotWordCounts(store, "s1", vi.fn());

    const list = await store.listSnapshots("s1");
    expect(list[0].wordCount).toBe(3);
  });

  it("leaves a genuinely-empty row with wordCount=0 unchanged and does not call set", async () => {
    const store = new InMemorySnapshotStore();
    const emptyDoc = new Y.Doc();  // no content — wordCount must stay 0
    await store.takeSnapshot({
      sceneId: "s1", label: null, stateBase64: encodeDoc(emptyDoc), wordCount: 0, kind: "auto",
    });

    const set = vi.fn();
    await backfillSnapshotWordCounts(store, "s1", set);

    const list = await store.listSnapshots("s1");
    expect(list[0].wordCount).toBe(0);
    expect(set).not.toHaveBeenCalled();
  });
});

// ─── reloadSnapshotList — backfill wiring (regression: modal-open path) ───────
// This test uses the module-level snapshotStore singleton (not InMemorySnapshotStore)
// to cover the real production path. The prior tests only covered the pure function;
// this catches wiring gaps where reloadSnapshotList doesn't invoke the backfill.

describe("reloadSnapshotList — invokes backfill for zero-wordCount rows", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("calls updateWordCount for a zero-wordCount row with real content", async () => {
    const doc = docWithText("hello world");  // 2 words
    vi.spyOn(snapshotStore, "listSnapshots").mockResolvedValue([
      { id: "snap-1", sceneId: "s1", label: null, wordCount: 0, createdAt: 0, kind: "auto" },
    ]);
    vi.spyOn(snapshotStore, "getSnapshot").mockResolvedValue({
      meta: { id: "snap-1", sceneId: "s1", label: null, wordCount: 0, createdAt: 0, kind: "auto" },
      stateBase64: encodeDoc(doc),
    });
    const updateWordCount = vi.spyOn(snapshotStore, "updateWordCount").mockResolvedValue();

    reloadSnapshotList("s1", vi.fn());

    // All mocks resolve synchronously — flush the promise microtask queue
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(updateWordCount).toHaveBeenCalledWith("snap-1", 2);
  });
});
