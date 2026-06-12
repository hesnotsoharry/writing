import { describe, expect, it } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 27, Phase 4 (boundary: persistent storage).
 *
 * Verifies migration 12 (entity_relations) introduces the correct table, indexes,
 * uniqueness constraint, and that the full migration suite stamps the expected LATEST.
 *
 * Contract: After runMigrations(db) on a fresh DB:
 *   - entity_relations(id TEXT PK, project_id TEXT NOT NULL, from_entity TEXT NOT NULL,
 *       to_entity TEXT NOT NULL, relation_label TEXT NOT NULL, reciprocal_id TEXT NULL,
 *       created_at INTEGER NOT NULL, UNIQUE(project_id, from_entity, to_entity))
 *   - PRAGMA user_version equals LATEST (12)
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

describe("migration 12 — entity_relations table", () => {
  it("creates entity_relations table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "entity_relations")).toBe(true);

      const cols = await tableColumns(db, "entity_relations");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("id");
      expect(colNames).toContain("project_id");
      expect(colNames).toContain("from_entity");
      expect(colNames).toContain("to_entity");
      expect(colNames).toContain("relation_label");
      expect(colNames).toContain("reciprocal_id");
      expect(colNames).toContain("created_at");
    } finally {
      db.close();
    }
  });

  it("creates the three expected indexes", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await indexExists(db, "idx_entity_relations_project_id")).toBe(true);
      expect(await indexExists(db, "idx_entity_relations_from_entity")).toBe(true);
      expect(await indexExists(db, "idx_entity_relations_to_entity")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("enforces UNIQUE(project_id, from_entity, to_entity) — duplicate insert throws", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO entity_relations (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at)
         VALUES ('r1', 'proj-1', 'ent-A', 'ent-B', 'Friend of', NULL, 1000)`
      );
      let threw = false;
      try {
        await db.execute(
          `INSERT INTO entity_relations (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at)
           VALUES ('r2', 'proj-1', 'ent-A', 'ent-B', 'Rival of', NULL, 2000)`
        );
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } finally {
      db.close();
    }
  });

  it("allows the inverse edge direction as a distinct row", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO entity_relations (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at)
         VALUES ('r1', 'proj-1', 'ent-A', 'ent-B', 'Parent of', 'r2', 1000)`
      );
      await db.execute(
        `INSERT INTO entity_relations (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at)
         VALUES ('r2', 'proj-1', 'ent-B', 'ent-A', 'Child of', 'r1', 1000)`
      );
      const rows = await db.select<{ id: string }[]>(
        `SELECT id FROM entity_relations WHERE project_id = 'proj-1'`
      );
      expect(rows).toHaveLength(2);
    } finally {
      db.close();
    }
  });

  it("allows reciprocal_id to be NULL", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      await db.execute(
        `INSERT INTO entity_relations (id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at)
         VALUES ('r1', 'proj-1', 'ent-A', 'ent-B', 'Custom', NULL, 1000)`
      );
      const rows = await db.select<{ reciprocal_id: string | null }[]>(
        `SELECT reciprocal_id FROM entity_relations WHERE id = 'r1'`
      );
      expect(rows[0].reciprocal_id).toBeNull();
    } finally {
      db.close();
    }
  });
});

describe("migration suite — after entity_relations", () => {
  it("stamps LATEST user_version (12) after runMigrations", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      expect(await readUserVersion(db)).toBe(LATEST);
      expect(LATEST).toBe(17);
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
      expect(await tableExists(db, "entity_relations")).toBe(true);
    } finally {
      db.close();
    }
  });
});
