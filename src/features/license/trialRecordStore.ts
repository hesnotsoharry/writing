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

/** Discriminates "no row was ever written" from "a row exists but is garbage".
 *  A legitimate install never writes a corrupt row, so corrupt must NOT read
 *  as a brand-new device — that re-granted a full trial on a hand-mangled row
 *  (audit P10.2). Deleting the row outright still resets the trial: accepted
 *  for Phase-1 honor-level licensing (unsigned local KV by design). */
export type TrialReadResult =
  | { kind: "missing" }
  | { kind: "corrupt" }
  | { kind: "record"; record: TrialRecord };

/** Read the stored trial record with missing/corrupt discrimination. */
export async function readTrialRecordDetailed(
  db: DbClient,
): Promise<TrialReadResult> {
  const rows = await db.select<{ value: string }[]>(
    `SELECT value FROM app_meta WHERE key = ?`,
    [TRIAL_KEY],
  );
  if (rows.length === 0) return { kind: "missing" };
  try {
    const parsed: unknown = JSON.parse(rows[0].value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).trialStartedAt !== "string" ||
      typeof (parsed as Record<string, unknown>).lastSeenAt !== "string" ||
      // Unparseable date strings must read as corrupt: NaN would otherwise
      // flow through computeTrialStatus as state "active" forever (NaN <= 0
      // is false), turning a hand-edited row into an infinite trial.
      Number.isNaN(Date.parse((parsed as TrialRecord).trialStartedAt)) ||
      Number.isNaN(Date.parse((parsed as TrialRecord).lastSeenAt))
    ) {
      return { kind: "corrupt" };
    }
    return { kind: "record", record: parsed as TrialRecord };
  } catch {
    return { kind: "corrupt" };
  }
}

/**
 * Read the stored trial record. Returns null (never throws) when no row
 * exists, the value is not valid JSON, or required fields are missing.
 */
export async function readTrialRecord(
  db: DbClient,
): Promise<TrialRecord | null> {
  const result = await readTrialRecordDetailed(db);
  return result.kind === "record" ? result.record : null;
}

