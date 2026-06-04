import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import * as Y from "yjs";

import { AppContent } from "./App.content";
import { useDetectionWiring } from "./App.detection";
import { useCrudHandlers, useDragHandlers } from "./App.handlers";
import { useAppState, useProjectActions } from "./App.state";
import type { BinderCallbacks } from "./binder/BinderCrud";
import type { BinderTree } from "./binder/buildTree";
import { buildTree } from "./binder/buildTree";
import type { Project } from "./db/binderStore";
import { getDb } from "./db/schema";
import { seedIfEmpty } from "./db/seed";
import { SqliteBinderStore } from "./db/sqliteBinderStore";
import { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import { useTheme } from "./theme/useTheme";
import { bindPersistence } from "./yjs/bindPersistence";
import { applyEncoded } from "./yjs/serialize";

interface LoadSceneCtx {
  unbindRef: MutableRefObject<(() => void) | null>;
  loadTokenRef: MutableRefObject<number>;
  mountedRef: MutableRefObject<boolean>;
  setDoc: (doc: Y.Doc | null) => void;
  setSelectedSceneId: (id: string | null) => void;
  onSavedRef: MutableRefObject<((sceneId: string) => void) | undefined>;
}

const sceneDocStore = new SqliteSceneDocStore();
const binderStore = new SqliteBinderStore();
const storyBibleStore = new SqliteStoryBibleStore();

async function loadScene(sceneId: string, ctx: LoadSceneCtx) {
  const { unbindRef, loadTokenRef, mountedRef, setDoc, setSelectedSceneId } = ctx;
  const myToken = ++loadTokenRef.current;
  unbindRef.current?.();
  unbindRef.current = null;
  setDoc(null);

  const d = new Y.Doc();
  const stored = await sceneDocStore.load(sceneId);
  if (myToken !== loadTokenRef.current || !mountedRef.current) return;

  applyEncoded(d, stored ?? "");
  const unbind = bindPersistence(d, sceneId, sceneDocStore, {
    debounceMs: 500,
    onSaved: (id) => { ctx.onSavedRef.current?.(id); },
  });

  if (myToken !== loadTokenRef.current || !mountedRef.current) { unbind(); return; }
  unbindRef.current = unbind;
  setSelectedSceneId(sceneId);
  setDoc(d);
}

interface InitProjectTreeOpts {
  cancelled: { value: boolean };
  setTree: (tree: BinderTree | null) => void;
  setLoading: (loading: boolean) => void;
  loadSceneFn: (sceneId: string) => Promise<void>;
  setProjects: (projects: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
}

async function initializeProjectTree(opts: InitProjectTreeOpts): Promise<void> {
  const { cancelled, setTree, setLoading, loadSceneFn, setProjects, setActiveProjectId } = opts;
  await getDb();
  await seedIfEmpty(binderStore);
  if (cancelled.value) return;

  const projects = await binderStore.listProjects();
  if (projects.length === 0 || cancelled.value) { setLoading(false); return; }

  setProjects(projects);
  const activeProject = projects[0];
  setActiveProjectId(activeProject.id);

  const { folders, scenes } = await binderStore.loadProject(activeProject.id);
  if (cancelled.value) return;

  const builtTree = buildTree(folders, scenes);
  setTree(builtTree);
  setLoading(false);

  const firstScene = builtTree.chapters[0]?.scenes[0] ?? builtTree.shortPieces[0] ?? null;
  if (firstScene && !cancelled.value) await loadSceneFn(firstScene.id);
}

interface SceneLoaderOptions {
  setDoc: (d: Y.Doc | null) => void;
  setSelectedSceneId: (id: string | null) => void;
  setTree: (t: BinderTree | null) => void;
  setLoading: (v: boolean) => void;
  setProjects: (projects: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
  onSavedRef: MutableRefObject<((sceneId: string) => void) | undefined>;
}

function useSceneLoader(opts: SceneLoaderOptions) {
  const { setDoc, setSelectedSceneId, setTree, setLoading, setProjects,
    setActiveProjectId, onSavedRef } = opts;
  const unbindRef = useRef<(() => void) | null>(null);
  const loadTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const ctx: LoadSceneCtx = { unbindRef, loadTokenRef, mountedRef, setDoc, setSelectedSceneId, onSavedRef };

  useEffect(() => {
    mountedRef.current = true;
    const cancelled = { value: false };
    initializeProjectTree({
      cancelled, setTree, setLoading,
      loadSceneFn: (id) => loadScene(id, ctx),
      setProjects, setActiveProjectId,
    }).catch((e) => console.error("[db] initializeProjectTree failed", e));
    return () => {
      cancelled.value = true;
      mountedRef.current = false;
      unbindRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearScene() {
    loadTokenRef.current += 1;
    unbindRef.current?.();
    unbindRef.current = null;
    setDoc(null);
    setSelectedSceneId(null);
  }

  return { handleSelectScene: (sceneId: string) => void loadScene(sceneId, ctx), clearScene };
}

interface AppWiring {
  callbacks: BinderCallbacks;
  dragCallbacks: ReturnType<typeof useDragHandlers>;
  onSwitchProject: (id: string) => void;
  onCreateProject: () => void;
  onEntitiesChanged: () => void;
  handleSelectScene: (sceneId: string) => void;
}

function useAppWiring(state: ReturnType<typeof useAppState>): AppWiring {
  const { setTree, setSelectedSceneId, setDoc, setLoading, setProjects,
    activeProjectIdRef, loadProjectTokenRef, setActiveProject,
    setLinksVersion, selectedSceneId } = state;
  const { onSavedRef, onEntitiesChanged } = useDetectionWiring({
    activeProjectIdRef, setLinksVersion, sceneDocStore, storyBibleStore, binderStore,
  });
  const { handleSelectScene, clearScene } = useSceneLoader({
    setDoc, setSelectedSceneId, setTree, setLoading,
    setProjects, setActiveProjectId: setActiveProject, onSavedRef,
  });
  const { onSwitchProject, onCreateProject } = useProjectActions({
    binderStore, activeProjectIdRef, loadProjectTokenRef,
    setTree: setTree as (t: BinderTree) => void,
    setProjects, setActiveProjectId: setActiveProject, handleSelectScene, clearScene,
  });
  const callbacks = useCrudHandlers({
    binderStore, sceneDocStore, activeProjectIdRef, setTree, selectedSceneId, clearScene,
  });
  const dragCallbacks = useDragHandlers({ binderStore, activeProjectIdRef, setTree });
  return { callbacks, dragCallbacks, onSwitchProject, onCreateProject, onEntitiesChanged, handleSelectScene };
}

export default function App() {
  const state = useAppState();
  const { setTheme, setAccent } = useTheme();
  const wiring = useAppWiring(state);
  const { tree, loading, selectedSceneId, doc, projects, activeProjectId,
    view, setView, linksVersion,
    showQuickCapture, setShowQuickCapture, showInbox, setShowInbox,
    showArchive, setShowArchive, showGoals, setShowGoals,
    showExport, setShowExport, showSettings, setShowSettings,
    focusMode, setFocusMode, goalsOn, setGoalsOn, hasQuickItems, setHasQuickItems } = state;

  if (loading) return <p style={{ margin: 48, fontFamily: "sans-serif", color: "#666" }}>Loading…</p>;
  if (!tree) return null;
  return (
    <AppContent
      tree={tree} selectedSceneId={selectedSceneId} doc={doc}
      onSelectScene={wiring.handleSelectScene} callbacks={wiring.callbacks}
      projects={projects} activeProjectId={activeProjectId}
      onSwitchProject={wiring.onSwitchProject} onCreateProject={wiring.onCreateProject}
      dragCallbacks={wiring.dragCallbacks} view={view} onViewChange={setView}
      linksVersion={linksVersion} onEntitiesChanged={wiring.onEntitiesChanged}
      storyBibleStore={storyBibleStore}
      overlays={{ showQuickCapture, setShowQuickCapture, showInbox, setShowInbox,
        showArchive, setShowArchive, showGoals, setShowGoals, showExport, setShowExport,
        showSettings, setShowSettings, focusMode, setFocusMode, goalsOn, setGoalsOn,
        hasQuickItems, setHasQuickItems, setTheme, setAccent }}
    />
  );
}
