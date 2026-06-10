import {
  migration_009_scene_snapshots,
  migration_010_labels,
  migration_011_scene_labels,
  migration_012_entity_relations,
  migration_013_entity_types,
  migration_014_app_meta,
} from "./migrations2";
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

/**
 * Create three feature tables for quick notes, writing goals, and archived items.
 *
 * All three use CREATE TABLE IF NOT EXISTS so this function is idempotent —
 * a crash after a partial run leaves user_version=3 and re-runs cleanly.
 *
 * project_id is TEXT NOT NULL — these tables are all project-scoped (quick notes
 * land in the active project's inbox, goals count toward a project, archived items
 * belong to a project), matching the NOT NULL project_id convention in migrations
 * 1-3. No FOREIGN KEY constraint, also mirroring migrations 1-3.
 *
 * state_base64 on archive is TEXT, never BLOB — tauri-plugin-sql does not
 * reliably round-trip binary columns (project gotcha).
 */
async function migration_004_feature_tables(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS quick_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      filed INTEGER NOT NULL DEFAULT 0
    )`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      target INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS archive (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      original_id TEXT,
      title TEXT NOT NULL,
      sub TEXT,
      state_base64 TEXT,
      archived_at INTEGER NOT NULL
    )`
  );
}

/**
 * Add a `status` column to scenes (TEXT NOT NULL DEFAULT 'blank').
 *
 * Idempotent: checks PRAGMA table_info(scenes) first and only runs the ALTER
 * if the column is absent. Required because `ALTER TABLE … ADD COLUMN` is not
 * re-runnable (SQLite has no `ADD COLUMN IF NOT EXISTS`), and the runner has no
 * try/catch — a crash after a partial run re-enters this function on next launch.
 */
async function migration_005_scene_status(db: DbHandle): Promise<void> {
  const cols = await db.select<{ name: string }[]>(
    "PRAGMA table_info(scenes)"
  );
  const alreadyExists = cols.some((c) => c.name === "status");
  if (!alreadyExists) {
    await db.execute(
      "ALTER TABLE scenes ADD COLUMN status TEXT NOT NULL DEFAULT 'blank'"
    );
  }
}

/**
 * Create entity_fields table for generic fact/section rows on characters and locations.
 *
 * UNIQUE(entity_id, kind, field_key) is load-bearing: the OR-IGNORE-then-UPDATE upsert
 * in setEntityField relies on this constraint to deduplicate on the logical key. A UUID
 * primary key alone would not deduplicate (OR IGNORE on a UUID PK is inert).
 *
 * field_key / field_value column names are used (not key / value) to avoid any
 * reserved-word ambiguity; the store layer maps them to the domain key/value names.
 */
async function migration_006_entity_fields(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS entity_fields (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, kind TEXT NOT NULL, field_key TEXT NOT NULL, field_value TEXT NOT NULL DEFAULT '', sort INTEGER NOT NULL DEFAULT 0, UNIQUE(entity_id, kind, field_key))`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_entity_fields_entity_id ON entity_fields (entity_id)`
  );
}

/**
 * Create entity_links table for directional entity→entity relationships.
 *
 * UNIQUE(from_id, to_id) is load-bearing: the INSERT OR IGNORE in addLink relies on
 * this constraint to deduplicate on the logical pair. Without it, OR IGNORE on the UUID
 * primary key would never suppress a duplicate (every UUID is fresh).
 */
async function migration_007_entity_links(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS entity_links (id TEXT PRIMARY KEY, from_id TEXT NOT NULL, to_id TEXT NOT NULL, relation TEXT NOT NULL DEFAULT '', UNIQUE(from_id, to_id))`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_entity_links_from_id ON entity_links (from_id)`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_entity_links_to_id ON entity_links (to_id)`
  );
}

/**
 * Add portrait_path TEXT column to characters and locations via ensureColumn.
 *
 * ensureColumn is idempotent (checks PRAGMA table_info before issuing ALTER TABLE),
 * which is required here — a crash after the first ensureColumn but before the second
 * would re-enter this function with portrait_path already present on characters.
 *
 * Table-existence guards: migration003 test fixtures seed a partial DB (user_version=2,
 * only scene_links + scenes) before running forward migrations. ALTER TABLE on a
 * non-existent table throws, so we skip ensureColumn when the table is absent.
 * On real production DBs, migration 1's baseline always creates both tables before
 * this migration runs, so the guard is a no-op in the field.
 */
async function migration_008_entity_portrait(db: DbHandle): Promise<void> {
  const charExists = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='characters'"
  );
  if (charExists.length > 0) {
    await ensureColumn(db, "characters", "portrait_path", "TEXT");
  }
  const locExists = await db.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='locations'"
  );
  if (locExists.length > 0) {
    await ensureColumn(db, "locations", "portrait_path", "TEXT");
  }
}

// ─── Registry ────────────────────────────────────────────────────────────────
// Migrations 009–013 live in migrations2.ts (extracted to keep this file ≤300 lines).

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
  { version: 4, name: "feature-tables", up: migration_004_feature_tables },
  { version: 5, name: "scene-status", up: migration_005_scene_status },
  { version: 6, name: "entity-fields", up: migration_006_entity_fields },
  { version: 7, name: "entity-links", up: migration_007_entity_links },
  { version: 8, name: "entity-portrait", up: migration_008_entity_portrait },
  { version: 9, name: "scene-snapshots", up: migration_009_scene_snapshots },
  { version: 10, name: "labels", up: migration_010_labels },
  { version: 11, name: "scene-labels", up: migration_011_scene_labels },
  { version: 12, name: "entity-relations", up: migration_012_entity_relations },
  { version: 13, name: "entity-types", up: migration_013_entity_types },
  { version: 14, name: "app-meta", up: migration_014_app_meta },
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
