import { invoke } from "@tauri-apps/api/core";

import type { DbClient } from "../db/dbClient";
import { getOrCreateDeviceId } from "../db/deviceId";
import { getDb } from "../db/schema";
import { SqliteBibleApplyTarget } from "../db/sqliteBibleApplyTarget";
import { SqliteBoardDocStore } from "../db/sqliteBoardDocStore";
import { SqliteMetaApplyTarget } from "../db/sqliteMetaApplyTarget";
import { SqlitePendingReplacementStore } from "../db/sqlitePendingReplacementStore";
import { SqliteProjectDomainDocStore } from "../db/sqliteProjectDomainDocStore";
import { SqliteProjectMetaDocStore } from "../db/sqliteProjectMetaDocStore";
import { SqliteSceneDocStore } from "../db/sqliteSceneDocStore";
import { SqliteSnapshotStore } from "../db/sqliteSnapshotStore";
import { SqliteSyncLwwStore } from "../db/sqliteSyncLwwStore";
import { SqliteSyncOutboxStore } from "../db/sqliteSyncOutboxStore";
import { SqliteAppliedEpochStore } from "../db/syncEpochStore";
import { platformLabel } from "../shell/platform";
import { ensureAllProjectBibles, subscribeBibleSaves } from "./bible/desktopBibleBridge";
import type { DeviceIdentity } from "./deviceRoster";
import type { EngineOptions } from "./engine";
import { getSyncMasterKey } from "./keyStorage";
import { subscribeLocalSceneWrites } from "./localSceneWrites";
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
  const db = desktopDbClient();
  return {
    relayUrl: DEFAULT_RELAY_URL,
    sceneStore: new SqliteSceneDocStore(), boardStore: new SqliteBoardDocStore(),
    metaStore: new SqliteProjectMetaDocStore(), metaApplyTarget: new SqliteMetaApplyTarget(),
    snapshotStore: new SqliteSnapshotStore(), epochStore: new SqliteAppliedEpochStore(),
    domainDocStore: new SqliteProjectDomainDocStore(),
    bibleApplyTarget: new SqliteBibleApplyTarget(),
    lwwStore: new SqliteSyncLwwStore(db), outboxStore: new SqliteSyncOutboxStore(db),
    pendingReplacementStore: new SqlitePendingReplacementStore(db),
    epochAcceptance: "automatic",
    loadLastPeerSeenAt: () => readLastPeerSeenAt(db),
    saveLastPeerSeenAt: (value) => writeLastPeerSeenAt(db, value),
    loadLwwClock: () => readAppMeta(db, LWW_CLOCK_KEY),
    saveLwwClock: (value) => writeAppMeta(db, LWW_CLOCK_KEY, value),
    deviceRoster: {
      load: () => readAppMeta(db, DEVICE_ROSTER_KEY),
      save: (value) => writeAppMeta(db, DEVICE_ROSTER_KEY, value),
      identity: readDeviceIdentity,
    },
    ensureProjectMetas: ensureAllProjectMetas, subscribeMetaSaves: subscribeProjectMetaSaves,
    ensureProjectBibles: ensureAllProjectBibles, subscribeBibleSaves,
    subscribeSceneWrites: subscribeLocalSceneWrites,
    readMasterKey: getSyncMasterKey, getDeviceId: getOrCreateDeviceId,
    providerFactory: (url, room, device) => new RelayProvider(url, room, device),
    updateWordCount: updateSceneWordCount,
  };
}

export function desktopDbClient(): DbClient {
  return {
    async select<T>(sql: string, params?: unknown[]): Promise<T> {
      return (await getDb()).select<T>(sql, params);
    },
    async execute(sql: string, params?: unknown[]) {
      return (await getDb()).execute(sql, params);
    },
  };
}

const LAST_PEER_SEEN_KEY = "sync_last_peer_seen_at";
const LWW_CLOCK_KEY = "sync_lww_hlc";
/** The roster lives in app_meta rather than its own table: it is a handful of
 *  rows of local observation, and app_meta already carries the sibling
 *  `sync_last_peer_seen_at` and `sync_role`. No migration to append, and none
 *  to reconcile against mobile, which stores it the same way. */
const DEVICE_ROSTER_KEY = "sync_device_roster";

async function readAppMeta(db: DbClient, key: string): Promise<string | null> {
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_meta WHERE key = ?", [key],
  );
  return rows[0]?.value ?? null;
}
async function writeAppMeta(db: DbClient, key: string, value: string): Promise<void> {
  await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [key, value]);
}
function readLastPeerSeenAt(db: DbClient): Promise<string | null> {
  return readAppMeta(db, LAST_PEER_SEEN_KEY);
}
function writeLastPeerSeenAt(db: DbClient, value: string): Promise<void> {
  return writeAppMeta(db, LAST_PEER_SEEN_KEY, value);
}

/** `device_name` is the same Rust command the pairing QR uses, so a device
 *  shows up in the list under the name it was paired with. */
async function readDeviceIdentity(): Promise<DeviceIdentity> {
  const platform = platformLabel();
  try {
    return { name: (await invoke<string>("device_name")).trim() || null, platform };
  } catch {
    return { name: null, platform };
  }
}
