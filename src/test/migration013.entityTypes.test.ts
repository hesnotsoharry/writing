import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 27, Phase 5 (boundary: persistent storage).
 *
 * Verifies migration 13 (entity_types) introduces two new tables:
 *   - entities(id TEXT PK, project_id TEXT NOT NULL, entity_type TEXT NOT NULL,
 *       name TEXT NOT NULL, notes TEXT, aliases TEXT)
 *   - entity_types_custom(id TEXT PK, project_id TEXT NOT NULL, name TEXT NOT NULL,
 *       icon TEXT NOT NULL, color TEXT NOT NULL, fields_json TEXT DEFAULT '[]',
 *       sections_json TEXT DEFAULT '[]')
 *
 * Contract: After runMigrations(db) on a fresh DB:
 *   - entities table exists with all expected columns
 *   - entity_types_custom table exists with all expected columns
 *   - idx_entities_project_id and idx_entities_entity_type indexes exist
 *   - idx_entity_types_custom_project_id index exists
 *   - PRAGMA user_version equals LATEST (13)
 *   - Running migrations twice is idempotent
 */

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

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

describe("migration 13 — entity_types tables", () => {
  it("creates entities table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "entities")).toBe(true);

      const cols = await tableColumns(db, "entities");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("id");
      expect(colNames).toContain("project_id");
      expect(colNames).toContain("entity_type");
      expect(colNames).toContain("name");
      expect(colNames).toContain("notes");
      expect(colNames).toContain("aliases");
    } finally {
      db.close();
    }
  });

  it("creates entity_types_custom table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "entity_types_custom")).toBe(true);

      const cols = await tableColumns(db, "entity_types_custom");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("id");
      expect(colNames).toContain("project_id");
      expect(colNames).toContain("name");
      expect(colNames).toContain("icon");
      expect(colNames).toContain("color");
      expect(colNames).toContain("fields_json");
      expect(colNames).toContain("sections_json");
    } finally {
      db.close();
    }
  });

  it("creates the three expected indexes", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await indexExists(db, "idx_entities_project_id")).toBe(true);
      expect(await indexExists(db, "idx_entities_entity_type")).toBe(true);
      expect(await indexExists(db, "idx_entity_types_custom_project_id")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("allows entities to be inserted with all columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO entities (id, project_id, entity_type, name, notes, aliases)
         VALUES ('ent-1', 'proj-1', 'item', 'Sword', 'Sharp blade', 'Excalibur')`
      );
      const rows = await db.select<{ id: string; name: string }[]>(
        `SELECT id, name FROM entities WHERE project_id = 'proj-1'`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Sword");
    } finally {
      db.close();
    }
  });

  it("allows entity_types_custom to be inserted with all columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO entity_types_custom (id, project_id, name, icon, color, fields_json, sections_json)
         VALUES ('type-1', 'proj-1', 'Faction', 'shield', 'red', '[{"key":"size"}]', '[{"key":"overview"}]')`
      );
      const rows = await db.select<{ id: string; name: string }[]>(
        `SELECT id, name FROM entity_types_custom WHERE project_id = 'proj-1'`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Faction");
    } finally {
      db.close();
    }
  });

  it("allows null notes and aliases in entities", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO entities (id, project_id, entity_type, name, notes, aliases)
         VALUES ('ent-2', 'proj-1', 'item', 'Dagger', NULL, NULL)`
      );
      const rows = await db.select<{ notes: string | null; aliases: string | null }[]>(
        `SELECT notes, aliases FROM entities WHERE id = 'ent-2'`
      );
      expect(rows[0].notes).toBeNull();
      expect(rows[0].aliases).toBeNull();
    } finally {
      db.close();
    }
  });
});

describe("migration suite — after entity_types", () => {
  it("stamps LATEST user_version (14) after runMigrations", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await readUserVersion(db)).toBe(LATEST);
      expect(LATEST).toBe(18);
    } finally {
      db.close();
    }
  });

  it("is idempotent — running migrations twice does not throw", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const afterFirst = await readUserVersion(db);

      await runMigrations(db);

      expect(await readUserVersion(db)).toBe(afterFirst);
      expect(await tableExists(db, "entities")).toBe(true);
      expect(await tableExists(db, "entity_types_custom")).toBe(true);
    } finally {
      db.close();
    }
  });
});
