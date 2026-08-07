import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

import type { DbClient } from "../shared/dbClient";
import { runMigrations } from "../shared/migrations";
import { ExpoDbClient } from "./expoDbClient";

/** Same logical name as desktop; lives in the app's sandboxed SQLite dir. */
const DB_NAME = "writing.db";

let initPromise: Promise<DbClient> | null = null;

async function initialize(): Promise<DbClient> {
  const db: SQLiteDatabase = await openDatabaseAsync(DB_NAME);

  // Journal-mode PRAGMAs must run OUTSIDE the migration transaction.
  // WAL here is deliberate: desktop's journal_mode=DELETE works around a
  // tauri-plugin-sql pooling bug that expo-sqlite does not have (blueprint
  // "SQLite decision"); journal mode is per-device, not part of synced state.
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  // The canonical migration history runs unmodified. Unlike desktop (no
  // transaction API — idempotent-migration crash contract), expo-sqlite gives
  // us a real exclusive transaction: a mid-migration crash rolls back both the
  // DDL and the user_version stamps, and the whole run repeats next launch.
  await db.withExclusiveTransactionAsync(async (txn) => {
    await runMigrations(new ExpoDbClient(txn));
  });

  return new ExpoDbClient(db);
}

/** Singleton mobile DbClient; first call opens + migrates. */
export function getMobileDb(): Promise<DbClient> {
  initPromise ??= initialize().catch((error: unknown) => {
    // Reset so a transient failure (e.g. storage pressure) can retry on next call.
    initPromise = null;
    throw error;
  });
  return initPromise;
}

export interface DbReadyReport {
  userVersion: number;
  tableCount: number;
}

/** Observable boot check for the shell screen (and the emulator gate). */
export async function assertDbReady(): Promise<DbReadyReport> {
  const db = await getMobileDb();
  const versionRows = await db.select<{ user_version: number }[]>("PRAGMA user_version");
  const tableRows = await db.select<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'table'"
  );
  return { userVersion: versionRows[0].user_version, tableCount: tableRows[0].c };
}
