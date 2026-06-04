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
