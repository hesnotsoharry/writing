import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

import type { SqliteBinderStore } from "./db/sqliteBinderStore";
import type { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import type { DetectionSync } from "./lib/detectionSync";
import { createDetectionSync } from "./lib/detectionSync";

// ---------------------------------------------------------------------------
// Module-level detection singleton
// ---------------------------------------------------------------------------

let _sync: DetectionSync | null = null;

export function initDetectionSync(
  sceneDocStore: SqliteSceneDocStore,
  storyBibleStore: SqliteStoryBibleStore,
  binderStore: SqliteBinderStore
): DetectionSync {
  if (_sync) return _sync;
  _sync = createDetectionSync({
    loadProjection: (id) => sceneDocStore.loadProjection(id),
    listEntities: (pid) => storyBibleStore.listEntities(pid),
    replaceSceneLinks: (sid, links) => storyBibleStore.replaceSceneLinks(sid, links),
    listSceneIds: async (projectId: string) => {
      // Derive scene ids directly from the DB at call time — no module-level
      // tree cache, no stale-read risk on project switch.
      const { scenes } = await binderStore.loadProject(projectId);
      return scenes.map((s) => s.id);
    },
  });
  return _sync;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface DetectionWiringOpts {
  activeProjectIdRef: MutableRefObject<string | null>;
  setLinksVersion: (fn: (v: number) => number) => void;
  sceneDocStore: SqliteSceneDocStore;
  storyBibleStore: SqliteStoryBibleStore;
  binderStore: SqliteBinderStore;
  /**
   * Called after word_count is persisted to the DB so the caller can
   * reload the binder tree and update the manuscript total + row counts.
   */
  onWordCountPersisted?: () => void;
}

export interface DetectionWiringResult {
  onSavedRef: MutableRefObject<((sceneId: string, wordCount: number) => void) | undefined>;
  onEntitiesChanged: () => void;
}

export function useDetectionWiring({
  activeProjectIdRef,
  setLinksVersion,
  sceneDocStore,
  storyBibleStore,
  binderStore,
  onWordCountPersisted,
}: DetectionWiringOpts): DetectionWiringResult {
  const detectionSync = initDetectionSync(sceneDocStore, storyBibleStore, binderStore);

  // onSavedRef — holds a callback stable enough for bindPersistence but
  // updated whenever deps change so it always captures the latest values.
  //
  // Fix 2 (cold-start race): useRef's initial value is set synchronously
  // before any effect runs, so the ref is never undefined between mount and
  // the first effect execution. bindPersistence schedules its initial save
  // 500ms after loadScene; without this the timer could fire before the effect
  // populated the ref, silently dropping the first word-count persist.
  // The callback reads activeProjectIdRef.current at call-time (inside the
  // async timer), not during render — the ref accesses are intentionally lazy.
  const savedCb = (sceneId: string, wordCount: number) => {
    if (!activeProjectIdRef.current) return;
    // Persist the computed word count so binder rows and the manuscript
    // total reflect real values after each debounced prose save.
    // Only fire onWordCountPersisted (→ reloadTree) when a row was actually
    // updated; a no-op update means the scene was deleted and we skip the reload.
    void binderStore.setSceneWordCount(sceneId, wordCount)
      .then((changed) => { if (changed) onWordCountPersisted?.(); })
      .catch((e: unknown) => console.error("[detection] setSceneWordCount failed", e));
    void detectionSync.linkScene(sceneId, activeProjectIdRef.current)
      .then(() => { setLinksVersion((v) => v + 1); });
  };
  const onSavedRef = useRef<((sceneId: string, wordCount: number) => void) | undefined>(savedCb);

  // Keep current in sync whenever any dependency changes (captures latest closure).
  useEffect(() => {
    onSavedRef.current = (sceneId: string, wordCount: number) => {
      if (!activeProjectIdRef.current) return;
      void binderStore.setSceneWordCount(sceneId, wordCount)
        .then((changed) => { if (changed) onWordCountPersisted?.(); })
        .catch((e: unknown) => console.error("[detection] setSceneWordCount failed", e));
      void detectionSync.linkScene(sceneId, activeProjectIdRef.current)
        .then(() => { setLinksVersion((v) => v + 1); });
    };
  }, [activeProjectIdRef, binderStore, detectionSync, onWordCountPersisted, setLinksVersion]);

  const onEntitiesChanged = () => {
    if (!activeProjectIdRef.current) return;
    void detectionSync.rescanProject(activeProjectIdRef.current)
      .then(() => { setLinksVersion((v) => v + 1); });
  };

  return { onSavedRef, onEntitiesChanged };
}
