import type { DbClient } from "./dbClient";
import { getDb } from "./schema";

const APPLIED_EPOCHS_KEY = "sync_applied_epochs";

export interface AppliedEpochStore {
  load(): Promise<Record<string, number>>;
  save(epochs: Record<string, number>): Promise<void>;
}

function validEpochs(value: unknown): value is Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((epoch) =>
    typeof epoch === "number" && Number.isInteger(epoch) && epoch >= 0
  );
}

export async function readAppliedEpochs(db: DbClient): Promise<Record<string, number>> {
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_meta WHERE key = ?", [APPLIED_EPOCHS_KEY]
  );
  if (!rows[0]) return {};
  try {
    const parsed: unknown = JSON.parse(rows[0].value);
    return validEpochs(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function writeAppliedEpochs(
  db: DbClient, epochs: Record<string, number>
): Promise<void> {
  await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
    APPLIED_EPOCHS_KEY, JSON.stringify(epochs),
  ]);
}

export class SqliteAppliedEpochStore implements AppliedEpochStore {
  async load(): Promise<Record<string, number>> { return readAppliedEpochs(await getDb()); }
  async save(epochs: Record<string, number>): Promise<void> {
    await writeAppliedEpochs(await getDb(), epochs);
  }
}
