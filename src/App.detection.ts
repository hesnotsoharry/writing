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
}

export interface DetectionWiringResult {
  onSavedRef: MutableRefObject<((sceneId: string) => void) | undefined>;
  onEntitiesChanged: () => void;
}

export function useDetectionWiring({
  activeProjectIdRef,
  setLinksVersion,
  sceneDocStore,
  storyBibleStore,
  binderStore,
}: DetectionWiringOpts): DetectionWiringResult {
  const detectionSync = initDetectionSync(sceneDocStore, storyBibleStore, binderStore);

  // onSavedRef — holds a callback stable enough for bindPersistence but
  // updated in an effect so it captures the latest activeProjectIdRef value.
  const onSavedRef = useRef<((sceneId: string) => void) | undefined>(undefined);
  useEffect(() => {
    onSavedRef.current = (sceneId: string) => {
      if (!activeProjectIdRef.current) return;
      void detectionSync.linkScene(sceneId, activeProjectIdRef.current)
        .then(() => { setLinksVersion((v) => v + 1); });
    };
  }, [activeProjectIdRef, detectionSync, setLinksVersion]);

  const onEntitiesChanged = () => {
    if (!activeProjectIdRef.current) return;
    void detectionSync.rescanProject(activeProjectIdRef.current)
      .then(() => { setLinksVersion((v) => v + 1); });
  };

  return { onSavedRef, onEntitiesChanged };
}
