// Mobile mirror of src/db/syncEpochStore.ts's app_meta JSON pattern, over the
// mobile DbClient. Mirrored rather than shared: the desktop file's
// `SqliteAppliedEpochStore` class imports Tauri-bearing schema.ts, and even
// though `readAppliedEpochs`/`writeAppliedEpochs` are themselves pure
// DbClient-parameterized functions, importing that module at the value level
// would still pull schema.ts into the mobile bundle via its module-scope
// `import { getDb } from "./schema"` (S4 blueprint portable-boundary rule).
import {
  type EpochStamp,
  normalizeEpochStamp,
} from "@writersnook/sync/meta/metaDoc";

import type { AppliedEpochStore } from "../../shared/syncEpochStore";
import { getMobileDb } from "../database";

const APPLIED_EPOCHS_KEY = "sync_applied_epochs";

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

export class MobileEpochStore implements AppliedEpochStore {
  async load(): Promise<Record<string, EpochStamp>> {
    const db = await getMobileDb();
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

  async save(epochs: Record<string, EpochStamp>): Promise<void> {
    const db = await getMobileDb();
    await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
      APPLIED_EPOCHS_KEY, JSON.stringify(epochs),
    ]);
  }
}
