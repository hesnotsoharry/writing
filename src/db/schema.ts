import Database from "@tauri-apps/plugin-sql";

import { runMigrations } from "./migrations";

let dbPromise: Promise<Database> | null = null;

/**
 * Minimal interface covering the tauri-plugin-sql methods used in schema.ts.
 * Extracted so ensureColumn can accept a test double without importing the plugin.
 */
export interface DbHandle {
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
}

/**
 * Idempotent column migration: adds `column` (of type `ddlType`) to `table`
 * only if it is absent. Uses PRAGMA table_info to check — not a try/catch on
 * a duplicate-column error — so it is safe to call on every startup.
 *
 * SQLite PRAGMA table_info returns one row per column with fields:
 *   cid INTEGER, name TEXT, type TEXT, notnull INTEGER, dflt_value, pk INTEGER
 */
export async function ensureColumn(
  db: DbHandle,
  table: string,
  column: string,
  ddlType: string
): Promise<void> {
  const rows = await db.select<{ name: string }[]>(
    `PRAGMA table_info(${table})`
  );
  const exists = rows.some((r) => r.name === column);
  if (!exists) {
    await db.execute(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`
    );
  }
}

/** Open (once) the app's SQLite database and ensure the schema exists. */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:writing.db");
      // Disable WAL (use a rollback journal). tauri-plugin-sql pools connections
      // and does not expose journal config (plugins-workspace#2328); under WAL,
      // a write commits to the -wal file on one pooled connection while a read on
      // another sees a pre-write snapshot — so same-session read-after-write
      // returns empty. DELETE mode makes writes immediately visible to all reads.
      // journal_mode is file-level, so this one call converts the whole database
      // (and checkpoints any existing WAL).
      await db.execute("PRAGMA journal_mode=DELETE");
      await runMigrations(db);
      // One-time repair: recover scenes orphaned by a folder_id that no longer exists (drag bug). Safe no-op on clean DBs.
      await db.execute(
        `UPDATE scenes SET folder_id = NULL
         WHERE folder_id IS NOT NULL
           AND folder_id NOT IN (SELECT id FROM folders);`
      );
      return db;
    })();
  }
  return dbPromise;
}
