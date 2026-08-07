// Composes the shared SyncEngine (src/sync/engine.ts) with mobile-side
// dependencies for S4 step 5 (scene read + sync-down). Mirrors
// src/sync/desktopEngine.ts's "construct once, export the singleton" shape —
// see that file's `export const syncEngine = new SyncEngine(...)`.
import { MobileMetaApplyTarget } from "../db/mobileMetaApplyTarget";
import { MobileBoardDocStore } from "../db/syncStores/mobileBoardDocStore";
import { MobileEpochStore } from "../db/syncStores/mobileEpochStore";
import { MobileProjectMetaDocStore } from "../db/syncStores/mobileProjectMetaDocStore";
import { MobileSceneDocStore } from "../db/syncStores/mobileSceneDocStore";
import { MobileSnapshotStore } from "../db/syncStores/mobileSnapshotStore";
import type { EngineOptions } from "../shared/engine";
import { SyncEngine } from "../shared/engine";
import { RelayProvider } from "../shared/provider";
import { getMobileDb } from "../db/database";
import { getSyncMasterKey } from "./mobileKeyStorage";
import { getOrCreateMobileDeviceId } from "./mobileDeviceId";

/**
 * Same production relay as src/sync/engineDefaults.ts's `DEFAULT_RELAY_URL`
 * and PairScreen's `FALLBACK_RELAY_URL` — duplicated as a literal, not
 * imported, because engineDefaults.ts pulls in `import.meta.env` (Vite-only)
 * plus the desktop Sqlite*Store classes (Tauri-bearing) — both forbidden on
 * mobile (S4 blueprint portable-boundary rule).
 */
const DEFAULT_RELAY_URL = "wss://sync.writersnook.app";

async function updateSceneWordCount(sceneId: string, count: number): Promise<void> {
  const db = await getMobileDb();
  await db.execute("UPDATE scenes SET word_count = $1 WHERE id = $2", [count, sceneId]);
}

function buildMobileEngineOptions(): EngineOptions {
  return {
    relayUrl: DEFAULT_RELAY_URL,
    sceneStore: new MobileSceneDocStore(),
    boardStore: new MobileBoardDocStore(),
    metaStore: new MobileProjectMetaDocStore(),
    metaApplyTarget: new MobileMetaApplyTarget(),
    snapshotStore: new MobileSnapshotStore(),
    epochStore: new MobileEpochStore(),
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

/** The mobile SyncEngine singleton. Call `.start()` after pairing / on app
 *  boot when a key + joined role already exist; `.stop()`/`.subscribe()`/
 *  `.pause()`/`.resume()` are the same public surface as desktop's. */
export const mobileEngine = new SyncEngine(buildMobileEngineOptions());

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
