// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 2, Phase 2 — CRUD) — do not modify during implementation.
// Locks the new BinderStore write contract: renameFolder, renameScene, deleteScene.
// (createProject/createFolder/createScene/deleteFolder + delete-chapter→Short-pieces are
// already covered by binderStore.contract.test.ts.) See roadmap/wave-2-binder.md Phase 2.
import { describe, expect, it } from "vitest";

import { InMemoryBinderStore } from "../db/binderStore";

describe("BinderStore CRUD contract (Phase 2)", () => {
  it("renameFolder changes a chapter's title", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "P", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Chapter 1" });

    await store.renameFolder(folderId, "Act One");

    const { folders } = await store.loadProject(projectId);
    expect(folders.find((f) => f.id === folderId)?.title).toBe("Act One");
  });

  it("renameScene changes a scene's title", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "P", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Ch" });
    const sceneId = await store.createScene({ projectId, folderId, title: "Old title" });

    await store.renameScene(sceneId, "New title");

    const { scenes } = await store.loadProject(projectId);
    expect(scenes.find((s) => s.id === sceneId)?.title).toBe("New title");
  });

  it("deleteScene removes the scene from the project", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "P", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Ch" });
    const keep = await store.createScene({ projectId, folderId, title: "Keep" });
    const doomed = await store.createScene({ projectId, folderId, title: "Doomed" });

    await store.deleteScene(doomed);

    const { scenes } = await store.loadProject(projectId);
    expect(scenes.find((s) => s.id === doomed)).toBeUndefined();
    expect(scenes.find((s) => s.id === keep)?.title).toBe("Keep");
  });
});
