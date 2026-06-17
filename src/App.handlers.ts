/**
 * Extracted CRUD and drag handler factories for App.tsx.
 * Kept separate so App.tsx stays under the 300-line ESLint limit.
 */
import type { MutableRefObject } from "react";

import type { BinderCallbacks } from "./binder/BinderCrud";
import type { DragCallbacks } from "./binder/BinderDrag";
import type { BinderTree } from "./binder/buildTree";
import { buildTree } from "./binder/buildTree";
import type { SqliteBinderStore } from "./db/sqliteBinderStore";
import type { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";

export function logCrudError(op: string) {
  return (e: unknown) => console.error(`[crud] ${op}`, e);
}

export async function reloadTree(
  binderStore: SqliteBinderStore,
  projectId: string,
  setTree: (t: BinderTree) => void
): Promise<void> {
  const { folders, scenes } = await binderStore.loadProject(projectId);
  setTree(buildTree(folders, scenes));
}

interface CrudDeps {
  binderStore: SqliteBinderStore;
  sceneDocStore: SqliteSceneDocStore;
  getProjectId: () => string;
  doReload: () => Promise<void>;
  selectedSceneId: string | null;
  clearScene: () => void;
  /** Called after a successful archive operation so callers can bump version counters. */
  onArchived?: () => void;
}

function buildArchiveCallbacks(
  binderStore: SqliteBinderStore, getProjectId: () => string,
  doReload: () => Promise<void>, onArchived: (() => void) | undefined,
): Pick<BinderCallbacks, "onArchiveScene" | "onArchiveChapter"> {
  return {
    onArchiveScene: (sceneId) => {
      binderStore.archiveScene(sceneId, getProjectId())
        .then(doReload).then(() => onArchived?.()).catch(logCrudError("archiveScene"));
    },
    onArchiveChapter: (folderId) => {
      binderStore.archiveChapter(folderId, getProjectId())
        .then(doReload).then(() => onArchived?.()).catch(logCrudError("archiveChapter"));
    },
  };
}

function buildCrudCallbacks(deps: CrudDeps): BinderCallbacks {
  const { binderStore, sceneDocStore, getProjectId, doReload, selectedSceneId, clearScene, onArchived } = deps;
  return {
    onCreateChapter: () => {
      // Creates inline at list bottom (no prompt) — user double-clicks to rename.
      binderStore.createFolder({ projectId: getProjectId(), title: "New Chapter" })
        .then(doReload).catch(logCrudError("createFolder"));
    },
    onCreateScene: (folderId) => {
      // Creates inline with a default title (no prompt) — user double-clicks to rename.
      binderStore.createScene({ projectId: getProjectId(), folderId, title: "New Scene" })
        .then(doReload).catch(logCrudError("createScene"));
    },
    onRenameFolder: (id, title) => {
      binderStore.renameFolder(id, title).then(doReload).catch(logCrudError("renameFolder"));
    },
    onRenameScene: (id, title) => {
      binderStore.renameScene(id, title).then(doReload).catch(logCrudError("renameScene"));
    },
    onDeleteChapter: (id) => {
      binderStore.deleteFolder(id).then(doReload).catch(logCrudError("deleteFolder"));
    },
    onDeleteScene: (id) => {
      if (id === selectedSceneId) clearScene();
      binderStore.deleteScene(id)
        .then(() => sceneDocStore.delete(id).catch(logCrudError("deleteScene:docCleanup")))
        .then(doReload)
        .catch(logCrudError("deleteScene"));
    },
    onSetSceneStatus: (id, status) => {
      binderStore.setSceneStatus(id, status).then(doReload).catch(logCrudError("setSceneStatus"));
    },
    onSetSceneExcludedFromAi: (id, exclude) => {
      binderStore.setSceneExcludedFromAi(id, exclude).then(doReload).catch(logCrudError("setSceneExcludedFromAi"));
    },
    ...buildArchiveCallbacks(binderStore, getProjectId, doReload, onArchived),
  };
}

interface CrudHookArgs {
  binderStore: SqliteBinderStore;
  sceneDocStore: SqliteSceneDocStore;
  activeProjectIdRef: MutableRefObject<string | null>;
  setTree: (t: BinderTree | null) => void;
  selectedSceneId: string | null;
  clearScene: () => void;
  /** Called after a successful archive operation so callers can bump version counters. */
  onArchived?: () => void;
}

export function useCrudHandlers(args: CrudHookArgs): BinderCallbacks {
  const { binderStore, sceneDocStore, activeProjectIdRef, setTree, selectedSceneId, clearScene, onArchived } = args;
  function getProjectId() {
    const id = activeProjectIdRef.current;
    if (!id) throw new Error("No active project");
    return id;
  }
  async function doReload() {
    await reloadTree(binderStore, getProjectId(), setTree as (t: BinderTree) => void);
  }
  return buildCrudCallbacks({ binderStore, sceneDocStore, getProjectId, doReload, selectedSceneId, clearScene, onArchived });
}

interface DragHookArgs {
  binderStore: SqliteBinderStore;
  activeProjectIdRef: MutableRefObject<string | null>;
  setTree: (t: BinderTree | null) => void;
}

export function useDragHandlers(args: DragHookArgs): DragCallbacks {
  const { binderStore, activeProjectIdRef, setTree } = args;
  function getProjectId() {
    const id = activeProjectIdRef.current;
    if (!id) throw new Error("No active project");
    return id;
  }
  async function doReload() {
    await reloadTree(binderStore, getProjectId(), setTree as (t: BinderTree) => void);
  }
  return {
    onMoveScene: (sceneId, toFolderId, toIndex) => {
      binderStore
        .moveScene(sceneId, toFolderId, toIndex)
        .then(doReload)
        .catch((err) => { logCrudError("moveScene")(err); doReload(); });
    },
    onMoveFolder: (folderId, toIndex) => {
      binderStore
        .moveFolder(folderId, toIndex)
        .then(doReload)
        .catch((err) => { logCrudError("moveFolder")(err); doReload(); });
    },
  };
}
