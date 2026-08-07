import { getOrCreateDeviceId } from "../db/deviceId";
import { getDb } from "../db/schema";
import { SqliteBoardDocStore } from "../db/sqliteBoardDocStore";
import { SqliteMetaApplyTarget } from "../db/sqliteMetaApplyTarget";
import { SqliteProjectMetaDocStore } from "../db/sqliteProjectMetaDocStore";
import { SqliteSceneDocStore } from "../db/sqliteSceneDocStore";
import { SqliteSnapshotStore } from "../db/sqliteSnapshotStore";
import { SqliteAppliedEpochStore } from "../db/syncEpochStore";
import type { EngineOptions } from "./engine";
import { getSyncMasterKey } from "./keyStorage";
import { ensureAllProjectMetas, subscribeProjectMetaSaves } from "./meta/bridge";
import { RelayProvider } from "./provider";

async function updateSceneWordCount(sceneId: string, count: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE scenes SET word_count = $1 WHERE id = $2", [count, sceneId]);
}

/** The relay this build connects to absent a `syncRelayUrl` tweak override —
 *  also the value the pairing QR encodes when the tweak is unset (S4 step 4). */
export const DEFAULT_RELAY_URL = (import.meta.env.VITE_SYNC_RELAY_URL as string | undefined)
  ?? "wss://sync.writersnook.app";

export function defaultEngineOptions(): EngineOptions {
  return {
    relayUrl: DEFAULT_RELAY_URL,
    sceneStore: new SqliteSceneDocStore(), boardStore: new SqliteBoardDocStore(),
    metaStore: new SqliteProjectMetaDocStore(), metaApplyTarget: new SqliteMetaApplyTarget(),
    snapshotStore: new SqliteSnapshotStore(), epochStore: new SqliteAppliedEpochStore(),
    ensureProjectMetas: ensureAllProjectMetas, subscribeMetaSaves: subscribeProjectMetaSaves,
    readMasterKey: getSyncMasterKey, getDeviceId: getOrCreateDeviceId,
    providerFactory: (url, room, device) => new RelayProvider(url, room, device),
    updateWordCount: updateSceneWordCount,
  };
}
