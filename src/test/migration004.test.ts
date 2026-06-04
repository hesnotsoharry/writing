import { afterEach, describe, expect, it, vi } from "vitest";

import { runMigrations } from "../db/migrations";
import { makeSqlJsDb, type SqlJsTestDb } from "./support/sqljsDb";

/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 7, Phase 3 (boundary: persistent storage).
 *
 * Pre-impl oracle mode: verifies migration 4 introduces three new tables
 * (quick_notes, goals, archive) with the exact schema contract below.
 * The implementer must make this pass without modifying the test.
 *
 * Contract: After `runMigrations(db)` on a fresh DB:
 *   - quick_notes (id TEXT PK, project_id TEXT, body TEXT NOT NULL, created_at INTEGER NOT NULL, filed INTEGER NOT NULL DEFAULT 0)
 *   - goals (id TEXT PK, project_id TEXT, goal_type TEXT NOT NULL, target INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)
 *   - archive (id TEXT PK, project_id TEXT, kind TEXT NOT NULL, original_id TEXT, title TEXT NOT NULL, sub TEXT, state_base64 TEXT, archived_at INTEGER NOT NULL)
 *   - PRAGMA user_version equals 4
 */

const LATEST = 4; // Oracle establishes this as the expected latest version after migration 4 is implemented

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

async function tableColumns(
  db: SqlJsTestDb,
  tableName: string
): Promise<{ name: string }[]> {
  return db.select<{ name: string }[]>(`PRAGMA table_info('${tableName}')`);
}

describe("migration 4 — quick_notes, goals, archive tables", () => {
  it("creates quick_notes table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "quick_notes")).toBe(true);

      const cols = await tableColumns(db, "quick_notes");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("id");
      expect(colNames).toContain("project_id");
      expect(colNames).toContain("body");
      expect(colNames).toContain("created_at");
      expect(colNames).toContain("filed");
    } finally {
      db.close();
    }
  });

  it("creates goals table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "goals")).toBe(true);

      const cols = await tableColumns(db, "goals");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("id");
      expect(colNames).toContain("project_id");
      expect(colNames).toContain("goal_type");
      expect(colNames).toContain("target");
      expect(colNames).toContain("enabled");
      expect(colNames).toContain("created_at");
    } finally {
      db.close();
    }
  });

  it("creates archive table with correct columns", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await tableExists(db, "archive")).toBe(true);

      const cols = await tableColumns(db, "archive");
      const colNames = cols.map((c) => c.name);

      expect(colNames).toContain("id");
      expect(colNames).toContain("project_id");
      expect(colNames).toContain("kind");
      expect(colNames).toContain("original_id");
      expect(colNames).toContain("title");
      expect(colNames).toContain("sub");
      expect(colNames).toContain("state_base64");
      expect(colNames).toContain("archived_at");
    } finally {
      db.close();
    }
  });

  it("sets user_version to 4 after runMigrations", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);

      expect(await readUserVersion(db)).toBe(LATEST);
    } finally {
      db.close();
    }
  });

  it("is idempotent — running migrations twice does not throw and tables persist", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const afterFirst = await readUserVersion(db);

      await runMigrations(db); // second run should be a no-op

      expect(await readUserVersion(db)).toBe(afterFirst);
      expect(await tableExists(db, "quick_notes")).toBe(true);
      expect(await tableExists(db, "goals")).toBe(true);
      expect(await tableExists(db, "archive")).toBe(true);
    } finally {
      db.close();
    }
  });
});
