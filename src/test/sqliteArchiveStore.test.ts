/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 22, Phase 2) — do not modify during implementation.
 *
 * SqlJs-backed round-trip tests for the six archive methods on SqliteBinderStore.
 * Strategy: vi.mock("../db/schema") replaces getDb with one returning a single
 * shared sql.js DB (created via makeSqlJsDb() + runMigrations(db) in beforeEach).
 * All SQL goes through the real sql.js engine — no Tauri runtime required.
 *
 * Covers:
 *   1. Scene round-trip: archiveScene snapshots doc byte-identically; restoreArchived recreates scene+doc with same status/synopsis.
 *   2. Chapter atomic round-trip: archiveChapter + restoreArchived reproduces folder + 2 scenes with byte-identical docs, statuses, synopses.
 *   3. purgeArchived: removes the archive row and does NOT recreate any scene.
 *   4. archiveScene non-existent id: silent no-op, archivedCount stays 0.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

vi.mock("../db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/schema")>();
  return {
    ...actual,
    getDb: vi.fn(),
  };
});

import { getDb } from "../db/schema";
import { SqliteBinderStore } from "../db/sqliteBinderStore";
import { SqliteSceneDocStore } from "../db/sqliteSceneDocStore";

let db: SqlJsTestDb;
let store: SqliteBinderStore;
let docStore: SqliteSceneDocStore;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  store = new SqliteBinderStore();
  docStore = new SqliteSceneDocStore();
});

afterEach(() => {
  db.close();
  vi.clearAllMocks();
});

describe("SqliteBinderStore archive — scene round-trip", () => {
  it("archiveScene snapshots doc byte-identically; scene+doc absent after archive; restoreArchived recreates both with same status+synopsis", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Act One" });
    const sceneId = await store.createScene({ projectId, folderId, title: "Opening" });
    await store.setSceneStatus(sceneId, "draft");
    await store.setSceneSynopsis(sceneId, "The world before the storm.");
    const DOC_BASE64 = "aGVsbG8gd29ybGQ="; // recognizable base64 string
    await docStore.save(sceneId, DOC_BASE64, null);

    await store.archiveScene(sceneId, projectId);

    // Scene and doc gone from the binder.
    const { scenes } = await store.loadProject(projectId);
    expect(scenes.find((s) => s.id === sceneId)).toBeUndefined();

    const docAfterArchive = await docStore.load(sceneId);
    expect(docAfterArchive).toBeNull();

    // One archive item with correct title + sub.
    const archived = await store.listArchived(projectId);
    expect(archived).toHaveLength(1);
    expect(archived[0].title).toBe("Opening");
    expect(archived[0].sub).toBe("Act One");
    expect(archived[0].kind).toBe("scene");
    expect(archived[0].originalId).toBe(sceneId);
    expect(await store.archivedCount(projectId)).toBe(1);

    // Restore.
    await store.restoreArchived(archived[0].id);

    // Scene back with byte-identical doc, same status and synopsis.
    const { scenes: afterScenes } = await store.loadProject(projectId);
    const restored = afterScenes.find((s) => s.id === sceneId);
    expect(restored).toBeDefined();
    expect(restored?.title).toBe("Opening");
    expect(restored?.status).toBe("draft");
    expect(restored?.synopsis).toBe("The world before the storm.");

    const restoredDoc = await docStore.load(sceneId);
    expect(restoredDoc).toBe(DOC_BASE64);

    // Archive bin empty.
    expect(await store.listArchived(projectId)).toHaveLength(0);
  });
});

describe("SqliteBinderStore archive — chapter atomic round-trip", () => {
  // Shared fixture state populated in beforeEach so each `it` stays under
  // the 40-line / complexity-10 limit.
  let projectId: string;
  let folderId: string;
  let s1: string;
  let s2: string;
  const DOC1 = "Zmlyc3QgZG9j";     // distinct base64 for scene 1
  const DOC2 = "c2Vjb25kIGRvYw=="; // distinct base64 for scene 2
  let folderSortOrder: number;
  let s1SortOrder: number;
  let s2SortOrder: number;

  beforeEach(async () => {
    projectId = await store.createProject({ title: "Epic", type: "novel" });
    folderId = await store.createFolder({ projectId, title: "Part I" });
    s1 = await store.createScene({ projectId, folderId, title: "Scene Alpha" });
    s2 = await store.createScene({ projectId, folderId, title: "Scene Beta" });
    await store.setSceneStatus(s1, "outline");
    await store.setSceneSynopsis(s1, "The beginning.");
    await docStore.save(s1, DOC1, null);
    await store.setSceneStatus(s2, "revise");
    await store.setSceneSynopsis(s2, "The middle.");
    await docStore.save(s2, DOC2, null);
    // Capture sort_orders before archiving to assert numeric round-trip.
    const pre = await store.loadProject(projectId);
    folderSortOrder = pre.folders.find((f) => f.id === folderId)!.sort_order;
    s1SortOrder = pre.scenes.find((s) => s.id === s1)!.sort_order;
    s2SortOrder = pre.scenes.find((s) => s.id === s2)!.sort_order;
  });

  it("archiveChapter removes folder + both scenes + docs; produces one chapter item with sub '2 scenes'", async () => {
    await store.archiveChapter(folderId, projectId);

    const { folders, scenes } = await store.loadProject(projectId);
    expect(folders.find((f) => f.id === folderId)).toBeUndefined();
    expect(scenes.find((s) => s.id === s1)).toBeUndefined();
    expect(scenes.find((s) => s.id === s2)).toBeUndefined();
    expect(await docStore.load(s1)).toBeNull();
    expect(await docStore.load(s2)).toBeNull();

    const archived = await store.listArchived(projectId);
    expect(archived).toHaveLength(1);
    expect(archived[0].kind).toBe("chapter");
    expect(archived[0].title).toBe("Part I");
    expect(archived[0].sub).toBe("2 scenes");
    expect(archived[0].originalId).toBe(folderId);
  });

  it("restoreArchived reproduces folder + scenes with byte-identical docs, statuses, synopses, and sort_orders", async () => {
    await store.archiveChapter(folderId, projectId);
    const [item] = await store.listArchived(projectId);
    await store.restoreArchived(item.id);

    const after = await store.loadProject(projectId);

    const restoredFolder = after.folders.find((f) => f.id === folderId);
    expect(restoredFolder).toBeDefined();
    expect(restoredFolder?.sort_order).toBe(folderSortOrder);

    const r1 = after.scenes.find((s) => s.id === s1);
    expect(r1?.title).toBe("Scene Alpha");
    expect(r1?.status).toBe("outline");
    expect(r1?.synopsis).toBe("The beginning.");
    expect(r1?.sort_order).toBe(s1SortOrder);

    const r2 = after.scenes.find((s) => s.id === s2);
    expect(r2?.title).toBe("Scene Beta");
    expect(r2?.status).toBe("revise");
    expect(r2?.synopsis).toBe("The middle.");
    expect(r2?.sort_order).toBe(s2SortOrder);

    expect(await docStore.load(s1)).toBe(DOC1);
    expect(await docStore.load(s2)).toBe(DOC2);
    expect(await store.listArchived(projectId)).toHaveLength(0);
  });
});

describe("SqliteBinderStore archive — purgeArchived", () => {
  it("purgeArchived removes the archive row and does NOT recreate the scene", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Doomed Scene" });
    await store.archiveScene(sceneId, projectId);

    const [item] = await store.listArchived(projectId);
    expect(item).toBeDefined();

    await store.purgeArchived(item.id);

    expect(await store.listArchived(projectId)).toHaveLength(0);

    // Scene NOT recreated.
    const { scenes } = await store.loadProject(projectId);
    expect(scenes.find((s) => s.id === sceneId)).toBeUndefined();
  });
});

describe("SqliteBinderStore archive — edge cases", () => {
  it("archiveScene with a non-existent id is a silent no-op — no throw, archivedCount stays 0", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });

    await expect(store.archiveScene("no-such-id", projectId)).resolves.toBeUndefined();

    expect(await store.archivedCount(projectId)).toBe(0);
    expect(await store.listArchived(projectId)).toHaveLength(0);
  });

  it("archiveChapter with a non-existent folderId is a silent no-op — no throw, archivedCount stays 0, no rows touched", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });

    await expect(store.archiveChapter("no-such-folder", projectId)).resolves.toBeUndefined();

    expect(await store.archivedCount(projectId)).toBe(0);
    expect(await store.listArchived(projectId)).toHaveLength(0);
  });
});
