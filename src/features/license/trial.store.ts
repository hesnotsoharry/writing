/**
 * trial.store — trial record persistence in app_meta (wave-33).
 *
 * Decision D2 (wave-33): trial record stored as JSON under key 'trial' in the
 * app_meta KV table — same pattern as license.store.ts (no migration needed).
 * Low-level functions take a db handle for testability; thin app-facing
 * wrappers bind to getDb().
 *
 * Stub: signatures declared by the orchestrator; Phase 1 implements
 * against the oracle acceptance test.
 */
import { getDb } from "../../db/schema";

import type { TrialRecord } from "./trial";

/**
 * Minimal db interface for the trial store (mirrors LicenseStoreDb —
 * concrete select signature so vi.fn() doubles satisfy it without casts).
 */
type TrialStoreDb = {
  select(query: string, bindValues?: unknown[]): Promise<unknown[]>;
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
};

// ─── Low-level record accessors (db-handle-first, testable) ──────────────────

/** Upsert the trial record as JSON under key 'trial' in app_meta. */
export async function writeTrialRecord(
  db: TrialStoreDb,
  record: TrialRecord,
): Promise<void> {
  void db;
  void record;
  throw new Error("not implemented");
}

/**
 * Read the stored trial record. Returns null (never throws) when no row
 * exists, the value is not valid JSON, or required fields are missing.
 */
export async function readTrialRecord(
  db: TrialStoreDb,
): Promise<TrialRecord | null> {
  void db;
  throw new Error("not implemented");
}

// ─── App-facing wrappers (bind to getDb()) ────────────────────────────────────

/** Load the stored trial record from the app db, or null if none. */
export async function loadTrial(): Promise<TrialRecord | null> {
  const db = await getDb();
  return readTrialRecord(db);
}

/** Persist a trial record to the app db. */
export async function saveTrial(record: TrialRecord): Promise<void> {
  const db = await getDb();
  await writeTrialRecord(db, record);
}
