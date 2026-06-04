import type { MutableRefObject } from "react";
import { useEffect, useRef } from "react";
import * as Y from "yjs";

import { useDetectionWiring } from "./App.detection";
import { useCrudHandlers, useDragHandlers } from "./App.handlers";
import type { AppView } from "./App.state";
import { useAppState, useProjectActions } from "./App.state";
import { Binder } from "./binder/Binder";
import type { BinderCallbacks } from "./binder/BinderCrud";
import type { DragCallbacks } from "./binder/BinderDrag";
import type { BinderTree } from "./binder/buildTree";
import { buildTree } from "./binder/buildTree";
import type { Project } from "./db/binderStore";
import { getDb } from "./db/schema";
import { seedIfEmpty } from "./db/seed";
import { SqliteBinderStore } from "./db/sqliteBinderStore";
import { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import { Editor } from "./editor/Editor";
import { SceneInspector } from "./inspector/SceneInspector";
import { AppShell } from "./shell/AppShell";
import { StatusBar } from "./shell/StatusBar";
import { TitleBar } from "./shell/TitleBar";
import { StoryBibleView } from "./storybible/StoryBibleView";
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
  const { unbindRef, loadTokenRef, mountedRef, setDoc, setSelectedSceneId } =
    ctx;
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

  if (myToken !== loadTokenRef.current || !mountedRef.current) {
    unbind();
    return;
  }
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
  const {
    cancelled, setTree, setLoading, loadSceneFn,
    setProjects, setActiveProjectId,
  } = opts;
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

  const firstScene =
    builtTree.chapters[0]?.scenes[0] ?? builtTree.shortPieces[0] ?? null;
  if (firstScene && !cancelled.value) await loadSceneFn(firstScene.id);
}

function EditorPane({ doc }: { doc: Y.Doc | null }) {
  return (
    <main style={{ flex: 1, overflow: "auto" }}>
      {doc ? (
        <Editor doc={doc} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#aaa", fontSize: 14, fontFamily: "sans-serif" }}>
          Select a scene to start writing.
        </div>
      )}
    </main>
  );
}

interface AppContentProps {
  tree: BinderTree;
  selectedSceneId: string | null;
  doc: Y.Doc | null;
  onSelectScene: (sceneId: string) => void;
  callbacks: BinderCallbacks;
  projects: Project[];
  activeProjectId: string | null;
  onSwitchProject: (projectId: string) => void;
  onCreateProject: () => void;
  dragCallbacks: DragCallbacks;
  view: AppView;
  onViewChange: (view: AppView) => void;
  linksVersion: number;
  onEntitiesChanged: () => void;
}

// Phase 3: AppContent replaced by AppShell slot composition. The .win/.body token
// classes own layout — the old inline flex/height:100vh wrapper is removed.
function AppContent({
  tree, selectedSceneId, doc, onSelectScene, callbacks,
  projects, activeProjectId, onSwitchProject, onCreateProject,
  dragCallbacks, view, onViewChange, linksVersion, onEntitiesChanged,
}: AppContentProps) {
  // Active project title for the centered doc-name in TitleBar (wave-6 will add live save-state).
  const docName = projects.find((p) => p.id === activeProjectId)?.title;
  return (
    <AppShell
      titleBar={<TitleBar view={view} onViewChange={onViewChange} docName={docName} />}
      binder={
        <Binder
          tree={tree} selectedSceneId={selectedSceneId} onSelectScene={onSelectScene}
          callbacks={callbacks} projects={projects} activeProjectId={activeProjectId}
          onSwitchProject={onSwitchProject} onCreateProject={onCreateProject}
          dragCallbacks={dragCallbacks}
        />
      }
      viewStage={
        // CorkboardSlot reserved (wave-N): add view === "cork" ? <Corkboard/> branch here.
        view === "bible" && activeProjectId
          ? <StoryBibleView store={storyBibleStore} projectId={activeProjectId} onEntitiesChanged={onEntitiesChanged} />
          : <EditorPane doc={doc} />
      }
      inspector={
        // Inspector visibility: matches the existing condition exactly — editor view + active project.
        view === "editor" && activeProjectId
          ? <SceneInspector store={storyBibleStore} projectId={activeProjectId} sceneId={selectedSceneId} refreshKey={linksVersion} />
          : null
      }
      statusBar={<StatusBar sceneWordCount={null} />}
    />
  );
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
  const {
    setDoc, setSelectedSceneId, setTree, setLoading,
    setProjects, setActiveProjectId, onSavedRef,
  } = opts;
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
      setProjects,
      setActiveProjectId,
    }).catch((e) => console.error("[db] initializeProjectTree failed", e));
    return () => {
      cancelled.value = true;
      mountedRef.current = false;
      const unbind = unbindRef.current;
      unbind?.();
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


export default function App() {
  const {
    tree, setTree, selectedSceneId, setSelectedSceneId,
    doc, setDoc, loading, setLoading, projects, setProjects,
    activeProjectId, view, setView, linksVersion, setLinksVersion,
    activeProjectIdRef, loadProjectTokenRef, setActiveProject,
  } = useAppState();

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
    setProjects, setActiveProjectId: setActiveProject,
    handleSelectScene, clearScene,
  });
  const callbacks = useCrudHandlers({
    binderStore, sceneDocStore, activeProjectIdRef, setTree, selectedSceneId, clearScene,
  });
  const dragCallbacks = useDragHandlers({ binderStore, activeProjectIdRef, setTree });

  if (loading) return <p style={{ margin: 48, fontFamily: "sans-serif", color: "#666" }}>Loading…</p>;
  if (!tree) return null;
  return (
    <AppContent
      tree={tree} selectedSceneId={selectedSceneId} doc={doc}
      onSelectScene={handleSelectScene} callbacks={callbacks}
      projects={projects} activeProjectId={activeProjectId}
      onSwitchProject={onSwitchProject} onCreateProject={onCreateProject}
      dragCallbacks={dragCallbacks} view={view}
      onViewChange={setView}
      linksVersion={linksVersion} onEntitiesChanged={onEntitiesChanged}
    />
  );
}
