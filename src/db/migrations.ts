import type { DbHandle } from "./schema";
import { ensureColumn } from "./schema";

export interface Migration {
  version: number;
  name: string;
  up: (db: DbHandle) => Promise<void>;
}

/**
 * Guard PRAGMA user_version interpolation.
 * PRAGMAs do not accept parameterized placeholders — the integer must be
 * string-interpolated. Validate before interpolating so injection is impossible.
 */
export function assertSafeVersion(v: number): void {
  if (!Number.isInteger(v) || v < 0 || v > 2_147_483_647) {
    throw new RangeError(
      `Migration version must be a non-negative 32-bit integer, got: ${v}`
    );
  }
}

// ─── Migration implementations ──────────────────────────────────────────────

/**
 * Execute an ordered list of DDL statements one at a time.
 * tauri-plugin-sql (and sql.js) accept exactly one statement per execute()
 * call — batching with semicolons is not supported.
 */
async function runStatements(
  db: DbHandle,
  statements: string[]
): Promise<void> {
  for (const sql of statements) {
    await db.execute(sql);
  }
}

/**
 * ⚠️  FROZEN BASELINE — DO NOT EDIT after initial ship. ⚠️
 *
 * Schema snapshot at migration 1. Once a DB is stamped user_version=1,
 * editing this function silently diverges new DBs from existing ones.
 * New changes go in a NEW numbered migration — never here.
 *
 * Why scene_links omits UNIQUE(scene_id, entity_id):
 *   CREATE TABLE IF NOT EXISTS is a no-op on existing tables — it cannot
 *   retroactively add a constraint. UNIQUE must land via migration 3's
 *   table rebuild, which runs on ALL databases (old and new). Adding
 *   UNIQUE here for fresh DBs only would create schema divergence.
 */
async function migration_001_baseline(db: DbHandle): Promise<void> {
  await m001_coreEntities(db);
  await m001_sceneLinkEntities(db);
}

async function m001_coreEntities(db: DbHandle): Promise<void> {
  await runStatements(db, [
    `CREATE TABLE IF NOT EXISTS scene_docs (
      scene_id TEXT PRIMARY KEY,
      state_base64 TEXT NOT NULL,
      plaintext_projection TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      folder_id TEXT,
      title TEXT NOT NULL,
      synopsis TEXT,
      sort_order INTEGER NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0
    )`,
  ]);
}

async function m001_sceneLinkEntities(db: DbHandle): Promise<void> {
  await runStatements(db, [
    `CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      aliases TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      notes TEXT,
      aliases TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS scene_links (
      scene_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_scene_links_scene_id ON scene_links (scene_id)`,
  ]);
}

/**
 * Formally register the plaintext_projection column in version history.
 * No-op on all current DBs: fresh DBs already have it from migration 1's
 * baseline DDL; existing dev DBs already gained it via pre-framework ensureColumn.
 * This migration exists to record the column's introduction and advance user_version to 2.
 */
async function migration_002_plaintext_projection(db: DbHandle): Promise<void> {
  await ensureColumn(db, "scene_docs", "plaintext_projection", "TEXT");
}

/**
 * Transaction-less crash-safe scene_links table rebuild.
 *
 * Every step is idempotent / existence-guarded so a re-run after a mid-migration
 * crash converges cleanly. `runMigrations` only stamps user_version=3 AFTER this
 * function returns without throwing — a crash leaves user_version=2, causing the
 * whole function to re-run on the next launch.
 *
 * Rebuild sequence (one SQL statement per db.execute() — sql.js / tauri-plugin-sql
 * reject batched statements):
 *   1. CREATE TABLE IF NOT EXISTS scene_links_new (with UNIQUE constraint).
 *   2. If old scene_links still exists (crash-safe guard):
 *      a. Count cross-type-collision rows (dupes whose entity_type differs from the
 *         MIN(rowid) survivor) and console.warn if any are found.
 *      b. DELETE duplicates, keeping MIN(rowid) per (scene_id, entity_id).
 *      c. INSERT OR IGNORE copy into scene_links_new.
 *      d. DROP TABLE IF EXISTS scene_links.
 *   3. If scene_links_new still exists (guards against the rename already having
 *      happened in a prior partial run), RENAME to scene_links.
 *   4. CREATE INDEX IF NOT EXISTS on scene_links(scene_id).
 */
async function migration_003_scene_links_unique(db: DbHandle): Promise<void> {
  // Step 1 — create the replacement table with the UNIQUE constraint.
  // IF NOT EXISTS makes this a no-op when a prior crash already created it.
  await db.execute(
    `CREATE TABLE IF NOT EXISTS scene_links_new (scene_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, UNIQUE(scene_id, entity_id))`
  );

  // Step 2 — process the old table only if it still exists (crash guard: if a
  // prior run already dropped it, skip the block and go straight to step 3).
  const exists = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='scene_links'"
  );

  if (exists.length > 0) {
    // Step 2a — cross-type-collision diagnostic. Run BEFORE the dedupe DELETE so
    // the discarded rows are still present for counting. Warn (do not silently drop)
    // when a dropped row's entity_type differs from its group's MIN(rowid) survivor.
    // A same-entity_type duplicate is a genuine duplicate and needs no warning.
    const collisionRows = await db.select<{ c: number }[]>(
      `SELECT COUNT(*) AS c FROM scene_links AS dup
       WHERE dup.rowid NOT IN (SELECT MIN(rowid) FROM scene_links GROUP BY scene_id, entity_id)
         AND dup.entity_type != (
           SELECT s.entity_type FROM scene_links AS s
           WHERE s.rowid = (SELECT MIN(rowid) FROM scene_links AS m
                            WHERE m.scene_id = dup.scene_id AND m.entity_id = dup.entity_id))`
    );
    const collisionCount = collisionRows[0].c;
    if (collisionCount > 0) {
      console.warn(
        `[migration 3] scene_links dedupe dropped ${collisionCount} row(s) with a conflicting entity_type for the same (scene_id, entity_id)`
      );
    }

    // Step 2b — dedupe: keep only the MIN(rowid) row per (scene_id, entity_id) pair.
    await db.execute(
      `DELETE FROM scene_links WHERE rowid NOT IN (SELECT MIN(rowid) FROM scene_links GROUP BY scene_id, entity_id)`
    );

    // Step 2c — copy deduplicated rows into the new constrained table.
    // INSERT OR IGNORE tolerates rows already present (from a prior partial run).
    await db.execute(
      `INSERT OR IGNORE INTO scene_links_new (scene_id, entity_type, entity_id) SELECT scene_id, entity_type, entity_id FROM scene_links`
    );

    // Step 2d — drop the old (unconstrained) table.
    await db.execute(`DROP TABLE IF EXISTS scene_links`);
  }

  // Step 3 — rename only if scene_links_new still exists. If a prior run already
  // completed the rename, this block is skipped and we land at step 4 idempotently.
  const newExists = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='scene_links_new'"
  );
  if (newExists.length > 0) {
    await db.execute(`ALTER TABLE scene_links_new RENAME TO scene_links`);
  }

  // Step 4 — recreate the lookup index (IF NOT EXISTS makes re-runs a no-op).
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_scene_links_scene_id ON scene_links (scene_id)`
  );
}

// ─── Registry ────────────────────────────────────────────────────────────────

/**
 * Ordered list of all migrations. APPEND ONLY — never reorder or remove entries.
 * Each `up()` function must be individually idempotent (IF NOT EXISTS / IF EXISTS
 * guards) because there is no transaction API: a mid-migration crash leaves
 * user_version un-bumped, so the migration re-runs on next startup.
 */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: "baseline-schema", up: migration_001_baseline },
  { version: 2, name: "plaintext-projection-formal", up: migration_002_plaintext_projection },
  { version: 3, name: "scene-links-unique", up: migration_003_scene_links_unique },
];

// ─── Runner ──────────────────────────────────────────────────────────────────

/**
 * Apply every pending migration in version order and stamp user_version after
 * each succeeds. Reads the current PRAGMA user_version first and skips any
 * migration whose version is already met.
 *
 * NO try/catch in the migration loop — a throw must leave user_version
 * un-bumped so the migration re-runs on next launch (crash-recovery contract).
 */
export async function runMigrations(db: DbHandle): Promise<void> {
  const rows = await db.select<{ user_version: number }[]>(
    "PRAGMA user_version"
  );
  let current = rows[0].user_version;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await migration.up(db);
    assertSafeVersion(migration.version);
    await db.execute(`PRAGMA user_version = ${migration.version}`);
    current = migration.version;
  }
}
