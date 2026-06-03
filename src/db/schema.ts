import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

const SCHEMA_DDL = [
  `
    CREATE TABLE IF NOT EXISTS scene_docs (
      scene_id TEXT PRIMARY KEY,
      state_base64 TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      folder_id TEXT,
      title TEXT NOT NULL,
      synopsis TEXT,
      sort_order INTEGER NOT NULL,
      word_count INTEGER NOT NULL DEFAULT 0
    )
  `,
];

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
      for (const ddl of SCHEMA_DDL) {
        await db.execute(ddl);
      }
      return db;
    })();
  }
  return dbPromise;
}
