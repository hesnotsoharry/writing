import { describe, expect, it, vi } from "vitest";

import { parseArchiveManifest, restoreArchivePlan } from "./archiveRestore";

describe("archive restore manifests", () => {
  it("parses a desktop scene manifest", () => {
    const plan = parseArchiveManifest({ id: "a", projectId: "p", kind: "scene", originalId: "s", title: "Scene", stateBase64: JSON.stringify({ meta: { synopsis: "syn", status: "draft", sort_order: 20, word_count: 44 }, doc: "bytes" }) });
    expect(plan.folder).toBeNull(); expect(plan.scenes).toEqual([{ id: "s", title: "Scene", synopsis: "syn", status: "draft", sortOrder: 20, wordCount: 44, stateBase64: "bytes", folderId: null }]);
  });

  it("parses a multi-scene desktop chapter manifest", () => {
    const scenes = [{ id: "s1", title: "One", meta: { synopsis: null, status: "blank", sort_order: 10, word_count: 1 }, doc: "d1" }, { id: "s2", title: "Two", meta: { synopsis: "two", status: "final", sort_order: 20, word_count: 2 }, doc: "d2" }];
    const plan = parseArchiveManifest({ id: "a", projectId: "p", kind: "chapter", originalId: "f", title: "Chapter", stateBase64: JSON.stringify({ folder: { sort_order: 7 }, scenes }) });
    expect(plan.folder).toEqual({ id: "f", title: "Chapter", sortOrder: 7 }); expect(plan.scenes.map(({ id, folderId }) => [id, folderId])).toEqual([["s1", "f"], ["s2", "f"]]);
  });

  it("publishes binder/meta before handing every scene through epoch ownership", async () => {
    const order: string[] = []; const replace = vi.fn(async (scene: { id: string }) => { order.push(`epoch:${scene.id}`); });
    const plan = parseArchiveManifest({ id: "a", projectId: "p", kind: "chapter", originalId: "f", title: "Chapter", stateBase64: JSON.stringify({ scenes: [{ id: "s1", title: "One", doc: "d1" }, { id: "s2", title: "Two", doc: "d2" }] }) });
    await restoreArchivePlan({ publishBinderMeta: async () => { order.push("meta"); }, replaceThroughEpoch: replace, removeArchiveRow: async () => { order.push("remove"); } }, plan);
    expect(order).toEqual(["meta", "epoch:s1", "epoch:s2", "remove"]); expect(replace).toHaveBeenCalledTimes(2);
  });
});
