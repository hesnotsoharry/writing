import { getMobileDb } from "../db/database";
import type { DbClient } from "../shared/dbClient";

const KEY = "sync_paired_device_name";

export async function readPairedDeviceName(db: DbClient): Promise<string | null> {
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_meta WHERE key = ?", [KEY],
  );
  const value = rows[0]?.value?.trim();
  return value ? value.slice(0, 80) : null;
}

export async function writePairedDeviceName(db: DbClient, name: string): Promise<void> {
  const value = name.trim().slice(0, 80);
  if (!value) return;
  await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [KEY, value]);
}

export async function getPairedDeviceName(): Promise<string> {
  return (await readPairedDeviceName(await getMobileDb())) ?? "Desktop";
}

export async function setPairedDeviceName(name: string): Promise<void> {
  await writePairedDeviceName(await getMobileDb(), name);
}

export async function clearPairedDeviceName(): Promise<void> {
  const db = await getMobileDb();
  await db.execute("DELETE FROM app_meta WHERE key = ?", [KEY]);
}
