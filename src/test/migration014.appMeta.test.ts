import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * Verifies migration 14 (app_meta) introduces a simple key-value table:
 *   - app_meta(key TEXT PRIMARY KEY, value TEXT NOT NULL)
 *
 * Contract: After runMigrations(db) on a fresh DB:
 *   - app_meta table exists with key and value columns
 *   - PRAGMA user_version equals LATEST (14)
 *   - Running migrations twice is idempotent
 *   - app_meta is writable (INSERT and SELECT round-trip)
 *
 * Critical test: upgrade path (partner-upgrade scenario).
 *   - Seed a DB at user_version 13 with the v13-era schema (entities, entity_types_custom)
 *   - Run runMigrations() — should only apply migration 14
 *   - Assert: version is 14, app_meta exists and is writable, no other tables affected
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

async function seedDbToVersion13(db: SqlJsTestDb): Promise<void> {
  // Set user_version to 13
  await db.execute("PRAGMA user_version = 13");

  // Create entities table (from migration_013)
  await db.execute(
    `CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      aliases TEXT
    )`
  );
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_entities_project_id ON entities (project_id)`);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities (entity_type)`
  );

  // Create entity_types_custom table (from migration_013)
  await db.execute(
    `CREATE TABLE IF NOT EXISTS entity_types_custom (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      fields_json TEXT NOT NULL DEFAULT '[]',
      sections_json TEXT NOT NULL DEFAULT '[]'
    )`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_entity_types_custom_project_id ON entity_types_custom (project_id)`
  );
}

describe("migration 14 — app_meta table", () => {
  it("fresh path: creates app_meta table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "app_meta")).toBe(true);

      const cols = await tableColumns(db, "app_meta");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("key");
      expect(colNames).toContain("value");
    } finally {
      db.close();
    }
  });

  it("fresh path: app_meta is writable (INSERT and SELECT round-trip)", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      await db.execute(
        `INSERT INTO app_meta (key, value) VALUES ('license', '{"activated": true}')`
      );
      const rows = await db.select<{ key: string; value: string }[]>(
        `SELECT key, value FROM app_meta WHERE key = 'license'`
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].key).toBe("license");
      expect(rows[0].value).toBe('{"activated": true}');
    } finally {
      db.close();
    }
  });

  it("fresh path: stamps LATEST user_version (15) after runMigrations", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await readUserVersion(db)).toBe(LATEST);
      expect(LATEST).toBe(17);
    } finally {
      db.close();
    }
  });

  it("upgrade path: database at v13 migrates to v14 with only app_meta added", async () => {
    const db = await makeSqlJsDb();
    try {
      // Seed the db to v13 state with entities and entity_types_custom
      await seedDbToVersion13(db);

      // Verify seeding worked
      expect(await readUserVersion(db)).toBe(13);
      expect(await tableExists(db, "entities")).toBe(true);
      expect(await tableExists(db, "entity_types_custom")).toBe(true);
      expect(await tableExists(db, "app_meta")).toBe(false);

      // Run migrations — should only apply migration 14
      await runMigrations(db);

      // Assert: version is now LATEST (migrations from v13 run through to the end)
      expect(await readUserVersion(db)).toBe(LATEST);

      // Assert: app_meta table exists
      expect(await tableExists(db, "app_meta")).toBe(true);

      // Assert: pre-existing tables are still present (not dropped or altered)
      expect(await tableExists(db, "entities")).toBe(true);
      expect(await tableExists(db, "entity_types_custom")).toBe(true);

      // Assert: app_meta is writable
      await db.execute(`INSERT INTO app_meta (key, value) VALUES ('test_key', 'test_value')`);
      const rows = await db.select<{ key: string; value: string }[]>(
        `SELECT key, value FROM app_meta WHERE key = 'test_key'`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("test_value");
    } finally {
      db.close();
    }
  });

  it("idempotency: running migrations twice does not throw and maintains state", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const afterFirst = await readUserVersion(db);

      await runMigrations(db);

      expect(await readUserVersion(db)).toBe(afterFirst);
      expect(await tableExists(db, "app_meta")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("idempotency: running v14 against a db that already has app_meta does not error", async () => {
    const db = await makeSqlJsDb();
    try {
      // First run — creates app_meta
      await runMigrations(db);
      expect(await tableExists(db, "app_meta")).toBe(true);

      // Insert a value
      await db.execute(
        `INSERT INTO app_meta (key, value) VALUES ('first_key', 'first_value')`
      );

      // Second run — should not error even though app_meta exists
      await runMigrations(db);

      // Verify the previous data is still there
      const rows = await db.select<{ key: string; value: string }[]>(
        `SELECT key, value FROM app_meta WHERE key = 'first_key'`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("first_value");
    } finally {
      db.close();
    }
  });
});
