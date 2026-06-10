import { afterEach, describe, expect, it, vi } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 27, Phase 3 (boundary: persistent storage).
 *
 * Verifies migrations 10 (labels) and 11 (scene_labels) introduce the correct
 * tables and that the full migration suite stamps the expected LATEST version.
 *
 * Contract: After runMigrations(db) on a fresh DB:
 *   - labels(id TEXT PK, project_id TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, sort INTEGER NOT NULL)
 *   - scene_labels(scene_id TEXT NOT NULL, label_id TEXT NOT NULL, PRIMARY KEY(scene_id, label_id))
 *   - PRAGMA user_version equals LATEST (11)
 *   - Running migrations twice is idempotent
 */

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

afterEach(() => {
  vi.restoreAllMocks();
});

async function readUserVersion(db: SqlJsTestDb): Promise<number> {
  const rows = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  return rows[0].user_version;
}

async function tableExists(db: SqlJsTestDb, name: string): Promise<boolean> {
  const rows = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
  );
  return rows.length > 0;
}

async function tableColumns(db: SqlJsTestDb, tableName: string): Promise<{ name: string }[]> {
  return db.select<{ name: string }[]>(`PRAGMA table_info('${tableName}')`);
}

async function indexExists(db: SqlJsTestDb, indexName: string): Promise<boolean> {
  const rows = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='index' AND name='${indexName}'`
  );
  return rows.length > 0;
}

describe("migration 10 — labels table", () => {
  it("creates labels table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "labels")).toBe(true);

      const cols = await tableColumns(db, "labels");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("id");
      expect(colNames).toContain("project_id");
      expect(colNames).toContain("name");
      expect(colNames).toContain("color");
      expect(colNames).toContain("sort");
    } finally {
      db.close();
    }
  });

  it("creates idx_labels_project_id index", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await indexExists(db, "idx_labels_project_id")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("allows inserting a label row with token color name", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO labels (id, project_id, name, color, sort) VALUES ('lbl-1', 'proj-1', 'Tension', 'clay', 0)`
      );
      const rows = await db.select<{ name: string; color: string }[]>(
        `SELECT name, color FROM labels WHERE id = 'lbl-1'`
      );
      expect(rows[0].name).toBe("Tension");
      expect(rows[0].color).toBe("clay");
    } finally {
      db.close();
    }
  });
});

describe("migration 11 — scene_labels table", () => {
  it("creates scene_labels table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "scene_labels")).toBe(true);

      const cols = await tableColumns(db, "scene_labels");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("scene_id");
      expect(colNames).toContain("label_id");
    } finally {
      db.close();
    }
  });

  it("creates idx_scene_labels_scene_id and idx_scene_labels_label_id indexes", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await indexExists(db, "idx_scene_labels_scene_id")).toBe(true);
      expect(await indexExists(db, "idx_scene_labels_label_id")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("enforces PRIMARY KEY uniqueness on (scene_id, label_id)", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO scene_labels (scene_id, label_id) VALUES ('s1', 'lbl-1')`
      );
      let threw = false;
      try {
        await db.execute(`INSERT INTO scene_labels (scene_id, label_id) VALUES ('s1', 'lbl-1')`);
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      db.close();
    }
  });

  it("allows the same label on different scenes and different labels on the same scene", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(`INSERT INTO scene_labels (scene_id, label_id) VALUES ('s1', 'lbl-1')`);
      await db.execute(`INSERT INTO scene_labels (scene_id, label_id) VALUES ('s2', 'lbl-1')`);
      await db.execute(`INSERT INTO scene_labels (scene_id, label_id) VALUES ('s1', 'lbl-2')`);

      const rows = await db.select<{ scene_id: string; label_id: string }[]>(
        `SELECT scene_id, label_id FROM scene_labels ORDER BY scene_id, label_id`
      );
      expect(rows).toHaveLength(3);
    } finally {
      db.close();
    }
  });
});

describe("migration suite — after labels + scene_labels", () => {
  it("stamps LATEST user_version after runMigrations", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await readUserVersion(db)).toBe(LATEST);
      expect(LATEST).toBe(14);
    } finally {
      db.close();
    }
  });

  it("is idempotent — running migrations twice does not throw and tables persist", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const afterFirst = await readUserVersion(db);

      await runMigrations(db);

      expect(await readUserVersion(db)).toBe(afterFirst);
      expect(await tableExists(db, "labels")).toBe(true);
      expect(await tableExists(db, "scene_labels")).toBe(true);
    } finally {
      db.close();
    }
  });
});
