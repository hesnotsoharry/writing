// Mobile mirror of src/sync/syncRole.ts + the app_meta KV pattern in
// src/features/license/license.store.ts (db-handle-first for testability,
// thin app-facing wrapper bound to the real db). Desktop's syncRole.ts pulls
// `getDb` from db/schema.ts, which is Tauri-only — not portable — so this is
// a standalone mobile copy rather than a `@writersnook/*` re-export.
//
// Mobile only ever writes "joined": it is always the pairing/scanning side
// (the QR-rendering "origin" device is desktop). See the S4 blueprint's "QR
// pairing" note on orphaned-Keychain repair — a SecureStore key surviving
// without this row (e.g. after an app reinstall on iOS) is a future S5+
// repair-UI concern, not handled here.
import type { DbClient } from "../shared/dbClient";
import { getMobileDb } from "../db/database";

const SYNC_ROLE_KEY = "sync_role";

export async function writeJoinedSyncRole(db: DbClient): Promise<void> {
  await db.execute(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
    [SYNC_ROLE_KEY, "joined"],
  );
}

export async function readSyncRole(db: DbClient): Promise<"joined" | null> {
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM app_meta WHERE key = ?", [SYNC_ROLE_KEY],
  );
  return rows[0]?.value === "joined" ? "joined" : null;
}

/** App-facing wrapper: marks this device as joined after a successful pair. */
export async function markDeviceJoined(): Promise<void> {
  const db = await getMobileDb();
  await writeJoinedSyncRole(db);
}

/** App-facing wrapper: has this device already completed pairing? */
export async function isDeviceJoined(): Promise<boolean> {
  const db = await getMobileDb();
  return (await readSyncRole(db)) === "joined";
}
