/**
 * Wave 26 Phase 2 — post-panel fixes.
 *
 * Covers:
 *  (a) backfillWordCounts: populates word_count=0 scenes from persisted
 *      plaintext_projection; skips scenes that already have a non-zero count;
 *      skips scenes with no stored projection.
 *  (b) setSceneWordCount return value: true when a row was updated, false when
 *      the sceneId is not found (deleted scene guard — Fix 4).
 *  (c) no-op path: onWordCountPersisted must not fire when setSceneWordCount
 *      returns false.
 */
import { describe, expect, it, vi } from "vitest";

import { InMemoryBinderStore } from "../db/inMemoryBinderStore";
import { InMemorySceneDocStore } from "../db/sceneDocStore";

// ---------------------------------------------------------------------------
// Inline re-implementation of backfillWordCounts so this unit-test file is
// independent of the App module (which has Tauri/React imports that fail in
// Vitest's jsdom environment).  The logic is identical to the function in
// App.tsx — if that function changes, update both.
// ---------------------------------------------------------------------------

async function backfillWordCounts(
  projectId: string,
  binderStore: InMemoryBinderStore,
  sceneDocStore: InMemorySceneDocStore
): Promise<number> {
  const { scenes } = await binderStore.loadProject(projectId);
  const zeroes = scenes.filter((s) => s.word_count === 0);
  if (zeroes.length === 0) return 0;

  let updated = 0;
  await Promise.all(
    zeroes.map(async (scene) => {
      const projection = await sceneDocStore.loadProjection(scene.id);
      if (!projection) return;
      const wordCount = projection.trim()
        ? projection.trim().split(/\s+/).filter(Boolean).length
        : 0;
      if (wordCount === 0) return;
      const changed = await binderStore.setSceneWordCount(scene.id, wordCount);
      if (changed) updated += 1;
    })
  );
  return updated;
}

// ---------------------------------------------------------------------------
// Tests: setSceneWordCount return value (Fix 4)
// ---------------------------------------------------------------------------

describe("InMemoryBinderStore.setSceneWordCount return value", () => {
  it("returns true when the sceneId exists and the row was updated", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Scene" });

    const changed = await store.setSceneWordCount(sceneId, 42);

    expect(changed).toBe(true);
  });

  it("returns false when the sceneId does not exist (deleted scene guard)", async () => {
    const store = new InMemoryBinderStore();
    await store.createProject({ title: "Novel", type: "novel" });

    const changed = await store.setSceneWordCount("non-existent-id", 100);

    expect(changed).toBe(false);
  });

  it("does not mutate other scenes when returning false for a missing id", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Scene" });
    await store.setSceneWordCount(sceneId, 200);

    await store.setSceneWordCount("ghost-id", 999);

    const { scenes } = await store.loadProject(projectId);
    expect(scenes[0].word_count).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Tests: backfillWordCounts (Fix 1)
// ---------------------------------------------------------------------------

describe("backfillWordCounts", () => {
  it("populates word_count=0 scenes from their stored plaintext_projection", async () => {
    const binderStore = new InMemoryBinderStore();
    const sceneDocStore = new InMemorySceneDocStore();
    const projectId = await binderStore.createProject({ title: "Novel", type: "novel" });
    const sceneId = await binderStore.createScene({ projectId, folderId: null, title: "Scene" });

    // Simulate a scene_doc saved before Phase 2 (projection exists; word_count is 0).
    await sceneDocStore.save(sceneId, "base64stub", "the quick brown fox jumps over the lazy dog");

    const count = await backfillWordCounts(projectId, binderStore, sceneDocStore);

    expect(count).toBe(1);
    const { scenes } = await binderStore.loadProject(projectId);
    // "the quick brown fox jumps over the lazy dog" = 9 words
    expect(scenes[0].word_count).toBe(9);
  });

  it("skips scenes that already have a non-zero word_count (idempotent guard)", async () => {
    const binderStore = new InMemoryBinderStore();
    const sceneDocStore = new InMemorySceneDocStore();
    const projectId = await binderStore.createProject({ title: "Novel", type: "novel" });
    const sceneId = await binderStore.createScene({ projectId, folderId: null, title: "Scene" });

    // Pre-populate with a real count (simulates a scene already backfilled).
    await binderStore.setSceneWordCount(sceneId, 50);
    await sceneDocStore.save(sceneId, "base64stub", "some other text entirely different");

    const count = await backfillWordCounts(projectId, binderStore, sceneDocStore);

    // Nothing updated — scene already had a non-zero count.
    expect(count).toBe(0);
    const { scenes } = await binderStore.loadProject(projectId);
    // word_count unchanged at 50.
    expect(scenes[0].word_count).toBe(50);
  });

  it("skips scenes with no stored plaintext_projection (no prose yet saved)", async () => {
    const binderStore = new InMemoryBinderStore();
    const sceneDocStore = new InMemorySceneDocStore();
    const projectId = await binderStore.createProject({ title: "Novel", type: "novel" });
    await binderStore.createScene({ projectId, folderId: null, title: "Brand new scene" });
    // No save to sceneDocStore — projection is null.

    const count = await backfillWordCounts(projectId, binderStore, sceneDocStore);

    expect(count).toBe(0);
  });

  it("returns 0 and leaves counts unchanged when all scenes already have non-zero counts", async () => {
    const binderStore = new InMemoryBinderStore();
    const sceneDocStore = new InMemorySceneDocStore();
    const projectId = await binderStore.createProject({ title: "Novel", type: "novel" });
    const s1 = await binderStore.createScene({ projectId, folderId: null, title: "S1" });
    const s2 = await binderStore.createScene({ projectId, folderId: null, title: "S2" });
    await binderStore.setSceneWordCount(s1, 100);
    await binderStore.setSceneWordCount(s2, 200);

    const count = await backfillWordCounts(projectId, binderStore, sceneDocStore);

    expect(count).toBe(0);
    const { scenes } = await binderStore.loadProject(projectId);
    const total = scenes.reduce((sum, s) => sum + s.word_count, 0);
    expect(total).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Tests: no-op guard — onWordCountPersisted must not fire for deleted scenes
// ---------------------------------------------------------------------------

describe("setSceneWordCount no-op guard", () => {
  it("does not call onWordCountPersisted when setSceneWordCount returns false", async () => {
    // Simulates the App.detection.ts path: the callback only fires reloadTree
    // when the store reports a row was actually changed.
    const store = new InMemoryBinderStore();
    const onWordCountPersisted = vi.fn();

    // Wire up the guard logic inline (mirrors App.detection.ts).
    const persist = async (sceneId: string, wordCount: number) => {
      const changed = await store.setSceneWordCount(sceneId, wordCount);
      if (changed) onWordCountPersisted();
    };

    // Non-existent sceneId (deleted scene scenario).
    await persist("deleted-scene-id", 55);

    expect(onWordCountPersisted).not.toHaveBeenCalled();
  });

  it("calls onWordCountPersisted exactly once when setSceneWordCount returns true", async () => {
    const store = new InMemoryBinderStore();
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Scene" });
    const onWordCountPersisted = vi.fn();

    const persist = async (id: string, wordCount: number) => {
      const changed = await store.setSceneWordCount(id, wordCount);
      if (changed) onWordCountPersisted();
    };

    await persist(sceneId, 77);

    expect(onWordCountPersisted).toHaveBeenCalledTimes(1);
  });
});
