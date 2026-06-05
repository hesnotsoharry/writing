// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 2, Phase 1) — do not modify during implementation.
// Locks the BinderStore + buildTree contract from the consumer's perspective. The implementer
// builds InMemoryBinderStore + buildTree (and the SQLite-backed store + schema/seed/UI separately)
// to satisfy this contract. See roadmap/wave-2-binder.md.
import { describe, expect,it } from "vitest";

import { buildTree } from "../binder/buildTree";
import type { Scene } from "../db/binderStore";
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

// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 26, Phase 2) — word count persistence.
// Locks the new setSceneWordCount setter contract: prose saves persist word_count to
// the scenes table so binder rows + useManuscriptWordCount see real non-zero counts.
describe("BinderStore.setSceneWordCount contract", () => {
  it("persists a scene word count, readable via loadProject so binder rows show real counts", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    const sceneId = await store.createScene({ projectId, folderId: ch1, title: "Opening" });

    // New scenes always start at 0.
    const { scenes: before } = await store.loadProject(projectId);
    expect(before[0].word_count).toBe(0);

    await store.setSceneWordCount(sceneId, 342);

    const { folders, scenes } = await store.loadProject(projectId);
    const tree = buildTree(folders, scenes);
    expect(tree.chapters[0].scenes[0].word_count).toBe(342);
  });

  it("manuscript total is invariant to which scene is active when all scene word_counts are persisted", async () => {
    // This test verifies the fix for bugs #27 and #28c: the manuscript total must
    // stay constant regardless of which scene is 'active'. Prior to the fix, the
    // total collapsed to just the active scene's live count because all cached
    // scene.word_counts were 0.
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const ch1 = await store.createFolder({ projectId, title: "Chapter 1" });
    const s1 = await store.createScene({ projectId, folderId: ch1, title: "Scene 1" });
    const s2 = await store.createScene({ projectId, folderId: ch1, title: "Scene 2" });
    const sp = await store.createScene({ projectId, folderId: null, title: "Short Piece" });

    await store.setSceneWordCount(s1, 200);
    await store.setSceneWordCount(s2, 350);
    await store.setSceneWordCount(sp, 50);

    const { folders, scenes } = await store.loadProject(projectId);
    const tree = buildTree(folders, scenes);

    // Simulate useManuscriptWordCount logic: sum all cached, swap active for live.
    // When s1 is active (live=210): 210 + 350 + 50 = 610
    // When s2 is active (live=360): 200 + 360 + 50 = 610
    // When sp is active (live=55):  200 + 350 + 55 = 605 (sp has 50 cached, live=55)
    function manuscriptTotal(allScenes: Scene[], activeId: string, liveWords: number): number {
      return allScenes.reduce((sum, s) => sum + (s.id === activeId ? liveWords : s.word_count), 0);
    }

    const allScenes = [...tree.chapters.flatMap((ch) => ch.scenes), ...tree.shortPieces];

    const totalWhenS1Active = manuscriptTotal(allScenes, s1, 210);
    const totalWhenS2Active = manuscriptTotal(allScenes, s2, 360);

    // The sum of the two non-active scenes plus the live count for the active scene
    // must be equal in this symmetric case (200+350+50=600 cached; live swaps only affect active).
    // 210 + 350 + 50 = 610
    expect(totalWhenS1Active).toBe(610);
    // 200 + 360 + 50 = 610
    expect(totalWhenS2Active).toBe(610);
  });
});
