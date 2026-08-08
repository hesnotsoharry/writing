import { getMobileDb } from "../db/database";
import type { DbClient } from "../shared/dbClient";

const RELAY_URL_KEY = "sync_relay_url";
const RELAY_PROTOCOL_RE = /^wss?:\/\//;

function readRelayValue(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  const value = (row as Record<string, unknown>).value;
  if (typeof value !== "string" || !RELAY_PROTOCOL_RE.test(value)) return null;
  return value;
}

export async function readMobileRelayUrl(db: DbClient): Promise<string | null> {
  const rows = await db.select<unknown[]>(
    "SELECT value FROM app_meta WHERE key = ?", [RELAY_URL_KEY],
  );
  return readRelayValue(rows[0]);
}

export async function writeMobileRelayUrl(db: DbClient, relayUrl: string): Promise<void> {
  if (!RELAY_PROTOCOL_RE.test(relayUrl)) throw new Error("Invalid relay URL");
  await db.execute(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
    [RELAY_URL_KEY, relayUrl],
  );
}

export async function getMobileRelayUrlOverride(): Promise<string | null> {
  return readMobileRelayUrl(await getMobileDb());
}

export async function setMobileRelayUrlOverride(relayUrl: string): Promise<void> {
  await writeMobileRelayUrl(await getMobileDb(), relayUrl);
}

export function resolveMobileRelayUrl(
  override: string | null,
  defaultRelayUrl: string,
): string {
  return override ?? defaultRelayUrl;
}
