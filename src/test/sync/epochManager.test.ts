import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { SceneDocStore } from "../../db/sceneDocStore";
import type { AppliedEpochStore } from "../../db/syncEpochStore";
import { EpochManager } from "../../sync/epochManager";
import {
  buildFromSql, bumpEpoch, type EpochStamp,
getEpoch, } from "../../sync/meta/metaDoc";

class EmptySceneStore implements SceneDocStore {
  async listAll(): Promise<[]> { return []; }
  async load(): Promise<string | null> { return null; }
  async save(): Promise<void> { return; }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(): Promise<void> { return; }
}

class MemoryEpochStore implements AppliedEpochStore {
  constructor(private value: Record<string, EpochStamp> = {}) {}
  async load(): Promise<Record<string, EpochStamp>> { return structuredClone(this.value); }
  async save(value: Record<string, EpochStamp>): Promise<void> {
    this.value = structuredClone(value);
  }
}

function makeManager(store = new MemoryEpochStore()): EpochManager {
  return new EpochManager({
    sceneStore: new EmptySceneStore(), epochStore: store,
    updateWordCount: () => Promise.resolve(),
  });
}

function emptyMeta(): Y.Doc {
  return buildFromSql({ folders: [], scenes: [], labels: [], sceneLabels: [] });
}

describe("EpochManager ownership", () => {
  it("makes exactly the losing concurrent restorer behind after meta convergence", async () => {
    const base = Y.encodeStateAsUpdate(emptyMeta());
    const leftDoc = new Y.Doc(); const rightDoc = new Y.Doc();
    Y.applyUpdate(leftDoc, base); Y.applyUpdate(rightDoc, base);
    const leftLocal = bumpEpoch(leftDoc, "scene-1", "device-a");
    const rightLocal = bumpEpoch(rightDoc, "scene-1", "device-b");
    const left = makeManager(); const right = makeManager();
    await left.initialize("device-a"); await right.initialize("device-b");
    await left.recordLocal({ "scene-1": leftLocal });
    await right.recordLocal({ "scene-1": rightLocal });

    const leftUpdate = Y.encodeStateAsUpdate(leftDoc);
    const rightUpdate = Y.encodeStateAsUpdate(rightDoc);
    Y.applyUpdate(leftDoc, rightUpdate); Y.applyUpdate(rightDoc, leftUpdate);
    left.readMetaUpdate(Y.encodeStateAsUpdate(leftDoc));
    right.readMetaUpdate(Y.encodeStateAsUpdate(rightDoc));

    const winner = getEpoch(leftDoc, "scene-1").d;
    expect(getEpoch(rightDoc, "scene-1")).toEqual(getEpoch(leftDoc, "scene-1"));
    expect({ "device-a": left.isBehind("scene-1"), "device-b": right.isBehind("scene-1") })
      .toEqual({ "device-a": winner !== "device-a", "device-b": winner !== "device-b" });
    expect([left.isBehind("scene-1"), right.isBehind("scene-1")].filter(Boolean)).toHaveLength(1);
  });

  it("treats legacy numeric known and applied epochs as wildcard-owned", async () => {
    const rawMeta = new Y.Doc();
    rawMeta.getMap<unknown>("docEpochs").set("scene-1", 2);
    const manager = makeManager(new MemoryEpochStore({ "scene-1": { n: 2, d: "" } }));
    await manager.initialize("device-a");
    manager.readMetaUpdate(Y.encodeStateAsUpdate(rawMeta));
    expect(manager.isBehind("scene-1")).toBe(false);
    expect(manager.accepts("scene-1", 2)).toBe(true);
  });
});

describe("EpochManager ownership self-heal (audit P1.8)", () => {
  it("adopts a converged stamp naming THIS device instead of reporting behind", async () => {
    // The applied write from recordLocal was lost (crash between the meta-doc
    // and app_meta commits, or a restore while the engine was down): the meta
    // doc names this device as the restorer, but applied is empty.
    const store = new MemoryEpochStore();
    const manager = makeManager(store);
    await manager.initialize("device-a");
    const doc = emptyMeta();
    bumpEpoch(doc, "scene-1", "device-a");
    const newlyBehind = manager.readMetaUpdate(Y.encodeStateAsUpdate(doc), "p1");
    expect(newlyBehind).toEqual([]);
    expect(manager.isBehind("scene-1")).toBe(false);
    const persisted = await store.load();
    expect(persisted["scene-1"]).toMatchObject({ d: "device-a" });
  });

  it("still reports behind when the converged owner is another device", async () => {
    const manager = makeManager();
    await manager.initialize("device-a");
    const doc = emptyMeta();
    bumpEpoch(doc, "scene-1", "device-b");
    const newlyBehind = manager.readMetaUpdate(Y.encodeStateAsUpdate(doc), "p1");
    expect(newlyBehind).toEqual(["scene-1"]);
    expect(manager.isBehind("scene-1")).toBe(true);
  });
});
