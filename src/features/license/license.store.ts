/**
 * license.store — activation record persistence in app_meta.
 *
 * Decision D4 (wave-30): activation record stored as JSON under key 'license'
 * in the app_meta KV table (migration v14). Low-level functions take a db
 * handle for testability; thin app-facing wrappers bind to getDb().
 */
import { getDb } from "../../db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivationRecord {
  licenseKey: string;
  instanceId: string;
  activatedAt: string;
}

/**
 * Minimal db interface for the license store.
 * Uses a concrete (non-generic) select signature so vi.fn() test doubles
 * satisfy it without requiring a cast at the call site — DbHandle's generic
 * select<T> is not directly assignable from Mock<Procedure | Constructable>.
 */
type LicenseStoreDb = {
  select(query: string, bindValues?: unknown[]): Promise<unknown[]>;
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const LICENSE_KEY = "license";

// ─── Low-level record accessors (db-handle-first, testable) ──────────────────

/**
 * Upsert the activation record as JSON under key 'license' in app_meta.
 * INSERT OR REPLACE handles both first write and any future re-activation.
 */
export async function writeActivationRecord(
  db: LicenseStoreDb,
  record: ActivationRecord,
): Promise<void> {
  await db.execute(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
    [LICENSE_KEY, JSON.stringify(record)],
  );
}

/**
 * Read the stored activation record. Returns null (never throws) when:
 *   - no row exists under key 'license'
 *   - the stored value is not valid JSON
 *   - the parsed JSON is missing any required field
 */
export async function readActivationRecord(
  db: LicenseStoreDb,
): Promise<ActivationRecord | null> {
  const rows = (await db.select(
    `SELECT value FROM app_meta WHERE key = ?`,
    [LICENSE_KEY],
  )) as { value: string }[];
  if (rows.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(rows[0].value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).licenseKey !== "string" ||
      typeof (parsed as Record<string, unknown>).instanceId !== "string" ||
      typeof (parsed as Record<string, unknown>).activatedAt !== "string"
    ) {
      return null;
    }
    return parsed as ActivationRecord;
  } catch {
    return null;
  }
}

// ─── App-facing wrappers (bind to getDb()) ────────────────────────────────────

/** Load the stored activation record from the app db, or null if none. */
export async function loadActivation(): Promise<ActivationRecord | null> {
  const db = await getDb();
  return readActivationRecord(db);
}

/** Persist an activation record to the app db. */
export async function saveActivation(record: ActivationRecord): Promise<void> {
  const db = await getDb();
  await writeActivationRecord(db, record);
}
