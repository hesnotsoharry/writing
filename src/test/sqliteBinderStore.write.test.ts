import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

vi.mock("../db/schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/schema")>();
  return { ...actual, getDb: vi.fn() };
});

import { getDb } from "../db/schema";
import { SqliteBinderStore } from "../db/sqliteBinderStore";

let db: SqlJsTestDb;
let store: SqliteBinderStore;

beforeEach(async () => {
  db = await makeSqlJsDb();
  await runMigrations(db);
  vi.mocked(getDb).mockResolvedValue(db as unknown as Awaited<ReturnType<typeof getDb>>);
  store = new SqliteBinderStore();
});

afterEach(() => {
  db.close();
  vi.clearAllMocks();
});

async function seedSceneExtras(sceneId: string): Promise<void> {
  await db.execute(
    "INSERT INTO scene_docs (scene_id, state_base64) VALUES ($1, $2)",
    [sceneId, "cHJvc2U="],
  );
  await db.execute(
    `INSERT INTO scene_snapshots (id, scene_id, label, state_base64, word_count, created_at, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    ["snap-1", sceneId, "before", "cHJvc2U=", 12, 1, "manual"],
  );
  await db.execute(
    "INSERT INTO scene_labels (scene_id, label_id) VALUES ($1, $2)",
    [sceneId, "label-1"],
  );
  await db.execute(
    "INSERT INTO scene_links (scene_id, entity_type, entity_id) VALUES ($1, $2, $3)",
    [sceneId, "character", "entity-1"],
  );
}

describe("SqliteBinderStore.deleteScene — dependent cleanup", () => {
  it("removes scene_docs, snapshots, labels, and links with the scene row", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const sceneId = await store.createScene({ projectId, folderId: null, title: "Doomed" });
    await seedSceneExtras(sceneId);

    await store.deleteScene(sceneId);

    const leftover = await db.select<Array<{ n: number }>>(
      `SELECT
         (SELECT COUNT(*) FROM scenes WHERE id = $1) +
         (SELECT COUNT(*) FROM scene_docs WHERE scene_id = $1) +
         (SELECT COUNT(*) FROM scene_snapshots WHERE scene_id = $1) +
         (SELECT COUNT(*) FROM scene_labels WHERE scene_id = $1) +
         (SELECT COUNT(*) FROM scene_links WHERE scene_id = $1) AS n`,
      [sceneId],
    );
    expect(leftover[0].n).toBe(0);
  });
});

describe("SqliteBinderStore.deleteFolder — Short pieces sort_order", () => {
  it("appends moved scenes after existing shorts with unique keys", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const p1 = await store.createScene({ projectId, folderId: null, title: "P1" });
    const p2 = await store.createScene({ projectId, folderId: null, title: "P2" });
    const folderId = await store.createFolder({ projectId, title: "Ch1" });
    const s1 = await store.createScene({ projectId, folderId, title: "S1" });
    const s2 = await store.createScene({ projectId, folderId, title: "S2" });

    await store.deleteFolder(folderId);

    const shorts = await db.select<Array<{ id: string; sort_order: number }>>(
      "SELECT id, sort_order FROM scenes WHERE project_id = $1 AND folder_id IS NULL ORDER BY sort_order ASC, id ASC",
      [projectId],
    );
    expect(shorts.map((row) => row.id)).toEqual([p1, p2, s1, s2]);
    expect(shorts.map((row) => row.sort_order)).toEqual([1000, 2000, 3000, 4000]);
  });
});

describe("SqliteBinderStore.createScene — append after deletion", () => {
  it("places a new short piece after surviving siblings, not in a COUNT hole", async () => {
    const projectId = await store.createProject({ title: "Novel", type: "novel" });
    const x = await store.createScene({ projectId, folderId: null, title: "X" });
    const y = await store.createScene({ projectId, folderId: null, title: "Y" });
    const z = await store.createScene({ projectId, folderId: null, title: "Z" });
    await store.deleteScene(x);
    await store.deleteScene(y);

    const added = await store.createScene({ projectId, folderId: null, title: "New" });

    const shorts = await db.select<Array<{ id: string; sort_order: number }>>(
      "SELECT id, sort_order FROM scenes WHERE project_id = $1 AND folder_id IS NULL ORDER BY sort_order ASC, id ASC",
      [projectId],
    );
    expect(shorts.map((row) => row.id)).toEqual([z, added]);
    expect(shorts[0].sort_order).toBe(3000);
    expect(shorts[1].sort_order).toBe(4000);
  });
});
