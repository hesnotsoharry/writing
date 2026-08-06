import { getDb } from "../db/schema";

export type SyncRole = "origin" | "joined";

const SYNC_ROLE_KEY = "sync_role";

export async function getSyncRole(): Promise<SyncRole | null> {
  const db = await getDb();
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_meta WHERE key = ?", [SYNC_ROLE_KEY]
  );
  const value = rows[0]?.value;
  return value === "origin" || value === "joined" ? value : null;
}

export async function setSyncRole(role: SyncRole): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
    SYNC_ROLE_KEY, role,
  ]);
}

export async function clearSyncRole(): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM app_meta WHERE key = ?", [SYNC_ROLE_KEY]);
}
