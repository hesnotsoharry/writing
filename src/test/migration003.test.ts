import { afterEach, describe, expect, it, vi } from "vitest";

import { MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 6, Phase 3 (boundary: persistent storage).
 *
 * Verifies migration 3 — the scene_links table rebuild that lands the
 * UNIQUE(scene_id, entity_id) constraint on existing DBs. Runs against a REAL sql.js
 * engine (not a vi.fn double) because the dedupe + INSERT-OR-IGNORE + table-rebuild
 * logic is semantically load-bearing and cannot be verified by string capture.
 *
 * The implementer makes this pass and MAY NOT modify it. Phase 3 must deliver
 * `migration_003_scene_links_unique` as a THIRD entry in MIGRATIONS (version 3) plus
 * a cross-type-collision diagnostic that calls `console.warn` (NOT a silent rowid drop)
 * when it discards a duplicate whose entity_type differs from the survivor's.
 *
 * Contract notes the implementer must honor for this test to pass:
 *   - The diagnostic MUST use `console.warn` so the cross-type-collision case is observable.
 *   - Dedupe keeps the MIN(rowid) row (the first-inserted of each (scene_id, entity_id) group).
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

/** Create the PRE-constraint scene_links table (as it exists on an old dev DB) and stamp user_version=2. */
async function seedOldDb(db: SqlJsTestDb): Promise<void> {
  await db.execute(
    `CREATE TABLE scene_links (scene_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL)`
  );
  // An old dev DB at user_version=2 already has the baseline scenes table (migration 1).
  // Migration 5 ALTERs scenes, so the fixture must include it in its pre-status shape.
  await db.execute(
    `CREATE TABLE scenes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, folder_id TEXT, title TEXT NOT NULL, synopsis TEXT, sort_order INTEGER NOT NULL, word_count INTEGER NOT NULL DEFAULT 0)`
  );
  await db.execute("PRAGMA user_version = 2");
}

async function insertLink(
  db: SqlJsTestDb,
  sceneId: string,
  entityType: string,
  entityId: string
): Promise<void> {
  await db.execute(
    `INSERT INTO scene_links (scene_id, entity_type, entity_id) VALUES ($1, $2, $3)`,
    [sceneId, entityType, entityId]
  );
}

describe("migration 3 — scene_links UNIQUE rebuild", () => {
  it("FRESH DB: scene_links ends empty, with the UNIQUE constraint, at the latest version", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db); // runs all migrations on a version-0 DB

      expect(await readUserVersion(db)).toBe(LATEST);
      expect(await tableExists(db, "scene_links")).toBe(true);
      expect(await tableExists(db, "scene_links_new")).toBe(false); // temp table cleaned up

      const rows = await db.select<{ c: number }[]>("SELECT COUNT(*) AS c FROM scene_links");
      expect(rows[0].c).toBe(0);

      // UNIQUE(scene_id, entity_id) is enforced: a duplicate pair must be rejected.
      await insertLink(db,"s1", "character", "e1");
      await expect(insertLink(db,"s1", "character", "e1")).rejects.toThrow();
    } finally {
      db.close();
    }
  });

  it("dedupes same-(scene_id,entity_id) rows, KEEPING the MIN(rowid) survivor, then enforces UNIQUE", async () => {
    const db = await makeSqlJsDb();
    try {
      await seedOldDb(db);
      // Two identical pairs (same entity_type) + one distinct pair. First-inserted survives.
      await insertLink(db,"s1", "character", "e1"); // rowid 1 — survivor
      await insertLink(db,"s1", "character", "e1"); // rowid 2 — dropped
      await insertLink(db,"s1", "character", "e2"); // distinct pair — kept

      await runMigrations(db); // version 2 -> only migration 3 runs

      expect(await readUserVersion(db)).toBe(LATEST);
      const rows = await db.select<{ scene_id: string; entity_type: string; entity_id: string }[]>(
        "SELECT scene_id, entity_type, entity_id FROM scene_links ORDER BY entity_id"
      );
      expect(rows).toEqual([
        { scene_id: "s1", entity_type: "character", entity_id: "e1" },
        { scene_id: "s1", entity_type: "character", entity_id: "e2" },
      ]);

      // Constraint now enforced.
      await expect(insertLink(db,"s1", "character", "e1")).rejects.toThrow();
    } finally {
      db.close();
    }
  });

  it("WARNS (does not silently drop) when a dropped duplicate has a DIFFERENT entity_type", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = await makeSqlJsDb();
    try {
      await seedOldDb(db);
      // Same (scene_id, entity_id) pair but conflicting entity_type — dedupe must keep one AND warn.
      await insertLink(db,"s1", "character", "e1"); // rowid 1 — survivor
      await insertLink(db,"s1", "location", "e1"); // rowid 2 — dropped, type differs

      await runMigrations(db);

      const rows = await db.select<{ c: number }[]>("SELECT COUNT(*) AS c FROM scene_links");
      expect(rows[0].c).toBe(1);
      expect(warn).toHaveBeenCalled(); // the cross-type collision was surfaced, not silent
    } finally {
      db.close();
    }
  });

  it("does NOT warn for a same-entity_type duplicate (a genuine duplicate, not a collision)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const db = await makeSqlJsDb();
    try {
      await seedOldDb(db);
      await insertLink(db,"s1", "character", "e1");
      await insertLink(db,"s1", "character", "e1");

      await runMigrations(db);

      expect(warn).not.toHaveBeenCalled();
    } finally {
      db.close();
    }
  });

  it("CRASH RECOVERY: converges when an orphan scene_links_new already exists (re-run after a crash)", async () => {
    const db = await makeSqlJsDb();
    try {
      await seedOldDb(db);
      await insertLink(db,"s1", "character", "e1");
      // Simulate a crash mid-rebuild on a PRIOR run: scene_links_new was created (with the
      // constraint) but the migration never finished, so user_version is still 2.
      await db.execute(
        `CREATE TABLE scene_links_new (scene_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, UNIQUE(scene_id, entity_id))`
      );

      await runMigrations(db); // migration 3 re-runs from version 2 and must converge cleanly

      expect(await readUserVersion(db)).toBe(LATEST);
      expect(await tableExists(db, "scene_links")).toBe(true);
      expect(await tableExists(db, "scene_links_new")).toBe(false);
      const rows = await db.select<{ scene_id: string; entity_id: string }[]>(
        "SELECT scene_id, entity_id FROM scene_links"
      );
      expect(rows).toEqual([{ scene_id: "s1", entity_id: "e1" }]);
      await expect(insertLink(db,"s1", "character", "e1")).rejects.toThrow();
    } finally {
      db.close();
    }
  });

  it("CRASH RECOVERY: converges when a prior run already FULLY copied rows into scene_links_new", async () => {
    const db = await makeSqlJsDb();
    try {
      await seedOldDb(db);
      await insertLink(db, "s1", "character", "e1");
      // Prior run created scene_links_new AND copied the row, then crashed before DROP/RENAME.
      // user_version is still 2, so migration 3 re-runs against a pre-populated new table.
      await db.execute(
        `CREATE TABLE scene_links_new (scene_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, UNIQUE(scene_id, entity_id))`
      );
      await db.execute(
        `INSERT INTO scene_links_new (scene_id, entity_type, entity_id) VALUES ($1, $2, $3)`,
        ["s1", "character", "e1"]
      );

      await runMigrations(db); // INSERT OR IGNORE must tolerate the already-copied row

      expect(await readUserVersion(db)).toBe(LATEST);
      expect(await tableExists(db, "scene_links_new")).toBe(false);
      const rows = await db.select<{ scene_id: string; entity_id: string }[]>(
        "SELECT scene_id, entity_id FROM scene_links"
      );
      expect(rows).toEqual([{ scene_id: "s1", entity_id: "e1" }]); // exactly one row, no duplication
      await expect(insertLink(db, "s1", "character", "e1")).rejects.toThrow();
    } finally {
      db.close();
    }
  });

  it("is idempotent — running migrations again after migration 3 is a no-op", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const afterFirst = db.executeCalls.length;

      await runMigrations(db);

      expect(db.executeCalls.length).toBe(afterFirst); // version-gated out, no SQL re-fired
      expect(await readUserVersion(db)).toBe(LATEST);
    } finally {
      db.close();
    }
  });
});
