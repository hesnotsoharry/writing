// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 2, Phase 1) — do not modify during implementation.
// Locks the BinderStore + buildTree contract from the consumer's perspective. The implementer
// builds InMemoryBinderStore + buildTree (and the SQLite-backed store + schema/seed/UI separately)
// to satisfy this contract. See roadmap/wave-2-binder.md.
import { describe, expect,it } from "vitest";

import { buildTree } from "../binder/buildTree";
import { InMemoryBinderStore } from "../db/binderStore";

describe("BinderStore + buildTree contract", () => {
  it("loadProject + buildTree returns chapters in sort_order with their scenes, plus short pieces (folder_id null)", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Salt Road", type: "novel" });

    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    const ch2 = await store.createFolder({ projectId, title: "Chapter 2" });

    await store.createScene({ projectId, folderId: ch1, title: "Opening" });
    await store.createScene({ projectId, folderId: ch1, title: "The river" });
    await store.createScene({ projectId, folderId: ch2, title: "Arrival" });
    await store.createScene({ projectId, folderId: null, title: "Stray idea" });

    const { folders, scenes } = await store.loadProject(projectId);
    const tree = buildTree(folders, scenes);

    expect(tree.chapters.map((c) => c.folder.title)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(tree.chapters[0].scenes.map((s) => s.title)).toEqual(["Opening", "The river"]);
    expect(tree.chapters[1].scenes.map((s) => s.title)).toEqual(["Arrival"]);
    expect(tree.shortPieces.map((s) => s.title)).toEqual(["Stray idea"]);
  });

  it("deleting a chapter moves its scenes to short pieces (folder_id null) — prose is never deleted", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Salt Road", type: "novel" });
    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    await store.createScene({ projectId, folderId: ch1, title: "Opening" });

    await store.deleteFolder(ch1);

    const { folders, scenes } = await store.loadProject(projectId);
    const tree = buildTree(folders, scenes);

    expect(tree.chapters).toHaveLength(0);
    expect(tree.shortPieces.map((s) => s.title)).toEqual(["Opening"]);
  });

  it("listProjects returns created projects so a switcher can render them", async () => {
    const store = new InMemoryBinderStore();
    await store.createProject({ title: "Salt Road", type: "novel" });
    await store.createProject({ title: "Collected Stories", type: "collection" });

    const projects = await store.listProjects();
    expect(projects.map((p) => p.title)).toEqual(["Salt Road", "Collected Stories"]);
  });
});

// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 20, Phase 1) — do not modify during implementation.
// Locks the new setSceneSynopsis setter contract (backs editable synopsis in the inspector + corkboard).
describe("BinderStore.setSceneSynopsis contract", () => {
  it("persists a scene's synopsis, readable via loadProject + buildTree", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Salt Road", type: "novel" });
    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    const sceneId = await store.createScene({ projectId, folderId: ch1, title: "Opening" });

    await store.setSceneSynopsis(sceneId, "A traveller arrives at the salt flats.");

    const { folders, scenes } = await store.loadProject(projectId);
    const tree = buildTree(folders, scenes);
    expect(tree.chapters[0].scenes[0].synopsis).toBe("A traveller arrives at the salt flats.");
  });

  it("clears a synopsis when set to null", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Salt Road", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Stray idea" });

    await store.setSceneSynopsis(sceneId, "a temporary draft synopsis");
    await store.setSceneSynopsis(sceneId, null);

    const { folders, scenes } = await store.loadProject(projectId);
    const tree = buildTree(folders, scenes);
    expect(tree.shortPieces[0].synopsis).toBeNull();
  });
});
