/**
 * Extracted state hooks for App.tsx.
 * Kept separate so App.tsx stays under the 300-line ESLint limit.
 */
import type { Update } from "@tauri-apps/plugin-updater";
import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import * as Y from "yjs";

import { logCrudError } from "./App.handlers";
import type { BinderTree } from "./binder/buildTree";
import { buildTree } from "./binder/buildTree";
import type { Project } from "./db/binderStore";
import type { SqliteBinderStore } from "./db/sqliteBinderStore";
import type { ExportScope } from "./features/export/types";
import type { GoalsInitialScope } from "./features/goals/Goals";
import { readGoalsOn } from "./features/goals/goalStorage";

export interface ExportTarget {
  scope: ExportScope;
  sceneId: string | null;
  chapterId: string | null;
}

export type AppView = "editor" | "bible" | "cork" | "outline" | "entry";

/**
 * A single frame on the entry navigation stack.
 * `kind` is the display-form of the entity type (Title-case, e.g. "Character",
 * "Location", "Item", "Faction", "Lore", "Theme", or any custom type name).
 * Widened to `string` for Phase 5 (new built-in + custom entity types).
 */
export interface EntryFrame {
  id: string;
  kind: string;
}

export async function loadProject(
  binderStore: SqliteBinderStore,
  projectId: string
): Promise<BinderTree> {
  const { folders, scenes } = await binderStore.loadProject(projectId);
  return buildTree(folders, scenes);
}

export interface UseProjectOpts {
  binderStore: SqliteBinderStore;
  activeProjectIdRef: MutableRefObject<string | null>;
  loadProjectTokenRef: MutableRefObject<number>;
  setTree: (t: BinderTree) => void;
  setProjects: (ps: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
  handleSelectScene: (id: string) => void;
  clearScene: () => void;
}

export function useProjectActions({
  binderStore, activeProjectIdRef, loadProjectTokenRef, setTree, setProjects,
  setActiveProjectId, handleSelectScene, clearScene,
}: UseProjectOpts) {
  async function switchProject(projectId: string) {
    if (projectId === activeProjectIdRef.current) return;
    activeProjectIdRef.current = projectId;
    setActiveProjectId(projectId);
    clearScene();
    const myToken = ++loadProjectTokenRef.current;
    const newTree = await loadProject(binderStore, projectId);
    if (myToken !== loadProjectTokenRef.current) return;
    setTree(newTree);
    const first = newTree.chapters[0]?.scenes[0] ?? newTree.shortPieces[0] ?? null;
    if (first) void handleSelectScene(first.id);
  }

  async function createProject() {
    const title = window.prompt("Project title:", "New Project");
    if (!title?.trim()) return;
    const newId = await binderStore.createProject({ title: title.trim(), type: "novel" });
    const refreshed = await binderStore.listProjects();
    setProjects(refreshed);
    await switchProject(newId);
  }

  return {
    onSwitchProject: (id: string) => { switchProject(id).catch(logCrudError("switchProject")); },
    onCreateProject: () => { createProject().catch(logCrudError("createProject")); },
  };
}

function useModalFlags() {
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showGoals, setShowGoals] = useState(false);
  const [goalsInitialScope, setGoalsInitialScope] = useState<GoalsInitialScope | undefined>(undefined);
  const [showExport, setShowExport] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTarget>({ scope: "manuscript", sceneId: null, chapterId: null });
  const [showSettings, setShowSettings] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [goalsOn, setGoalsOn] = useState(() => readGoalsOn());
  const [hasQuickItems, setHasQuickItems] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historySceneId, setHistorySceneId] = useState<string | null>(null);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findReplaceSeed, setFindReplaceSeed] = useState("");
  const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);
  const [appInstallError, setAppInstallError] = useState<string | null>(null);
  return {
    showQuickCapture, setShowQuickCapture,
    showInbox, setShowInbox,
    showArchive, setShowArchive,
    showGoals, setShowGoals,
    goalsInitialScope, setGoalsInitialScope,
    showExport, setShowExport,
    exportTarget, setExportTarget,
    showSettings, setShowSettings,
    focusMode, setFocusMode,
    goalsOn, setGoalsOn,
    hasQuickItems, setHasQuickItems,
    showHistory, setShowHistory,
    historySceneId, setHistorySceneId,
    showFindReplace, setShowFindReplace,
    findReplaceSeed, setFindReplaceSeed,
    pendingUpdate, setPendingUpdate,
    appInstallError, setAppInstallError,
  };
}

/**
 * Entry navigation: entryStack (the current path), entryOrigin (where the user came from),
 * and the four actions the lead wires into open-triggers and FullEntry nav callbacks.
 */
function useEntryNav(setView: (v: AppView) => void, getView: () => AppView) {
  const [entryStack, setEntryStack] = useState<EntryFrame[]>([]);
  const [entryOrigin, setEntryOrigin] = useState<"write" | "bible">("bible");

  /** Open a fresh entry journey — resets the stack, captures the current view as origin. */
  function openEntry(id: string, kind: string) {
    const origin = getView() === "editor" ? "write" : "bible";
    setEntryOrigin(origin as "write" | "bible");
    setEntryStack([{ id, kind }]);
    setView("entry");
  }

  /** Push onto the stack (navigate into a related entity from within an entry). */
  function pushEntry(id: string, kind: string) {
    setEntryStack((prev) => [...prev, { id, kind }]);
  }

  /** Pop one level; when the stack depth reaches 0 exit back to the origin view. */
  function entryBack() {
    setEntryStack((prev) => {
      if (prev.length <= 1) {
        setView(entryOrigin === "write" ? "editor" : "bible");
        return [];
      }
      return prev.slice(0, -1);
    });
  }

  /** Root-crumb tap — clear the stack and return to the origin view immediately. */
  function exitEntry() {
    setEntryStack([]);
    setView(entryOrigin === "write" ? "editor" : "bible");
  }

  return { entryStack, entryOrigin, openEntry, pushEntry, entryBack, exitEntry };
}

export function useAppState() {
  const [tree, setTree] = useState<BinderTree | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("editor");
  const [linksVersion, setLinksVersion] = useState(0);
  const [archivedVersion, setArchivedVersion] = useState(0);
  const modalFlags = useModalFlags();
  const activeProjectIdRef = useRef<string | null>(null);
  const loadProjectTokenRef = useRef(0);
  // viewRef keeps a readable current value for useEntryNav's closures (avoids stale capture).
  const viewRef = useRef<AppView>("editor");

  function setViewAndRef(v: AppView) {
    viewRef.current = v;
    setView(v);
  }

  const entryNav = useEntryNav(setViewAndRef, () => viewRef.current);

  function setActiveProject(id: string | null) {
    activeProjectIdRef.current = id ?? null;
    setActiveProjectId(id);
  }

  function bumpArchivedVersion() {
    setArchivedVersion((v) => v + 1);
  }

  return {
    tree, setTree, selectedSceneId, setSelectedSceneId,
    doc, setDoc, loading, setLoading,
    projects, setProjects, activeProjectId,
    view, setView: setViewAndRef, linksVersion, setLinksVersion,
    archivedVersion, bumpArchivedVersion,
    ...modalFlags,
    activeProjectIdRef, loadProjectTokenRef, setActiveProject,
    ...entryNav,
  };
}

