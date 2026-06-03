import type { MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import { Binder } from "./binder/Binder";
import type { BinderCallbacks } from "./binder/BinderCrud";
import type { BinderTree } from "./binder/buildTree";
import { buildTree } from "./binder/buildTree";
import type { Project } from "./db/binderStore";
import { getDb } from "./db/schema";
import { seedIfEmpty } from "./db/seed";
import { SqliteBinderStore } from "./db/sqliteBinderStore";
import { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import { Editor } from "./editor/Editor";
import { bindPersistence } from "./yjs/bindPersistence";
import { applyEncoded } from "./yjs/serialize";

interface LoadSceneCtx {
  unbindRef: MutableRefObject<(() => void) | null>;
  loadTokenRef: MutableRefObject<number>;
  mountedRef: MutableRefObject<boolean>;
  setDoc: (doc: Y.Doc | null) => void;
  setSelectedSceneId: (id: string | null) => void;
}

const sceneDocStore = new SqliteSceneDocStore();
const binderStore = new SqliteBinderStore();

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
  const unbind = bindPersistence(d, sceneId, sceneDocStore, 500);

  if (myToken !== loadTokenRef.current || !mountedRef.current) {
    unbind();
    return;
  }
  unbindRef.current = unbind;
  setSelectedSceneId(sceneId);
  setDoc(d);
}

async function reloadTree(projectId: string, setTree: (t: BinderTree) => void) {
  const { folders, scenes } = await binderStore.loadProject(projectId);
  setTree(buildTree(folders, scenes));
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
}

function AppContent({
  tree, selectedSceneId, doc, onSelectScene, callbacks,
  projects, activeProjectId, onSwitchProject, onCreateProject,
}: AppContentProps) {
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <Binder
        tree={tree}
        selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene}
        callbacks={callbacks}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
      />
      <EditorPane doc={doc} />
    </div>
  );
}

interface SceneLoaderOptions {
  setDoc: (d: Y.Doc | null) => void;
  setSelectedSceneId: (id: string | null) => void;
  setTree: (t: BinderTree | null) => void;
  setLoading: (v: boolean) => void;
  setProjects: (projects: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
}

function useSceneLoader(opts: SceneLoaderOptions) {
  const {
    setDoc, setSelectedSceneId, setTree, setLoading,
    setProjects, setActiveProjectId,
  } = opts;
  const unbindRef = useRef<(() => void) | null>(null);
  const loadTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const ctx: LoadSceneCtx = { unbindRef, loadTokenRef, mountedRef, setDoc, setSelectedSceneId };

  useEffect(() => {
    mountedRef.current = true;
    const cancelled = { value: false };
    // Restore mountedRef on every (re)mount — StrictMode does mount→cleanup→remount.
    initializeProjectTree({
      cancelled, setTree, setLoading,
      loadSceneFn: (id) => loadScene(id, ctx),
      setProjects,
      setActiveProjectId,
    }).catch((e) => console.error("[db] initializeProjectTree failed", e));
    return () => {
      cancelled.value = true;
      mountedRef.current = false;
      // Snapshot at cleanup time to satisfy react-hooks/exhaustive-deps.
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

function logCrudError(op: string) {
  return (e: unknown) => console.error(`[crud] ${op}`, e);
}

function makeCrudHandlers(
  getProjectId: () => string,
  doReload: () => Promise<void>,
  selectedSceneId: string | null,
  clearScene: () => void
): BinderCallbacks {
  return {
    onCreateChapter: () => {
      const title = window.prompt("Chapter title:", "New Chapter");
      if (!title?.trim()) return;
      binderStore.createFolder({ projectId: getProjectId(), title: title.trim() })
        .then(doReload).catch(logCrudError("createFolder"));
    },
    onCreateScene: (folderId) => {
      const title = window.prompt("Scene title:", "New Scene");
      if (!title?.trim()) return;
      binderStore.createScene({ projectId: getProjectId(), folderId, title: title.trim() })
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
  };
}

function useCrudHandlers(
  activeProjectIdRef: MutableRefObject<string | null>,
  setTree: (t: BinderTree | null) => void,
  selectedSceneId: string | null,
  clearScene: () => void
): BinderCallbacks {
  function getProjectId() {
    const id = activeProjectIdRef.current;
    if (!id) throw new Error("No active project");
    return id;
  }
  async function doReload() {
    await reloadTree(getProjectId(), setTree as (t: BinderTree) => void);
  }
  return makeCrudHandlers(getProjectId, doReload, selectedSceneId, clearScene);
}

async function loadProject(projectId: string): Promise<BinderTree> {
  const { folders, scenes } = await binderStore.loadProject(projectId);
  return buildTree(folders, scenes);
}

interface UseProjectOpts {
  activeProjectIdRef: MutableRefObject<string | null>;
  loadProjectTokenRef: MutableRefObject<number>;
  setTree: (t: BinderTree) => void;
  setProjects: (ps: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
  handleSelectScene: (id: string) => void;
  clearScene: () => void;
}

/** Encapsulates switch + create so App() stays under the 40-line limit. */
function useProjectActions({
  activeProjectIdRef, loadProjectTokenRef, setTree, setProjects,
  setActiveProjectId, handleSelectScene, clearScene,
}: UseProjectOpts) {
  async function switchProject(projectId: string) {
    if (projectId === activeProjectIdRef.current) return;
    activeProjectIdRef.current = projectId;
    setActiveProjectId(projectId);
    clearScene();
    const myToken = ++loadProjectTokenRef.current;
    const newTree = await loadProject(projectId);
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

export default function App() {
  const [tree, setTree] = useState<BinderTree | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const activeProjectIdRef = useRef<string | null>(null);
  const loadProjectTokenRef = useRef(0);

  function setActiveProject(id: string | null) {
    activeProjectIdRef.current = id ?? null;
    setActiveProjectId(id);
  }

  const { handleSelectScene, clearScene } = useSceneLoader({
    setDoc, setSelectedSceneId, setTree, setLoading,
    setProjects, setActiveProjectId: setActiveProject,
  });
  const { onSwitchProject, onCreateProject } = useProjectActions({
    activeProjectIdRef, loadProjectTokenRef,
    setTree: setTree as (t: BinderTree) => void,
    setProjects, setActiveProjectId: setActiveProject,
    handleSelectScene, clearScene,
  });
  const callbacks = useCrudHandlers(activeProjectIdRef, setTree, selectedSceneId, clearScene);

  if (loading) return <p style={{ margin: 48, fontFamily: "sans-serif", color: "#666" }}>Loading…</p>;
  if (!tree) return null;
  return (
    <AppContent
      tree={tree} selectedSceneId={selectedSceneId} doc={doc}
      onSelectScene={handleSelectScene} callbacks={callbacks}
      projects={projects} activeProjectId={activeProjectId}
      onSwitchProject={onSwitchProject} onCreateProject={onCreateProject}
    />
  );
}
