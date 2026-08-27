import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

vi.mock("../db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/schema")>();
  return { ...actual, getDb: vi.fn() };
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

describe("archive restore after a crash left the original rows", () => {
  it("restores a scene whose row still exists (emptied docs, leftover binder row)", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Opening" });
    await docStore.save(sceneId, "aGVsbG8=", null);
    await store.archiveScene(sceneId, projectId);

    await db.execute(
      "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status) VALUES ($1, $2, NULL, $3, NULL, $4, 0, 'blank')",
      [sceneId, projectId, "Opening", 1000],
    );

    const [item] = await store.listArchived(projectId);
    await expect(store.restoreArchived(item.id)).resolves.toBeUndefined();
    expect(await docStore.load(sceneId)).toBe("aGVsbG8=");
    expect(await store.listArchived(projectId)).toHaveLength(0);
  });

  it("restores a chapter whose folder and scenes still exist", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const folderId = await store.createFolder({ projectId, title: "Part I" });
    const s1 = await store.createScene({ projectId, folderId, title: "Alpha" });
    await docStore.save(s1, "Zmlyc3Q=", null);
    await store.archiveChapter(folderId, projectId);

    await db.execute(
      "INSERT INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
      [folderId, projectId, "Part I", 1000],
    );
    await db.execute(
      "INSERT INTO scenes (id, project_id, folder_id, title, synopsis, sort_order, word_count, status) VALUES ($1, $2, $3, $4, NULL, $5, 0, 'blank')",
      [s1, projectId, folderId, "Alpha", 1000],
    );

    const [item] = await store.listArchived(projectId);
    await expect(store.restoreArchived(item.id)).resolves.toBeUndefined();
    expect(await docStore.load(s1)).toBe("Zmlyc3Q=");
    const { folders, scenes } = await store.loadProject(projectId);
    expect(folders.find((folder) => folder.id === folderId)?.title).toBe("Part I");
    expect(scenes.find((scene) => scene.id === s1)?.title).toBe("Alpha");
  });
});
