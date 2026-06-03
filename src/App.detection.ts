import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";

import type { BinderTree } from "./binder/buildTree";
import type { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import type { DetectionSync } from "./lib/detectionSync";
import { createDetectionSync } from "./lib/detectionSync";

// ---------------------------------------------------------------------------
// Module-level detection singleton
// ---------------------------------------------------------------------------

// _currentTree is mutated by useDetectionWiring (via useEffect) and read by
// listSceneIds (async — always after effects have run). Module-level is safe
// here because there is only one App instance.
let _currentTree: BinderTree | null = null;

let _sync: DetectionSync | null = null;

export function initDetectionSync(
  sceneDocStore: SqliteSceneDocStore,
  storyBibleStore: SqliteStoryBibleStore
): DetectionSync {
  if (_sync) return _sync;
  _sync = createDetectionSync({
    loadProjection: (id) => sceneDocStore.loadProjection(id),
    listEntities: (pid) => storyBibleStore.listEntities(pid),
    replaceSceneLinks: (sid, links) => storyBibleStore.replaceSceneLinks(sid, links),
    listSceneIds: () => {
      const t = _currentTree;
      if (!t) return Promise.resolve([]);
      return Promise.resolve([
        ...t.chapters.flatMap((ch) => ch.scenes.map((s) => s.id)),
        ...t.shortPieces.map((s) => s.id),
      ]);
    },
  });
  return _sync;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface DetectionWiringOpts {
  tree: BinderTree | null;
  activeProjectIdRef: MutableRefObject<string | null>;
  setLinksVersion: (fn: (v: number) => number) => void;
  sceneDocStore: SqliteSceneDocStore;
  storyBibleStore: SqliteStoryBibleStore;
}

export interface DetectionWiringResult {
  onSavedRef: MutableRefObject<((sceneId: string) => void) | undefined>;
  onEntitiesChanged: () => void;
}

export function useDetectionWiring({
  tree,
  activeProjectIdRef,
  setLinksVersion,
  sceneDocStore,
  storyBibleStore,
}: DetectionWiringOpts): DetectionWiringResult {
  const detectionSync = initDetectionSync(sceneDocStore, storyBibleStore);

  // Keep module-level tree current (async reads always land after this effect).
  useEffect(() => { _currentTree = tree; }, [tree]);

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
