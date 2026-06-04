// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 22, Phase 1) — do not modify during implementation.
// Locks the archive store contract from the consumer's perspective.
// Each `it` uses a fresh InMemoryBinderStore — no shared harness state.
import { describe, expect, it } from "vitest";

import { InMemoryBinderStore } from "../db/binderStore";

describe("BinderStore archive contract", () => {
  it("archiveScene removes scene from loadProject and adds it to listArchived; archivedCount increments 0→1", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    const sceneId = await store.createScene({ projectId, folderId: ch1, title: "Opening" });

    expect(await store.archivedCount(projectId)).toBe(0);

    await store.archiveScene(sceneId, projectId);

    const { scenes } = await store.loadProject(projectId);
    expect(scenes.find((s) => s.id === sceneId)).toBeUndefined();

    const archived = await store.listArchived(projectId);
    expect(archived).toHaveLength(1);
    expect(archived[0].originalId).toBe(sceneId);
    expect(archived[0].title).toBe("Opening");
    expect(archived[0].kind).toBe("scene");

    expect(await store.archivedCount(projectId)).toBe(1);
  });

  it("archived scene's sub equals its chapter title; Short-pieces scene's sub is 'Short pieces'", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    const chapterSceneId = await store.createScene({ projectId, folderId: ch1, title: "In Chapter" });
    const shortSceneId = await store.createScene({ projectId, folderId: null, title: "Stray" });

    await store.archiveScene(chapterSceneId, projectId);
    await store.archiveScene(shortSceneId, projectId);

    const archived = await store.listArchived(projectId);
    const chItem = archived.find((a) => a.originalId === chapterSceneId);
    const shortItem = archived.find((a) => a.originalId === shortSceneId);

    expect(chItem?.sub).toBe("Chapter 1");
    expect(shortItem?.sub).toBe("Short pieces");
  });

  it("restoreArchived re-adds the scene to Short pieces and removes it from listArchived; count 1→0", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    const sceneId = await store.createScene({ projectId, folderId: ch1, title: "Opening" });

    await store.archiveScene(sceneId, projectId);
    expect(await store.archivedCount(projectId)).toBe(1);

    const [item] = await store.listArchived(projectId);
    await store.restoreArchived(item.id);

    expect(await store.archivedCount(projectId)).toBe(0);
    const archived = await store.listArchived(projectId);
    expect(archived).toHaveLength(0);

    // Scene reinserted in Short pieces (folder_id null)
    const { scenes } = await store.loadProject(projectId);
    const restored = scenes.find((s) => s.id === sceneId);
    expect(restored).toBeDefined();
    expect(restored?.folder_id).toBeNull();
    expect(restored?.title).toBe("Opening");
  });

  it("archiveChapter removes folder and its scenes; one ArchivedItem with sub '2 scenes'; restore brings folder and all scenes back", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Part I" });
    const s1 = await store.createScene({ projectId, folderId, title: "Scene A" });
    const s2 = await store.createScene({ projectId, folderId, title: "Scene B" });

    await store.archiveChapter(folderId, projectId);

    const { folders, scenes } = await store.loadProject(projectId);
    expect(folders.find((f) => f.id === folderId)).toBeUndefined();
    expect(scenes.find((s) => s.id === s1)).toBeUndefined();
    expect(scenes.find((s) => s.id === s2)).toBeUndefined();

    const archived = await store.listArchived(projectId);
    expect(archived).toHaveLength(1);
    expect(archived[0].kind).toBe("chapter");
    expect(archived[0].sub).toBe("2 scenes");
    expect(archived[0].title).toBe("Part I");

    // Restore
    await store.restoreArchived(archived[0].id);

    const after = await store.loadProject(projectId);
    expect(after.folders.find((f) => f.id === folderId)).toBeDefined();
    expect(after.scenes.find((s) => s.id === s1)?.title).toBe("Scene A");
    expect(after.scenes.find((s) => s.id === s2)?.title).toBe("Scene B");
    expect(await store.archivedCount(projectId)).toBe(0);
  });

  it("purgeArchived removes from listArchived and does NOT reinsert the scene or folder", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Stray" });

    await store.archiveScene(sceneId, projectId);
    const [item] = await store.listArchived(projectId);

    await store.purgeArchived(item.id);

    expect(await store.listArchived(projectId)).toHaveLength(0);
    const { scenes } = await store.loadProject(projectId);
    expect(scenes.find((s) => s.id === sceneId)).toBeUndefined();
  });

  it("listArchived ordering is archivedAt DESC — later archive appears first", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const s1 = await store.createScene({ projectId, folderId: null, title: "First archived" });
    const s2 = await store.createScene({ projectId, folderId: null, title: "Second archived" });

    await store.archiveScene(s1, projectId);
    await store.archiveScene(s2, projectId);

    const archived = await store.listArchived(projectId);
    expect(archived[0].title).toBe("Second archived");
    expect(archived[1].title).toBe("First archived");
  });

  it("archiving a non-existent scene is a silent no-op — no throw, no archive record, scenes unchanged", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Kept" });

    await expect(store.archiveScene("does-not-exist", projectId)).resolves.toBeUndefined();

    expect(await store.archivedCount(projectId)).toBe(0);
    const { scenes } = await store.loadProject(projectId);
    expect(scenes.find((s) => s.id === sceneId)).toBeDefined();
  });

  it("archiving an empty chapter records sub '0 scenes'; restore brings back the folder with no scenes", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Empty Chapter" });

    await store.archiveChapter(folderId, projectId);

    const archived = await store.listArchived(projectId);
    expect(archived).toHaveLength(1);
    expect(archived[0].sub).toBe("0 scenes");

    await store.restoreArchived(archived[0].id);

    const { folders, scenes } = await store.loadProject(projectId);
    expect(folders.find((f) => f.id === folderId)).toBeDefined();
    expect(scenes.filter((s) => s.folder_id === folderId)).toHaveLength(0);
    expect(await store.archivedCount(projectId)).toBe(0);
  });

  it("cross-project isolation — listArchived and archivedCount are scoped per project", async () => {
    const store = new InMemoryBinderStore();
    const pA = await store.createProject({ title: "Project A", type: "novel" });
    const pB = await store.createProject({ title: "Project B", type: "novel" });
    const sA = await store.createScene({ projectId: pA, folderId: null, title: "Scene A" });
    const sB = await store.createScene({ projectId: pB, folderId: null, title: "Scene B" });

    await store.archiveScene(sA, pA);
    await store.archiveScene(sB, pB);

    const archivedA = await store.listArchived(pA);
    expect(archivedA).toHaveLength(1);
    expect(archivedA[0].title).toBe("Scene A");

    const archivedB = await store.listArchived(pB);
    expect(archivedB).toHaveLength(1);
    expect(archivedB[0].title).toBe("Scene B");

    expect(await store.archivedCount(pA)).toBe(1);
    expect(await store.archivedCount(pB)).toBe(1);
  });
});
