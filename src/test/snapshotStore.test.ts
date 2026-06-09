import { describe, expect, it } from "vitest";

import { InMemorySnapshotStore } from "../db/inMemorySnapshotStore";

// ── InMemorySnapshotStore ─────────────────────────────────────────────────────

describe("InMemorySnapshotStore", () => {
  function makeStore() { return new InMemorySnapshotStore(); }

  // ── takeSnapshot ──────────────────────────────────────────────────────────

  it("takeSnapshot returns a Snapshot with the correct fields", async () => {
    const store = makeStore();
    const snap = await store.takeSnapshot({ sceneId: "s1", label: "v1", stateBase64: "abc", wordCount: 42, kind: "manual" });
    expect(snap.sceneId).toBe("s1");
    expect(snap.label).toBe("v1");
    expect(snap.wordCount).toBe(42);
    expect(snap.kind).toBe("manual");
    expect(typeof snap.id).toBe("string");
    expect(snap.createdAt).toBeGreaterThan(0);
  });

  it("takeSnapshot defaults kind to 'manual' when omitted", async () => {
    const store = makeStore();
    const snap = await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: "abc", wordCount: 5 });
    expect(snap.kind).toBe("manual");
  });

  it("takeSnapshot stores auto kind when specified", async () => {
    const store = makeStore();
    const snap = await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: "abc", wordCount: 5, kind: "auto" });
    expect(snap.kind).toBe("auto");
  });

  // ── listSnapshots ─────────────────────────────────────────────────────────

  it("listSnapshots returns empty array when no snapshots exist for a scene", async () => {
    const store = makeStore();
    expect(await store.listSnapshots("missing")).toStrictEqual([]);
  });

  it("listSnapshots returns only snapshots for the requested scene", async () => {
    const store = makeStore();
    await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: "a", wordCount: 1 });
    await store.takeSnapshot({ sceneId: "s2", label: null, stateBase64: "b", wordCount: 2 });
    const list = await store.listSnapshots("s1");
    expect(list).toHaveLength(1);
    expect(list[0].sceneId).toBe("s1");
  });

  it("listSnapshots returns results newest-first", async () => {
    const store = makeStore();
    const a = await store.takeSnapshot({ sceneId: "s1", label: "a", stateBase64: "a", wordCount: 1 });
    const b = await store.takeSnapshot({ sceneId: "s1", label: "b", stateBase64: "b", wordCount: 2 });
    const list = await store.listSnapshots("s1");
    expect(list[0].id === b.id || list[0].createdAt >= list[1].createdAt).toBe(true);
    // Confirm ordering: newer (b) at index 0 or at least non-ascending is impossible
    if (a.createdAt !== b.createdAt) {
      expect(list[0].id).toBe(b.id);
    }
  });

  // ── getSnapshot ───────────────────────────────────────────────────────────

  it("getSnapshot returns null for an unknown id", async () => {
    const store = makeStore();
    expect(await store.getSnapshot("nope")).toBeNull();
  });

  it("getSnapshot returns the meta and stateBase64 for a known id", async () => {
    const store = makeStore();
    const snap = await store.takeSnapshot({ sceneId: "s1", label: "lbl", stateBase64: "payload", wordCount: 7 });
    const result = await store.getSnapshot(snap.id);
    expect(result).not.toBeNull();
    expect(result!.stateBase64).toBe("payload");
    expect(result!.meta.id).toBe(snap.id);
  });

  // ── renameSnapshot ────────────────────────────────────────────────────────

  it("renameSnapshot updates the label for an existing snapshot", async () => {
    const store = makeStore();
    const snap = await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: "x", wordCount: 1 });
    await store.renameSnapshot(snap.id, "new name");
    const list = await store.listSnapshots("s1");
    expect(list[0].label).toBe("new name");
  });

  it("renameSnapshot is a no-op for an unknown id", async () => {
    const store = makeStore();
    await expect(store.renameSnapshot("unknown", "x")).resolves.toBeUndefined();
  });

  // ── deleteSnapshot ────────────────────────────────────────────────────────

  it("deleteSnapshot removes the snapshot so it no longer appears in list", async () => {
    const store = makeStore();
    const snap = await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: "x", wordCount: 1 });
    await store.deleteSnapshot(snap.id);
    expect(await store.listSnapshots("s1")).toHaveLength(0);
  });

  it("deleteSnapshot is a no-op for an unknown id", async () => {
    const store = makeStore();
    await expect(store.deleteSnapshot("unknown")).resolves.toBeUndefined();
  });

  // ── pruneAuto ─────────────────────────────────────────────────────────────

  it("pruneAuto keeps the N newest auto-snapshots and deletes the rest", async () => {
    const store = makeStore();
    for (let i = 0; i < 5; i++) {
      await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: `s${i}`, wordCount: i, kind: "auto" });
    }
    await store.pruneAuto("s1", 2);
    const list = await store.listSnapshots("s1");
    expect(list).toHaveLength(2);
    expect(list.every((s) => s.kind === "auto")).toBe(true);
  });

  it("pruneAuto does not delete manual snapshots", async () => {
    const store = makeStore();
    await store.takeSnapshot({ sceneId: "s1", label: "manual", stateBase64: "m", wordCount: 1, kind: "manual" });
    for (let i = 0; i < 3; i++) {
      await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: `a${i}`, wordCount: i, kind: "auto" });
    }
    await store.pruneAuto("s1", 1);
    const list = await store.listSnapshots("s1");
    const manual = list.filter((s) => s.kind === "manual");
    const auto = list.filter((s) => s.kind === "auto");
    expect(manual).toHaveLength(1);
    expect(auto).toHaveLength(1);
  });

  it("pruneAuto with keepN >= count leaves all snapshots", async () => {
    const store = makeStore();
    for (let i = 0; i < 3; i++) {
      await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: `a${i}`, wordCount: i, kind: "auto" });
    }
    await store.pruneAuto("s1", 10);
    expect(await store.listSnapshots("s1")).toHaveLength(3);
  });

  it("pruneAuto with keepN = 0 (unlimited) leaves all auto-snapshots untouched", async () => {
    const store = makeStore();
    for (let i = 0; i < 4; i++) {
      await store.takeSnapshot({ sceneId: "s1", label: null, stateBase64: `a${i}`, wordCount: i, kind: "auto" });
    }
    await store.pruneAuto("s1", 0);
    expect(await store.listSnapshots("s1")).toHaveLength(4);
  });
});
