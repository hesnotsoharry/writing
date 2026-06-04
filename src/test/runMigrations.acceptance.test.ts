import { describe, expect, it } from "vitest";

import { assertSafeVersion, MIGRATIONS, runMigrations } from "../db/migrations";
import { makeSqlJsDb } from "./support/sqljsDb";

/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 6, Phase 1 (boundary: persistent storage).
 *
 * This expresses the migration-FRAMEWORK contract from the consumer's perspective.
 * The implementer makes it pass and MAY NOT modify it. It is intentionally
 * schema-end-state-agnostic: it asserts the framework's mechanics (version gating,
 * convergence, idempotency), NOT the specific final schema — the scene_links UNIQUE
 * constraint and dedupe correctness are covered by migration003's own acceptance test
 * (authored when Phase 3 is dispatched).
 *
 * Phase 1 must deliver:
 *   - src/db/migrations.ts exporting `runMigrations`, `MIGRATIONS`, `assertSafeVersion`
 *   - src/test/support/sqljsDb.ts exporting `makeSqlJsDb(): Promise<SqlJsTestDb>` where
 *     SqlJsTestDb = DbHandle & { executeCalls: string[]; close(): void }
 *     (a real in-process sql.js engine implementing the DbHandle interface, with every
 *      execute() SQL string recorded into `executeCalls` so idempotency is observable).
 */

const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version;

async function readUserVersion(db: { select: <T>(q: string) => Promise<T> }): Promise<number> {
  const rows = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  return rows[0].user_version;
}

async function tableExists(
  db: { select: <T>(q: string) => Promise<T> },
  name: string
): Promise<boolean> {
  const rows = await db.select<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`
  );
  return rows.length > 0;
}

describe("runMigrations — framework contract (Wave 6 Phase 1)", () => {
  it("brings a FRESH database (user_version 0) up to the latest migration version", async () => {
    const db = await makeSqlJsDb();
    try {
      expect(await readUserVersion(db)).toBe(0);

      await runMigrations(db);

      // The baseline migration ran end-to-end: core tables exist and the version is stamped.
      expect(await readUserVersion(db)).toBe(LATEST);
      expect(await tableExists(db, "scene_docs")).toBe(true);
      expect(await tableExists(db, "projects")).toBe(true);
      expect(await tableExists(db, "scene_links")).toBe(true);
    } finally {
      db.close();
    }
  });

  it("is idempotent — a second run on an already-migrated DB issues NO migration SQL", async () => {
    const db = await makeSqlJsDb();
    try {
      await runMigrations(db);
      const afterFirst = db.executeCalls.length;
      const versionAfterFirst = await readUserVersion(db);

      await runMigrations(db);

      // No further execute() calls (every migration was version-gated out), version unchanged.
      expect(db.executeCalls.length).toBe(afterFirst);
      expect(await readUserVersion(db)).toBe(versionAfterFirst);
    } finally {
      db.close();
    }
  });

  it("converges an EXISTING-schema DB (tables already present, user_version still 0)", async () => {
    const db = await makeSqlJsDb();
    try {
      // Simulate an old dev DB: the baseline tables already exist (created by the
      // pre-migration CREATE TABLE IF NOT EXISTS era) but user_version was never set,
      // and scene_links lacks the UNIQUE constraint. The framework must still converge it.
      await db.execute(
        `CREATE TABLE scene_docs (scene_id TEXT PRIMARY KEY, state_base64 TEXT NOT NULL, plaintext_projection TEXT)`
      );
      await db.execute(`CREATE TABLE projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, sort_order INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
      await db.execute(`CREATE TABLE folders (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL)`);
      await db.execute(`CREATE TABLE scenes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, folder_id TEXT, title TEXT NOT NULL, synopsis TEXT, sort_order INTEGER NOT NULL, word_count INTEGER NOT NULL DEFAULT 0)`);
      await db.execute(`CREATE TABLE characters (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, notes TEXT, aliases TEXT)`);
      await db.execute(`CREATE TABLE locations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, notes TEXT, aliases TEXT)`);
      await db.execute(`CREATE TABLE scene_links (scene_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL)`);
      expect(await readUserVersion(db)).toBe(0);

      await runMigrations(db);

      // Converged to the same final version as a fresh DB, no error thrown.
      expect(await readUserVersion(db)).toBe(LATEST);
    } finally {
      db.close();
    }
  });
});

describe("assertSafeVersion — PRAGMA interpolation guard (Wave 6 Phase 1)", () => {
  it("accepts valid non-negative 32-bit integers", () => {
    expect(() => assertSafeVersion(0)).not.toThrow();
    expect(() => assertSafeVersion(1)).not.toThrow();
    expect(() => assertSafeVersion(2_147_483_647)).not.toThrow();
  });

  it("rejects non-integers, negatives, and out-of-range values", () => {
    expect(() => assertSafeVersion(1.5)).toThrow();
    expect(() => assertSafeVersion(-1)).toThrow();
    expect(() => assertSafeVersion(2_147_483_648)).toThrow();
    expect(() => assertSafeVersion(Number.NaN)).toThrow();
  });
});
