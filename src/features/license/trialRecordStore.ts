import type { DbClient } from "../../db/dbClient";
import type { TrialRecord } from "./trial";

const TRIAL_KEY = "trial";

// ─── Low-level record accessors (db-handle-first, testable) ──────────────────

/** Upsert the trial record as JSON under key 'trial' in app_meta. */
export async function writeTrialRecord(
  db: DbClient,
  record: TrialRecord,
): Promise<void> {
  await db.execute(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    [TRIAL_KEY, JSON.stringify(record)],
  );
}

/**
 * Read the stored trial record. Returns null (never throws) when no row
 * exists, the value is not valid JSON, or required fields are missing.
 */
export async function readTrialRecord(
  db: DbClient,
): Promise<TrialRecord | null> {
  const rows = await db.select<{ value: string }[]>(
    `SELECT value FROM app_meta WHERE key = ?`,
    [TRIAL_KEY],
  );
  if (rows.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(rows[0].value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).trialStartedAt !== "string" ||
      typeof (parsed as Record<string, unknown>).lastSeenAt !== "string" ||
      // Unparseable date strings must read as no-record: NaN would otherwise
      // flow through computeTrialStatus as state "active" forever (NaN <= 0
      // is false), turning a hand-edited row into an infinite trial.
      Number.isNaN(Date.parse((parsed as TrialRecord).trialStartedAt)) ||
      Number.isNaN(Date.parse((parsed as TrialRecord).lastSeenAt))
    ) {
      return null;
    }
    return parsed as TrialRecord;
  } catch {
    return null;
  }
}

