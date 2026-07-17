import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import { useAutoSnapHooks } from "./App.autoSnap";
import { AppContent } from "./App.content";
import { useDetectionWiring } from "./App.detection";
import { reloadTree, useCrudHandlers, useDragHandlers } from "./App.handlers";
import { backfillSnapshotWordCounts, fetchSnapshotText, snapCapture, type SnapCtx, snapDelete, snapRename, snapRestore, snapshotStore, snapTakeFromMenu, snapUndoReplace, useActiveSceneSnapshots } from "./App.snapshots";
import { useAppState, useProjectActions } from "./App.state";
import type { BinderCallbacks } from "./binder/BinderCrud";
import { type BinderTree,buildTree } from "./binder/buildTree";
import type { Project } from "./db/binderStore";
import { getDb } from "./db/schema";
import { seedIfEmpty } from "./db/seed";
import type { Snapshot } from "./db/snapshotStore";
import { SqliteBinderStore } from "./db/sqliteBinderStore";
import { SqliteLabelStore } from "./db/sqliteLabelStore";
import { SqliteSceneDocStore } from "./db/sqliteSceneDocStore";
import { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import { fetchAndStoreHouseStyleConfig } from "./features/ai/ai.house-style";
import { ActivationGate } from "./features/license/ActivationGate";
import { useLicenseGate } from "./features/license/license.gate";
import { useStartupUpdateCheck } from "./lib/updater";
import { useTheme } from "./theme/useTheme";
import { bindPersistence } from "./yjs/bindPersistence";
import { applyEncoded, extractPlainText } from "./yjs/serialize";

interface LoadSceneCtx {
  unbindRef: MutableRefObject<(() => void) | null>;
  loadTokenRef: MutableRefObject<number>;
  mountedRef: MutableRefObject<boolean>;
  setDoc: (doc: Y.Doc | null) => void;
  setSelectedSceneId: (id: string | null) => void;
  onSavedRef: MutableRefObject<((sceneId: string, wordCount: number) => void) | undefined>;
}

const sceneDocStore = new SqliteSceneDocStore();
const binderStore = new SqliteBinderStore();
const storyBibleStore = new SqliteStoryBibleStore();
const labelStore = new SqliteLabelStore();
/**
 * Startup backfill: for every scene with word_count=0, load its stored
 * plaintext_projection and persist the real word count. Idempotent — only
 * touches word_count=0 scenes, so a backfilled scene (non-zero) is skipped
 * on all subsequent app launches. Returns the number of scenes updated.
 */
async function backfillWordCounts(projectId: string): Promise<number> {
  const { scenes } = await binderStore.loadProject(projectId);
  const zeroes = scenes.filter((s) => s.word_count === 0);
  if (zeroes.length === 0) return 0;

  let updated = 0;
  await Promise.all(
    zeroes.map(async (scene) => {
      const projection = await sceneDocStore.loadProjection(scene.id);
      if (!projection) return; // no persisted prose yet — leave at 0
      const wordCount = projection.trim()
        ? projection.trim().split(/\s+/).filter(Boolean).length
        : 0;
      if (wordCount === 0) return; // genuinely empty doc — leave at 0
      const changed = await binderStore.setSceneWordCount(scene.id, wordCount);
      if (changed) updated += 1;
    })
  );
  return updated;
}

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
    onSaved: (id, wordCount) => { ctx.onSavedRef.current?.(id, wordCount); },
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

/** Run startup word-count backfill and refresh the tree if any rows changed. */
async function backfillAndReload(projectId: string, setTree: (t: BinderTree) => void, cancelled: { value: boolean }): Promise<void> {
  const backfilled = await backfillWordCounts(projectId);
  if (backfilled > 0 && !cancelled.value) await reloadTree(binderStore, projectId, setTree);
}

/** Pick the first scene from a built tree, or null if none exist. */
function firstSceneOf(tree: BinderTree): (typeof tree.shortPieces)[0] | null {
  return tree.chapters[0]?.scenes[0] ?? tree.shortPieces[0] ?? null;
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

  // Backfill word counts for scenes that existed before Phase 2's persistence
  // landed. Runs after the UI is already visible; reload tree if rows changed
  // so binder rows show real counts on first open.
  if (!cancelled.value) {
    await backfillAndReload(activeProject.id, setTree as (t: BinderTree) => void, cancelled);
  }

  const firstScene = firstSceneOf(builtTree);
  if (firstScene && !cancelled.value) await loadSceneFn(firstScene.id);
}

interface SceneLoaderOptions {
  setDoc: (d: Y.Doc | null) => void;
  setSelectedSceneId: (id: string | null) => void;
  setTree: (t: BinderTree | null) => void;
  setLoading: (v: boolean) => void;
  setProjects: (projects: Project[]) => void;
  setActiveProjectId: (id: string | null) => void;
  onSavedRef: MutableRefObject<((sceneId: string, wordCount: number) => void) | undefined>;
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
  callbacks: BinderCallbacks; dragCallbacks: ReturnType<typeof useDragHandlers>;
  onSwitchProject: (id: string) => void; onCreateProject: (title: string) => void;
  onEntitiesChanged: () => void; handleSelectScene: (sceneId: string) => void;
  reloadTree: () => void;
}

function useAppWiring(state: ReturnType<typeof useAppState>): AppWiring {
  const { setTree, setSelectedSceneId, setDoc, setLoading, setProjects,
    activeProjectIdRef, loadProjectTokenRef, setActiveProject,
    setLinksVersion, selectedSceneId, doc } = state;
  // Fix 3: stable callback identity — wrapping in useCallback ensures the
  // detection-wiring effect does not re-run on every render because
  // onWordCountPersisted was a new inline arrow each time.
  const onWordCountPersisted = useCallback(() => {
    const id = activeProjectIdRef.current;
    if (!id) return;
    reloadTree(binderStore, id, setTree as (t: BinderTree) => void)
      .catch((e) => console.error("[wiring] reloadTree after word-count persist failed", e));
  }, [activeProjectIdRef, setTree]);

  const { onSavedRef, onEntitiesChanged } = useDetectionWiring({
    activeProjectIdRef, setLinksVersion, sceneDocStore, storyBibleStore, binderStore,
    onWordCountPersisted,
  });
  const { handleSelectScene, clearScene } = useSceneLoader({
    setDoc, setSelectedSceneId, setTree, setLoading,
    setProjects, setActiveProjectId: setActiveProject, onSavedRef,
  });
  const selectScene = useAutoSnapHooks(selectedSceneId, doc, handleSelectScene);
  const { onSwitchProject, onCreateProject } = useProjectActions({
    binderStore, activeProjectIdRef, loadProjectTokenRef,
    setTree: setTree as (t: BinderTree) => void,
    setProjects, setActiveProjectId: setActiveProject, handleSelectScene, clearScene,
  });
  const { bumpArchivedVersion } = state;
  const callbacks = useCrudHandlers({
    binderStore, sceneDocStore, activeProjectIdRef, setTree, selectedSceneId, clearScene,
    onArchived: bumpArchivedVersion,
  });
  const dragCallbacks = useDragHandlers({ binderStore, activeProjectIdRef, setTree });
  function doReloadTree() {
    const id = activeProjectIdRef.current;
    if (!id) return;
    reloadTree(binderStore, id, setTree as (t: BinderTree) => void)
      .catch((e) => console.error("[wiring] reloadTree failed", e));
  }
  return { callbacks, dragCallbacks, onSwitchProject, onCreateProject, onEntitiesChanged,
    handleSelectScene: selectScene, reloadTree: doReloadTree };
}
function useSnapshotState(doc: Y.Doc | null, selectedSceneId: string | null, showHistory: boolean, historySceneId: string | null) {
  const [historySnapshots, setHistorySnapshots] = useState<Snapshot[]>([]);
  useEffect(() => {
    if (!historySceneId || !showHistory) return;
    let alive = true;
    snapshotStore.listSnapshots(historySceneId).then((list) => {
      if (!alive) return;
      setHistorySnapshots(list);
      if (list.some((s) => s.wordCount === 0)) { void backfillSnapshotWordCounts(snapshotStore, historySceneId, (u) => { if (alive) setHistorySnapshots(u); }); }
    }).catch((e: unknown) => console.error("[snapshots] listSnapshots failed", e));
    return () => { alive = false; };
  }, [historySceneId, showHistory]);
  // Derive baseline text inline. Only use the in-memory doc when it's for the overlay scene.
  // For cross-scene overlay (context-menu on a different scene), show empty — better than wrong.
  const historyCurrentText = historySceneId === selectedSceneId
    ? (doc && selectedSceneId ? extractPlainText(doc) : "")
    : "";
  const historyCurrentWords = historyCurrentText.trim() ? historyCurrentText.trim().split(/\s+/).filter(Boolean).length : 0;
  return { historySnapshots, setHistorySnapshots, historyCurrentText, historyCurrentWords };
}

function useAppCore() {
  const state = useAppState();
  useStartupUpdateCheck((u) => state.setPendingUpdate(u));
  const { setTheme, setAccent } = useTheme();
  const wiring = useAppWiring(state);
  const { doc, selectedSceneId, showHistory, historySceneId } = state;
  const snap = useSnapshotState(doc, selectedSceneId, showHistory, historySceneId);
  // Rail snapshots: always track the active scene, independent of the overlay.
  const [railRefreshKey, setRailRefreshKey] = useState(0); const bumpRailKey = useCallback(() => setRailRefreshKey((k) => k + 1), []);
  const railSnapshots = useActiveSceneSnapshots(snapshotStore, selectedSceneId, railRefreshKey);
  return { state, wiring, snap, railSnapshots, bumpRailKey, setTheme, setAccent };
}
interface OverlaysInput {
  state: ReturnType<typeof useAppState>; wiring: AppWiring;
  snap: ReturnType<typeof useSnapshotState>; ctx: SnapCtx;
  sceneTitle: (id: string | null) => string; tree: BinderTree;
  setTheme: ReturnType<typeof useTheme>["setTheme"]; setAccent: ReturnType<typeof useTheme>["setAccent"];
  bumpRailKey: () => void;
}

function makeOverlays({ state, wiring, snap, ctx, sceneTitle, tree, setTheme, setAccent, bumpRailKey }: OverlaysInput) {
  const { showQuickCapture, setShowQuickCapture, showInbox, setShowInbox,
    showArchive, setShowArchive, showGoals, setShowGoals, goalsInitialScope, setGoalsInitialScope,
    showExport, setShowExport, exportTarget, setExportTarget, showSettings, setShowSettings,
    focusMode, setFocusMode, goalsOn, setGoalsOn, hasQuickItems, setHasQuickItems,
    showHistory, setShowHistory, historySceneId, bumpArchivedVersion,
    showFindReplace, setShowFindReplace, findReplaceSeed, setFindReplaceSeed, activeProjectId, projects, pendingUpdate, setPendingUpdate, appInstallError, setAppInstallError } = state;
  const { historySnapshots, setHistorySnapshots, historyCurrentText, historyCurrentWords } = snap;
  const histTitle = historySceneId ? (sceneTitle(historySceneId) || sceneTitle(state.selectedSceneId)) : sceneTitle(state.selectedSceneId);
  return {
    showQuickCapture, setShowQuickCapture, showInbox, setShowInbox, onAfterPromote: () => wiring.reloadTree(),
    showArchive, setShowArchive, showGoals, setShowGoals, goalsInitialScope, setGoalsInitialScope,
    showExport, setShowExport, exportScope: exportTarget.scope, exportSceneId: exportTarget.sceneId,
    exportChapterId: exportTarget.chapterId, exportProjectTitle: projects.find((p) => p.id === activeProjectId)?.title,
    setExportTarget: (opts: { scope: typeof exportTarget.scope; sceneId: string | null; chapterId: string | null }) => setExportTarget(opts),
    exportSceneDocStore: sceneDocStore, exportTree: tree, showSettings, setShowSettings,
    focusMode, setFocusMode, goalsOn, setGoalsOn, hasQuickItems, setHasQuickItems,
    setTheme, setAccent, binderStore,
    onArchiveChanged: () => { bumpArchivedVersion(); wiring.reloadTree(); },
    showHistory, setShowHistory, historySceneId, historySceneTitle: histTitle,
    historySnapshots, historyCurrentText, historyCurrentWords,
    onHistoryCapture: () => historySceneId ? snapCapture({ targetSceneId: historySceneId, isActive: historySceneId === ctx.sceneId, activeDoc: ctx.doc, set: setHistorySnapshots, load: sceneDocStore.load.bind(sceneDocStore) }).then((id) => { bumpRailKey(); return id; }) : Promise.resolve(null),
    onHistoryRename: (id: string, label: string) => { void snapRename(id, label, historySceneId, setHistorySnapshots).then(() => bumpRailKey()); },
    onHistoryRestore: (id: string) => historySceneId ? snapRestore({ targetSceneId: historySceneId, isActive: historySceneId === ctx.sceneId, activeDoc: ctx.doc, set: setHistorySnapshots, load: sceneDocStore.load.bind(sceneDocStore), save: sceneDocStore.save.bind(sceneDocStore), reloadScene: wiring.handleSelectScene }, id).then(() => bumpRailKey()) : Promise.resolve(),
    onHistoryDelete: (id: string) => { void snapDelete(id, historySceneId, setHistorySnapshots).then(() => bumpRailKey()); },
    onHistoryGetText: fetchSnapshotText,
    showFindReplace, setShowFindReplace, findReplaceSeed, setFindReplaceSeed,
    findReplaceProjectId: activeProjectId, findReplaceSnapshotStore: snapshotStore,
    onFindReplaceJump: wiring.handleSelectScene,
    onUndoReplace: (sceneIds: string[]) => snapUndoReplace(sceneIds, sceneDocStore.save.bind(sceneDocStore), (sceneId: string) => (sceneId === ctx.sceneId ? ctx.doc : null), (sceneId: string) => { if (sceneId === ctx.sceneId) wiring.handleSelectScene(sceneId); }),
    onAfterReplace: (sceneId: string) => { if (sceneId === ctx.sceneId) wiring.handleSelectScene(sceneId); }, pendingUpdate, setPendingUpdate, appInstallError, setAppInstallError,
  };
}

export default function App() {
  const { state, wiring, snap, railSnapshots, bumpRailKey, setTheme, setAccent } = useAppCore();
  const { tree, loading, selectedSceneId, doc, projects, activeProjectId,
    view, setView, linksVersion, archivedVersion,
    setShowHistory, setHistorySceneId,
    entryStack, entryOrigin, openEntry, pushEntry, entryBack, exitEntry } = state; const { setHistorySnapshots } = snap;
  const { gateStatus, onActivated, daysLeft, trialExpired } = useLicenseGate(!loading); const [activationOpen, setActivationOpen] = useState(false); useEffect(() => { void fetchAndStoreHouseStyleConfig(); }, []);

  if (loading || gateStatus === "checking") return <p style={{ margin: 48, fontFamily: "sans-serif", color: "#666" }}>Loading…</p>;
  if (gateStatus === "needed") return <ActivationGate onActivated={onActivated} trialExpired={trialExpired} />;
  if (gateStatus === "trial" && activationOpen) return <ActivationGate onActivated={onActivated} onDismiss={() => setActivationOpen(false)} />;
  if (!tree) return null;
  const ctx: SnapCtx = { sceneId: selectedSceneId, doc, set: setHistorySnapshots, setShowHistory };
  const allScenes = [...(tree.chapters.flatMap((ch) => ch.scenes)), ...tree.shortPieces];
  const sceneTitle = (id: string | null) => id ? (allScenes.find((s) => s.id === id)?.title ?? "") : "";
  return (
    <AppContent tree={tree} selectedSceneId={selectedSceneId} doc={doc}
      onSelectScene={wiring.handleSelectScene} callbacks={{ ...wiring.callbacks,
        onTakeSnapshot: (id) => { setHistorySceneId(id); void snapTakeFromMenu({ targetSceneId: id, isActive: id === selectedSceneId, activeDoc: doc, set: setHistorySnapshots, setShowHistory, load: sceneDocStore.load.bind(sceneDocStore) }).then(() => bumpRailKey()); },
        onOpenHistory: (id) => { setHistorySceneId(id); setShowHistory(true); },
      }}
      projects={projects} activeProjectId={activeProjectId}
      onSwitchProject={wiring.onSwitchProject} onCreateProject={wiring.onCreateProject}
      dragCallbacks={wiring.dragCallbacks} view={view} onViewChange={setView}
      linksVersion={linksVersion} onEntitiesChanged={wiring.onEntitiesChanged}
      storyBibleStore={storyBibleStore} reloadTree={wiring.reloadTree} archivedVersion={archivedVersion}
      entryStack={entryStack} entryOrigin={entryOrigin}
      onOpenEntry={openEntry} onPushEntry={pushEntry} onEntryBack={entryBack} onExitEntry={exitEntry}
      historySnapshots={railSnapshots}
      onOpenHistory={selectedSceneId ? () => { setHistorySceneId(selectedSceneId); setShowHistory(true); } : undefined}
      onTakeSnapshot={selectedSceneId ? () => { void snapCapture({ targetSceneId: selectedSceneId, isActive: true, activeDoc: doc, set: setHistorySnapshots, load: sceneDocStore.load.bind(sceneDocStore) }).then(() => bumpRailKey()); } : undefined}
      overlays={makeOverlays({ state, wiring, snap, ctx, sceneTitle, tree, setTheme, setAccent, bumpRailKey })}
      labelStore={labelStore} trialDaysLeft={gateStatus === "trial" ? daysLeft : null} onTrialPillClick={() => setActivationOpen(true)} gateStatus={gateStatus}
    />
  );
}
