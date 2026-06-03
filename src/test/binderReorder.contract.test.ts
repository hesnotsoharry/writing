// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 2, Phase 4 — drag-reorder) — do not modify during impl.
// Locks the BinderStore reorder contract: moveScene(sceneId, toFolderId, toIndex) and
// moveFolder(folderId, toIndex). The gap-based sort_order math is an internal detail; this test
// pins the OBSERVABLE result — the order/placement that loadProject + buildTree yield after a move.
// See roadmap/wave-2-binder.md Phase 4.
import { describe, expect, it } from "vitest";

import { buildTree } from "../binder/buildTree";
import { InMemoryBinderStore } from "../db/binderStore";

async function setup() {
  const store = new InMemoryBinderStore();
  const projectId = await store.createProject({ title: "P", type: "novel" });
  const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
  const ch2 = await store.createFolder({ projectId, title: "Chapter 2" });
  const a = await store.createScene({ projectId, folderId: ch1, title: "A" });
  const b = await store.createScene({ projectId, folderId: ch1, title: "B" });
  const c = await store.createScene({ projectId, folderId: ch1, title: "C" });
  return { store, projectId, ch1, ch2, a, b, c };
}

async function treeOf(store: InMemoryBinderStore, projectId: string) {
  const { folders, scenes } = await store.loadProject(projectId);
  return buildTree(folders, scenes);
}

describe("BinderStore reorder contract (Phase 4)", () => {
  it("moveScene reorders scenes within a chapter", async () => {
    const { store, projectId, ch1, c } = await setup();
    await store.moveScene(c, ch1, 0); // C to the front of Chapter 1
    const t = await treeOf(store, projectId);
    expect(t.chapters[0].scenes.map((s) => s.title)).toEqual(["C", "A", "B"]);
  });

  it("moveScene moves a scene into another chapter at a position", async () => {
    const { store, projectId, ch2, a } = await setup();
    await store.moveScene(a, ch2, 0); // A: Chapter 1 -> Chapter 2 front
    const t = await treeOf(store, projectId);
    expect(t.chapters[0].scenes.map((s) => s.title)).toEqual(["B", "C"]);
    expect(t.chapters[1].scenes.map((s) => s.title)).toEqual(["A"]);
  });

  it("moveScene moves a scene to Short pieces (null folder)", async () => {
    const { store, projectId, b } = await setup();
    await store.moveScene(b, null, 0);
    const t = await treeOf(store, projectId);
    expect(t.chapters[0].scenes.map((s) => s.title)).toEqual(["A", "C"]);
    expect(t.shortPieces.map((s) => s.title)).toEqual(["B"]);
  });

  it("moveFolder reorders chapters", async () => {
    const { store, projectId, ch2 } = await setup();
    await store.moveFolder(ch2, 0); // Chapter 2 to the front
    const t = await treeOf(store, projectId);
    expect(t.chapters.map((ch) => ch.folder.title)).toEqual([
      "Chapter 2",
      "Chapter 1",
    ]);
  });
});
