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

export type AppView = "editor" | "bible";

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

export function useAppState() {
  const [tree, setTree] = useState<BinderTree | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("editor");
  const [linksVersion, setLinksVersion] = useState(0);
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
    activeProjectIdRef, loadProjectTokenRef, setActiveProject,
  };
}

