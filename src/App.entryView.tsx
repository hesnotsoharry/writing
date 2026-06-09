/**
 * EntryViewStage — async entity loader + FullEntry renderer for the "entry" view.
 * Extracted from App.content.tsx to keep that file under the 300-line limit.
 */

import { useCallback, useEffect, useState } from "react";

import type { AppView, EntryFrame } from "./App.state";
import type { BinderTree } from "./binder/buildTree";
import type { Folder, Scene } from "./db/binderStore";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import type { EntityType, EntityWithPortrait } from "./db/storyBibleStore";
import { FullEntry } from "./storybible/fullEntry/FullEntry";

// ---------------------------------------------------------------------------
// useLoadEntry — async loader for the active entry entity
// ---------------------------------------------------------------------------

/**
 * Loads the current top-of-stack entity via store.getEntity when view === "entry".
 * Returns null while loading or when the stack is empty.
 * Also returns patchEntity — call it to optimistically update the in-memory entity
 * (e.g. after a rename) without re-fetching from the DB.
 */
export function useLoadEntry(
  store: SqliteStoryBibleStore,
  entryStack: EntryFrame[],
  view: AppView,
): { entity: EntityWithPortrait | null; patchEntity: (id: string, name: string) => void } {
  const [entity, setEntity] = useState<EntityWithPortrait | null>(null);
  const top: EntryFrame | undefined = entryStack[entryStack.length - 1];
  const topId = top?.id;
  const topKind = top?.kind;

  useEffect(() => {
    let alive = true;
    if (view !== "entry" || !topId || !topKind) {
      Promise.resolve().then(() => { if (alive) setEntity(null); }).catch(() => { /* ignore */ });
      return () => { alive = false; };
    }
    // Map display-form kind (Title-case) to storage type (lower-case).
    // "Character" → "character", "Location" → "location", others → lowercase.
    const type: EntityType = topKind.toLowerCase();
    store.getEntity(type, topId)
      .then((e) => { if (alive) setEntity(e); })
      .catch((err: unknown) => {
        console.error("[AppContent] getEntity failed", err);
        if (alive) setEntity(null);
      });
    return () => { alive = false; };
  }, [store, topId, topKind, view]);

  const patchEntity = useCallback((id: string, name: string) => {
    setEntity((prev) => prev && prev.id === id ? { ...prev, name } : prev);
  }, []);

  return { entity, patchEntity };
}

// ---------------------------------------------------------------------------
// EntryViewStage — renders FullEntry for the top-of-stack entity
// ---------------------------------------------------------------------------

export interface EntryViewStageProps {
  store: SqliteStoryBibleStore;
  entryStack: EntryFrame[];
  entryOrigin: "write" | "bible";
  tree: BinderTree;
  onSelectScene: (sceneId: string) => void;
  onPushEntry: (id: string, kind: string) => void;
  onEntryBack: () => void;
  onExitEntry: () => void;
  onDeleteEntity: (kind: string, id: string) => void;
}

export function EntryViewStage({
  store, entryStack, entryOrigin, tree, onSelectScene,
  onPushEntry, onEntryBack, onExitEntry, onDeleteEntity,
}: EntryViewStageProps) {
  const { entity, patchEntity } = useLoadEntry(store, entryStack, "entry");
  const top: EntryFrame | undefined = entryStack[entryStack.length - 1];
  const folders: Folder[] = tree.chapters.map((ch) => ch.folder);
  const scenes: Scene[] = [...tree.chapters.flatMap((ch) => ch.scenes), ...tree.shortPieces];
  const handleRename = (kind: string, id: string, name: string) => {
    const prevName = entity?.name ?? "";
    patchEntity(id, name);
    void store.renameEntity(kind.toLowerCase(), id, name).catch((err: unknown) => {
      console.error("[EntryViewStage] renameEntity failed", err);
      patchEntity(id, prevName);
    });
  };
  return (
    <FullEntry
      key={top?.id ?? "entry"}
      entity={entity}
      kind={top?.kind}
      origin={entryOrigin}
      store={store}
      folders={folders}
      scenes={scenes}
      onBack={onEntryBack}
      onExit={onExitEntry}
      onOpenScene={(sceneId) => {
        onExitEntry();
        onSelectScene(sceneId);
      }}
      onPushEntry={onPushEntry}
      onRename={handleRename}
      onDelete={(kind, id) => {
        onDeleteEntity(kind.toLowerCase(), id);
        onExitEntry();
      }}
    />
  );
}
