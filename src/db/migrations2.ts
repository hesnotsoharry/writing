/**
 * Migration implementations 009–013.
 * Extracted from migrations.ts to satisfy the 300-line file limit.
 * FROZEN entries (009–012) — do not edit. New migrations go here or in
 * a further migrations3.ts as the file grows.
 */
import type { DbHandle } from "./schema";
import { ensureColumn } from "./schema";

/**
 * Create the scene_snapshots table for per-scene version history.
 *
 * state_base64 is TEXT, never BLOB — tauri-plugin-sql does not reliably
 * round-trip binary columns (project CLAUDE.md gotcha).
 * kind is 'manual' | 'auto'. label is NULL for auto-saves.
 * word_count and created_at are non-null integers (Unix ms epoch).
 */
export async function migration_009_scene_snapshots(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS scene_snapshots (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      label TEXT,
      state_base64 TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      kind TEXT NOT NULL
    )`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_scene_snapshots_scene_id ON scene_snapshots (scene_id)`
  );
}

/**
 * Create the labels table for color-label management.
 * color stores the token name ('clay', 'sea', etc.) — never a hex value.
 */
export async function migration_010_labels(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0
    )`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_labels_project_id ON labels (project_id)`
  );
}

/**
 * Create the scene_labels join table for many-to-many scene↔label assignment.
 * PRIMARY KEY (scene_id, label_id) is the natural deduplication key.
 */
export async function migration_011_scene_labels(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS scene_labels (
      scene_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      PRIMARY KEY (scene_id, label_id)
    )`
  );
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_scene_labels_scene_id ON scene_labels (scene_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_scene_labels_label_id ON scene_labels (label_id)`);
}

/**
 * Create the entity_relations table for typed directed relationship edges.
 * UNIQUE(project_id, from_entity, to_entity) deduplicate via INSERT OR IGNORE.
 */
export async function migration_012_entity_relations(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS entity_relations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      from_entity TEXT NOT NULL,
      to_entity TEXT NOT NULL,
      relation_label TEXT NOT NULL DEFAULT '',
      reciprocal_id TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(project_id, from_entity, to_entity)
    )`
  );
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_entity_relations_project_id ON entity_relations (project_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_entity_relations_from_entity ON entity_relations (from_entity)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_entity_relations_to_entity ON entity_relations (to_entity)`);
}

/**
 * Create two tables for Phase 5 entity-type expansion.
 *
 * `entities` — generic entity rows for built-in types beyond character/location
 * and for custom-type entity instances.
 * `entity_types_custom` — one row per user-defined entity type.
 */
export async function migration_013_entity_types(db: DbHandle): Promise<void> {
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
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_entities_entity_type ON entities (entity_type)`);
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
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_entity_types_custom_project_id ON entity_types_custom (project_id)`);
}

/**
 * Create the app_meta key-value table for app-level singleton records.
 *
 * One row per key; value is always TEXT (JSON-encoded for structured records).
 * Primary use: the license activation record stored under key 'license'.
 * Uses TEXT PRIMARY KEY so upserts can use INSERT OR REPLACE.
 */
export async function migration_014_app_meta(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
}

/**
 * Create the boards and board_docs tables for the Brainstorm Boards feature.
 *
 * boards — one row per user-created brainstorm board, project-scoped.
 * board_docs — one row per board; state_base64 is TEXT (never BLOB) per the
 * tauri-plugin-sql round-trip gotcha (project CLAUDE.md).
 */
export async function migration_015_boards(db: DbHandle): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort INTEGER NOT NULL DEFAULT 0
    )`
  );
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_boards_project_id ON boards (project_id)`
  );
  await db.execute(
    `CREATE TABLE IF NOT EXISTS board_docs (
      board_id TEXT PRIMARY KEY,
      state_base64 TEXT NOT NULL
    )`
  );
}

// ensureColumn is re-exported so callers that import from migrations2 can use it.
export { ensureColumn };
