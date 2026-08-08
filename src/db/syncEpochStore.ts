import { type EpochStamp, normalizeEpochStamp } from "../sync/meta/metaDoc";
import type { DbClient } from "./dbClient";
import { getDb } from "./schema";

const APPLIED_EPOCHS_KEY = "sync_applied_epochs";

export type AppliedEpochs = Record<string, EpochStamp>;

export interface AppliedEpochStore {
  load(): Promise<AppliedEpochs>;
  save(epochs: AppliedEpochs): Promise<void>;
}

function normalizeEpochs(value: unknown): Record<string, EpochStamp> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const result: Record<string, EpochStamp> = {};
  for (const [sceneId, valueStamp] of Object.entries(value)) {
    const stamp = normalizeEpochStamp(valueStamp);
    if (!stamp) return {};
    result[sceneId] = stamp;
  }
  return result;
}

export async function readAppliedEpochs(db: DbClient): Promise<Record<string, EpochStamp>> {
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_meta WHERE key = ?", [APPLIED_EPOCHS_KEY]
  );
  if (!rows[0]) return {};
  try {
    const parsed: unknown = JSON.parse(rows[0].value);
    return normalizeEpochs(parsed);
  } catch {
    return {};
  }
}

export async function writeAppliedEpochs(
  db: DbClient, epochs: Record<string, EpochStamp>
): Promise<void> {
  await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
    APPLIED_EPOCHS_KEY, JSON.stringify(epochs),
  ]);
}

export class SqliteAppliedEpochStore implements AppliedEpochStore {
  async load(): Promise<Record<string, EpochStamp>> { return readAppliedEpochs(await getDb()); }
  async save(epochs: Record<string, EpochStamp>): Promise<void> {
    await writeAppliedEpochs(await getDb(), epochs);
  }
}
