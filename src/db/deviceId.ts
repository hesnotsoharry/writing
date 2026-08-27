import { getDb } from "./schema";

const DEVICE_ID_KEY = "device_id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validDeviceId(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  const value = (row as Record<string, unknown>).value;
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

let inflight: Promise<string> | null = null;

/** Return this installation's persistent UUID, creating it when absent or invalid. */
export function getOrCreateDeviceId(): Promise<string> {
  if (!inflight) {
    inflight = loadOrCreateDeviceId().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

async function loadOrCreateDeviceId(): Promise<string> {
  const db = await getDb();
  const rows = await db.select<unknown[]>(
    "SELECT value FROM app_meta WHERE key = ?",
    [DEVICE_ID_KEY]
  );
  const existing = validDeviceId(rows[0]);
  if (existing !== null) return existing;

  const deviceId = crypto.randomUUID();
  await db.execute(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
    [DEVICE_ID_KEY, deviceId]
  );
  return deviceId;
}
