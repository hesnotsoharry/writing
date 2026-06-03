import Database from "@tauri-apps/plugin-sql";

let dbPromise: Promise<Database> | null = null;

/** Open (once) the app's SQLite database and ensure the schema exists. */
export function getDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await Database.load("sqlite:writing.db");
      await db.execute(`
        CREATE TABLE IF NOT EXISTS scene_docs (
          scene_id TEXT PRIMARY KEY,
          state_base64 TEXT NOT NULL
        )
      `);
      return db;
    })();
  }
  return dbPromise;
}
