// Mobile mirror of src/db/deviceId.ts, over the mobile DbClient. Desktop's
// getOrCreateDeviceId hardcodes getDb() from Tauri-bearing schema.ts — not
// portable — so this is a standalone mobile copy (S4 blueprint portable-
// boundary rule), matching mobileSyncRole.ts's precedent for the same reason.
import { getMobileDb } from "../db/database";

const DEVICE_ID_KEY = "device_id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDeviceId(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  const value = (row as Record<string, unknown>).value;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

/** Return this installation's persistent UUID, creating it when absent or invalid. */
export async function getOrCreateMobileDeviceId(): Promise<string> {
  const db = await getMobileDb();
  const rows = await db.select<unknown[]>(
    "SELECT value FROM app_meta WHERE key = ?", [DEVICE_ID_KEY]
  );
  const existing = validDeviceId(rows[0]);
  if (existing !== null) return existing;

  const deviceId = crypto.randomUUID();
  await db.execute(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [DEVICE_ID_KEY, deviceId]
  );
  return deviceId;
}
