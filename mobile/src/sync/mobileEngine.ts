// Composes the shared SyncEngine (src/sync/engine.ts) with mobile-side
// dependencies for S4 step 5 (scene read + sync-down). Mirrors
// src/sync/desktopEngine.ts's "construct once, export the singleton" shape —
// see that file's `export const syncEngine = new SyncEngine(...)`.
import { getMobileDb } from "../db/database";
import { MobileMetaApplyTarget } from "../db/mobileMetaApplyTarget";
import { MobileBoardDocStore } from "../db/syncStores/mobileBoardDocStore";
import { MobileEpochStore } from "../db/syncStores/mobileEpochStore";
import { MobilePendingReplacementStore } from "../db/syncStores/mobilePendingReplacementStore";
import { MobileProjectDomainDocStore } from "../db/syncStores/mobileProjectDomainDocStore";
import { MobileProjectMetaDocStore } from "../db/syncStores/mobileProjectMetaDocStore";
import { MobileSceneDocStore } from "../db/syncStores/mobileSceneDocStore";
import { MobileSnapshotStore } from "../db/syncStores/mobileSnapshotStore";
import { MobileSyncLwwStore } from "../db/syncStores/mobileSyncLwwStore";
import { MobileSyncOutboxStore } from "../db/syncStores/mobileSyncOutboxStore";
import type { DbClient } from "../shared/dbClient";
import type { EngineOptions } from "../shared/engine";
import { SyncEngine } from "../shared/engine";
import { RelayProvider } from "../shared/provider";
import { getOrCreateMobileDeviceId } from "./mobileDeviceId";
import { getSyncMasterKey } from "./mobileKeyStorage";
import {
  createMobileLiveScenePort as buildMobileLiveScenePort,
  type MobileLiveScenePort,
  type MobileLiveScenePortOptions,
} from "./mobileLiveScenePort";
import { getMobileRelayUrlOverride, resolveMobileRelayUrl } from "./mobileRelayUrl";

/**
 * Same production relay as src/sync/engineDefaults.ts's `DEFAULT_RELAY_URL`
 * — duplicated as a literal, not imported, because engineDefaults.ts pulls
 * in `import.meta.env` (Vite-only)
 * plus the desktop Sqlite*Store classes (Tauri-bearing) — both forbidden on
 * mobile (S4 blueprint portable-boundary rule).
 */
const DEFAULT_RELAY_URL = "wss://sync.writersnook.app";
const mobileSceneStore = new MobileSceneDocStore();

async function updateSceneWordCount(sceneId: string, count: number): Promise<void> {
  const db = await getMobileDb();
  await db.execute("UPDATE scenes SET word_count = $1 WHERE id = $2", [count, sceneId]);
}

function buildMobileEngineOptions(): EngineOptions {
  const db = deferredMobileDbClient();
  return {
    relayUrl: DEFAULT_RELAY_URL,
    sceneStore: mobileSceneStore,
    boardStore: new MobileBoardDocStore(),
    metaStore: new MobileProjectMetaDocStore(),
    metaApplyTarget: new MobileMetaApplyTarget(),
    snapshotStore: new MobileSnapshotStore(),
    epochStore: new MobileEpochStore(),
    domainDocStore: new MobileProjectDomainDocStore(db),
    lwwStore: new MobileSyncLwwStore(db), outboxStore: new MobileSyncOutboxStore(db),
    pendingReplacementStore: new MobilePendingReplacementStore(db),
    epochAcceptance: "manual",
    loadLastPeerSeenAt: () => readLastPeerSeenAt(db),
    saveLastPeerSeenAt: (value) => writeLastPeerSeenAt(db, value),
    // No `ensureProjectMetas`/`subscribeMetaSaves`: those bootstrap/notify
    // *local* project-meta edits, which only happen on the desktop authoring
    // side. Mobile is always the "joined" (scanning) side per the S4
    // blueprint's QR pairing note — it never creates a project locally or
    // edits binder structure locally in S4 (read-only), so both stay unset.
    readMasterKey: getSyncMasterKey,
    getDeviceId: getOrCreateMobileDeviceId,
    providerFactory: (url, room, device) => new RelayProvider(url, room, device),
    updateWordCount: updateSceneWordCount,
  };
}

function deferredMobileDbClient(): DbClient {
  return {
    async select<T>(sql: string, params?: unknown[]): Promise<T> {
      return (await getMobileDb()).select<T>(sql, params);
    },
    async execute(sql: string, params?: unknown[]) {
      return (await getMobileDb()).execute(sql, params);
    },
  };
}

async function readLastPeerSeenAt(db: DbClient): Promise<string | null> {
  const rows = await db.select<Array<{ value: string }>>(
    "SELECT value FROM app_meta WHERE key = ?", ["sync_last_peer_seen_at"],
  );
  return rows[0]?.value ?? null;
}
async function writeLastPeerSeenAt(db: DbClient, value: string): Promise<void> {
  await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
    "sync_last_peer_seen_at", value,
  ]);
}

/** The mobile SyncEngine singleton. Call `.start()` after pairing / on app
 *  boot when a key + joined role already exist; `.stop()`/`.subscribe()`/
 *  `.pause()`/`.resume()` are the same public surface as desktop's. */
export const mobileEngine = new SyncEngine(buildMobileEngineOptions());

/** Compose a mounted editor bridge with the shared mobile engine and store. */
export function createMobileLiveScenePort(
  options: MobileLiveScenePortOptions,
): MobileLiveScenePort {
  return buildMobileLiveScenePort(options, {
    engine: mobileEngine,
    sceneStore: mobileSceneStore,
    updateWordCount: updateSceneWordCount,
  });
}

/** Start against a persisted pairing override, or the production relay. */
export async function startMobileEngine(): Promise<void> {
  const override = await getMobileRelayUrlOverride();
  await mobileEngine.start(resolveMobileRelayUrl(override, DEFAULT_RELAY_URL));
}

// ── Structure-changed fan-out ────────────────────────────────────────────
// `SyncEngine.onStructureChanged` holds a single callback slot (one desktop
// window assumed one listener); mobile has two screens (ProjectList,
// ProjectBinder) that may independently want to refetch when a remote meta
// doc lands, so this module owns the slot and fans out to a Set instead.
const structureListeners = new Set<() => void>();
mobileEngine.onStructureChanged(() => {
  structureListeners.forEach((listener) => listener());
});

/** Subscribe to "some project's structure changed" (remote meta merge landed). */
export function subscribeMobileStructureChanged(listener: () => void): () => void {
  structureListeners.add(listener);
  return () => structureListeners.delete(listener);
}

// ── Doc-replaced fan-out ─────────────────────────────────────────────────
// Same single-slot reason as above. In S4 (no live bridge — `attachLiveDoc`
// is never called on mobile) this only fires for scenes with an attached
// live doc, so it stays inert until S5's editor bridge starts attaching one;
// SceneScreen's primary freshness source for S4 is refetch-on-focus.
const docReplacedListeners = new Set<(sceneId: string) => void>();
mobileEngine.onDocReplaced((sceneId) => {
  docReplacedListeners.forEach((listener) => listener(sceneId));
});

/** Subscribe to "this scene's stored doc was replaced by a remote epoch bump". */
export function subscribeMobileDocReplaced(listener: (sceneId: string) => void): () => void {
  docReplacedListeners.add(listener);
  return () => docReplacedListeners.delete(listener);
}
