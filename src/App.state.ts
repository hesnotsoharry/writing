/**
 * Extracted state hooks for App.tsx.
 * Kept separate so App.tsx stays under the 300-line ESLint limit.
 */
import type { MutableRefObject } from "react";
import { useRef, useState } from "react";
import * as Y from "yjs";

import { logCrudError } from "./App.handlers";
import type { BinderTree } from "./binder/buildTree";
import { buildTree } from "./binder/buildTree";
import type { Project } from "./db/binderStore";
import type { SqliteBinderStore } from "./db/sqliteBinderStore";
import type { GoalsInitialScope } from "./features/goals/Goals";
import { readGoalsOn } from "./features/goals/goalStorage";

export type AppView = "editor" | "bible" | "cork";

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
  const [showSettings, setShowSettings] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [goalsOn, setGoalsOn] = useState(() => readGoalsOn());
  const [hasQuickItems, setHasQuickItems] = useState(false);
  return {
    showQuickCapture, setShowQuickCapture,
    showInbox, setShowInbox,
    showArchive, setShowArchive,
    showGoals, setShowGoals,
    goalsInitialScope, setGoalsInitialScope,
    showExport, setShowExport,
    showSettings, setShowSettings,
    focusMode, setFocusMode,
    goalsOn, setGoalsOn,
    hasQuickItems, setHasQuickItems,
  };
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
  const modalFlags = useModalFlags();
  const activeProjectIdRef = useRef<string | null>(null);
  const loadProjectTokenRef = useRef(0);

  function setActiveProject(id: string | null) {
    activeProjectIdRef.current = id ?? null;
    setActiveProjectId(id);
  }

  return {
    tree, setTree, selectedSceneId, setSelectedSceneId,
    doc, setDoc, loading, setLoading,
    projects, setProjects, activeProjectId,
    view, setView, linksVersion, setLinksVersion,
    ...modalFlags,
    activeProjectIdRef, loadProjectTokenRef, setActiveProject,
  };
}

