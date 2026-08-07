import Database from "@tauri-apps/plugin-sql";

import type { DbClient } from "./dbClient";
import { runMigrations } from "./migrations";

export type { DbClient, DbClient as DbHandle } from "./dbClient";

let dbPromise: Promise<DbClient> | null = null;

/** Open (once) the app's SQLite database and ensure the schema exists. */
export function getDb(): Promise<DbClient> {
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
