/**
 * AppContent and its helpers — extracted from App.tsx to satisfy the
 * 300-line file limit. App.tsx owns bootstrapping + wiring; this file
 * owns the rendered shell composition (slots, focus mode, overlay stack).
 *
 * View-stage routing (CorkOutlinerView, buildViewStage) lives in
 * App.content.viewstage.tsx. EditorPane lives in App.content.editor.tsx.
 */
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import type * as Y from "yjs";

import { buildViewStage } from "./App.content.viewstage";
import { useGlobalKeybindings } from "./App.keybindings";
import type { OverlayStackProps } from "./App.overlays";
import { OverlayStack } from "./App.overlays";
import type { AppView, EntryFrame } from "./App.state";
import { Binder } from "./binder/Binder";
import type { BinderCallbacks } from "./binder/BinderCrud";
import type { DragCallbacks } from "./binder/BinderDrag";
import type { BinderTree } from "./binder/buildTree";
import { Icon } from "./components/Icon";
import type { Project, Scene } from "./db/binderStore";
import type { Label, LabelColor, LabelStore } from "./db/labelStore";
import type { Snapshot } from "./db/snapshotStore";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import { useLiveWordCount } from "./editor/useLiveWordCount";
import { useArchivedCount } from "./features/archive/useArchivedCount";
import { useDailyGoalProgress } from "./features/goals/useDailyGoalProgress";
import { LabelManager } from "./features/outliner/LabelManager";
import { type OtlSort } from "./features/outliner/Outliner";
import { useQuickCount } from "./features/quickcapture/useQuickCount";
import { useQuickItemsBadge } from "./features/quickcapture/useQuickItemsBadge";
import { SceneInspector } from "./inspector/SceneInspector";
import { useManuscriptWordCount } from "./lib/manuscriptWords";
import { AppShell } from "./shell/AppShell";
import { StatusBar } from "./shell/StatusBar";
import { TitleBar } from "./shell/TitleBar";
import { useEditorStyle } from "./theme/useEditorStyle";
import { useMotion } from "./theme/useMotion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverlayFlags extends OverlayStackProps {
  focusMode: boolean;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  goalsOn: boolean;
  hasQuickItems: boolean;
}

export interface AppContentProps {
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
  overlays: OverlayFlags;
  storyBibleStore: SqliteStoryBibleStore;
  reloadTree: () => void;
  archivedVersion: number;
  entryStack: EntryFrame[];
  entryOrigin: "write" | "bible";
  onOpenEntry: (id: string, kind: string) => void;
  onPushEntry: (id: string, kind: string) => void;
  onEntryBack: () => void;
  onExitEntry: () => void;
  historySnapshots?: Snapshot[];
  onOpenHistory?: () => void;
  onTakeSnapshot?: () => void;
  labelStore: LabelStore;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FocusExitButton({ onExit }: { onExit: () => void }) {
  return (
    <div className="focus-exit">
      <span className="kbd">⌘.</span>
      <button className="btn btn-ghost" style={{ background: "var(--parchment)" }} onClick={onExit}>
        <Icon name="focus" className="ic" /> Exit focus
      </button>
    </div>
  );
}

function useActiveScene(tree: BinderTree, selectedSceneId: string | null): Scene | null {
  const all: Scene[] = [...tree.chapters.flatMap((ch) => ch.scenes), ...tree.shortPieces];
  return selectedSceneId != null ? (all.find((s) => s.id === selectedSceneId) ?? null) : null;
}

function useChapterInfo(
  tree: BinderTree, selectedSceneId: string | null, liveWordCount: number,
): { chapterId: string | null; chapterTotal: number | null } {
  if (!selectedSceneId) return { chapterId: null, chapterTotal: null };
  const chapter = tree.chapters.find((ch) => ch.scenes.some((s) => s.id === selectedSceneId));
  if (!chapter) return { chapterId: null, chapterTotal: null };
  const total = chapter.scenes.reduce(
    (acc, s) => acc + (s.id === selectedSceneId ? liveWordCount : (s.word_count ?? 0)), 0,
  );
  return { chapterId: chapter.folder.id, chapterTotal: total };
}

// ---------------------------------------------------------------------------
// Label state hook
// ---------------------------------------------------------------------------

function useLabelState(activeProjectId: string | null, labelStore: LabelStore) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [sceneLabels, setSceneLabels] = useState<Record<string, string[]>>({});
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [outlinerSort, setOutlinerSort] = useState<OtlSort>({ col: "manual", dir: "asc" });
  const [outlinerRenaming, setOutlinerRenaming] = useState<string | null>(null);

  const refreshLabels = useCallback(() => {
    if (!activeProjectId) return;
    labelStore.listLabels(activeProjectId)
      .then(setLabels)
      .catch((e: unknown) => console.error("[labels] listLabels failed", e));
    labelStore.getAllSceneLabels()
      .then((all) => {
        const byId: Record<string, string[]> = {};
        for (const [sid, lbls] of Object.entries(all)) { byId[sid] = lbls.map((l) => l.id); }
        setSceneLabels(byId);
      })
      .catch((e: unknown) => console.error("[labels] getAllSceneLabels failed", e));
  }, [activeProjectId, labelStore]);

  useEffect(() => { refreshLabels(); }, [refreshLabels]);

  return { labels, sceneLabels, showLabelManager, setShowLabelManager,
    outlinerSort, setOutlinerSort, outlinerRenaming, setOutlinerRenaming, refreshLabels };
}

// ---------------------------------------------------------------------------
// Label manager overlay
// ---------------------------------------------------------------------------

interface LabelManagerOverlayProps {
  show: boolean;
  activeProjectId: string | null;
  labels: Label[];
  labelStore: LabelStore;
  onClose: () => void;
  onChanged: () => void;
}

function LabelManagerOverlay({ show, activeProjectId, labels, labelStore, onClose, onChanged }: LabelManagerOverlayProps) {
  if (!show || !activeProjectId) return null;
  return (
    <LabelManager
      labels={labels}
      onClose={onClose}
      onRename={(id, name) => {
        labelStore.updateLabel(id, { name }).then(onChanged)
          .catch((e: unknown) => console.error("[labels] updateLabel name failed", e));
      }}
      onColor={(id, color: LabelColor) => {
        labelStore.updateLabel(id, { color }).then(onChanged)
          .catch((e: unknown) => console.error("[labels] updateLabel color failed", e));
      }}
      onAdd={() => {
        labelStore.createLabel(activeProjectId).then(onChanged)
          .catch((e: unknown) => console.error("[labels] createLabel failed", e));
      }}
      onDelete={(id) => {
        labelStore.deleteLabel(id).then(onChanged)
          .catch((e: unknown) => console.error("[labels] deleteLabel failed", e));
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Side-slot builder
// ---------------------------------------------------------------------------

interface SideSlotsProps {
  tree: BinderTree; selectedSceneId: string | null; onSelectScene: (id: string) => void;
  callbacks: AppContentProps["callbacks"]; projects: AppContentProps["projects"];
  activeProjectId: string | null; onSwitchProject: (id: string) => void;
  onCreateProject: () => void; dragCallbacks: DragCallbacks;
  quickCount: number; archivedCount: number; manuscriptTotal: number; overlays: OverlayFlags;
  storyBibleStore: AppContentProps["storyBibleStore"]; activeScene: Scene | null;
  linksVersion: number; liveWordCount: number; chapterId: string | null; chapterTotal: number | null;
  onAddGoal: (s: "scene" | "chapter", id: string) => void;
  onExport: (s: "scene" | "chapter", id: string) => void;
  showSidePanels: boolean; view: AppView;
  onOpenEntry: (id: string, kind: string) => void;
  historySnapshots?: Snapshot[]; onOpenHistory?: () => void; onTakeSnapshot?: () => void;
}

function buildSideSlots(p: SideSlotsProps) {
  const callbacksWithGoal = { ...p.callbacks, onAddGoal: p.onAddGoal, onExport: p.onExport };
  const binderSlot = p.showSidePanels
    ? <Binder tree={p.tree} selectedSceneId={p.selectedSceneId} onSelectScene={p.onSelectScene}
        callbacks={callbacksWithGoal} projects={p.projects} activeProjectId={p.activeProjectId}
        onSwitchProject={p.onSwitchProject} onCreateProject={p.onCreateProject}
        dragCallbacks={p.dragCallbacks} quickCount={p.quickCount} archivedCount={p.archivedCount}
        manuscriptTotal={p.manuscriptTotal} onOpenQuickNotes={() => p.overlays.setShowInbox(true)}
        onOpenArchive={() => p.overlays.setShowArchive(true)} />
    : null;
  const inspectorSlot = (p.showSidePanels && p.view === "editor" && p.activeProjectId)
    ? <SceneInspector store={p.storyBibleStore} projectId={p.activeProjectId}
        sceneId={p.selectedSceneId} scene={p.activeScene} refreshKey={p.linksVersion}
        liveWordCount={p.liveWordCount} manuscriptTotal={p.manuscriptTotal}
        chapterId={p.chapterId} chapterTotal={p.chapterTotal}
        historySnapshots={p.historySnapshots} onOpenHistory={p.onOpenHistory}
        onTakeSnapshot={p.onTakeSnapshot}
        onOpenEntry={(entityId, type) => {
          const kind = type === "character" ? "Character" : type === "location" ? "Location" : type.charAt(0).toUpperCase() + type.slice(1);
          p.onOpenEntry(entityId, kind);
        }} />
    : null;
  return { binderSlot, inspectorSlot };
}

function makeEntityHandlers(store: SqliteStoryBibleStore, onEntitiesChanged: () => void) {
  const onRenameEntity = (kind: string, id: string, name: string) => {
    // kind is Title-case display form; store takes lowercase entity_type
    store.renameEntity(kind.toLowerCase(), id, name)
      .catch((e: unknown) => console.error("[AppContent] renameEntity failed", e));
  };
  const onDeleteEntity = (kind: string, id: string) => {
    store.deleteEntity(kind.toLowerCase(), id)
      .then(onEntitiesChanged)
      .catch((e: unknown) => console.error("[AppContent] deleteEntity failed", e));
  };
  return { onRenameEntity, onDeleteEntity };
}

interface ViewStageArgs {
  view: AppView; doc: Y.Doc | null; activeProjectId: string | null;
  storyBibleStore: SqliteStoryBibleStore; onEntitiesChanged: () => void;
  tree: BinderTree; onSelectScene: (id: string) => void; onViewChange: (v: AppView) => void;
  selectedSceneId: string | null; linksVersion: number; reloadTree: () => void;
  dragCallbacks: DragCallbacks;
  onAddGoal: (s: "scene" | "chapter", id: string) => void;
  onArchiveScene: (id: string) => void;
  onExport: (s: "scene", id: string) => void;
  entryStack: EntryFrame[]; entryOrigin: "write" | "bible";
  onOpenEntry: (id: string, kind: string) => void;
  onPushEntry: (id: string, kind: string) => void;
  onEntryBack: () => void; onExitEntry: () => void;
  onRenameEntity: (kind: string, id: string, name: string) => void;
  onDeleteEntity: (kind: string, id: string) => void;
  labelStore: LabelStore; ls: ReturnType<typeof useLabelState>;
}

function makeViewStage(a: ViewStageArgs) {
  return buildViewStage(a.view, a.doc, a.activeProjectId, {
    storyBibleStore: a.storyBibleStore, onEntitiesChanged: a.onEntitiesChanged,
    tree: a.tree, onSelectScene: a.onSelectScene, onViewChange: a.onViewChange,
    selectedSceneId: a.selectedSceneId, linksVersion: a.linksVersion, reloadTree: a.reloadTree,
    dragCallbacks: a.dragCallbacks, onAddGoal: a.onAddGoal, onArchiveScene: a.onArchiveScene,
    onExport: a.onExport, entryStack: a.entryStack, entryOrigin: a.entryOrigin,
    onOpenEntry: a.onOpenEntry, onPushEntry: a.onPushEntry, onEntryBack: a.onEntryBack,
    onExitEntry: a.onExitEntry, onRenameEntity: a.onRenameEntity, onDeleteEntity: a.onDeleteEntity,
    labelStore: a.labelStore, labels: a.ls.labels, sceneLabels: a.ls.sceneLabels,
    outlinerSort: a.ls.outlinerSort, setOutlinerSort: a.ls.setOutlinerSort,
    outlinerRenaming: a.ls.outlinerRenaming, setOutlinerRenaming: a.ls.setOutlinerRenaming,
    onOpenLabelManager: () => a.ls.setShowLabelManager(true), onLabelsChanged: a.ls.refreshLabels,
  });
}

// ---------------------------------------------------------------------------
// useAppContentSlots
// ---------------------------------------------------------------------------

function useAppContentSlots(props: AppContentProps) {
  const { tree, selectedSceneId, doc, onSelectScene, callbacks, projects, activeProjectId,
    onSwitchProject, onCreateProject, dragCallbacks, view, onViewChange, linksVersion,
    onEntitiesChanged, overlays, storyBibleStore, archivedVersion, reloadTree, entryStack,
    entryOrigin, onOpenEntry, onPushEntry, onEntryBack, onExitEntry, historySnapshots,
    onOpenHistory, onTakeSnapshot, labelStore } = props;
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture, setShowSettings, setShowExport, setExportTarget, setShowFindReplace } = overlays;
  useGlobalKeybindings({ ...overlays, setShowFindReplace }); useQuickItemsBadge(activeProjectId, overlays.setHasQuickItems);
  useEditorStyle(); const motionOn = useMotion();
  const liveWordCount = useLiveWordCount(doc);
  const manuscriptTotal = useManuscriptWordCount({ tree, activeSceneId: selectedSceneId, liveActiveWords: liveWordCount });
  const goalProgress = useDailyGoalProgress({ projectId: activeProjectId ?? "", scope: "manuscript", targetId: null, currentScopeTotal: manuscriptTotal });
  const quickCount = useQuickCount(activeProjectId); const archivedCount = useArchivedCount(activeProjectId, archivedVersion);
  const docName = projects.find((p) => p.id === activeProjectId)?.title; const activeScene = useActiveScene(tree, selectedSceneId);
  const { chapterId, chapterTotal } = useChapterInfo(tree, selectedSceneId, liveWordCount);
  const onAddGoal = (scope: "scene" | "chapter", id: string) => { overlays.setGoalsInitialScope({ scope, targetId: id }); setShowGoals(true); };  const onExport = (scope: "scene" | "chapter", id: string) => { setExportTarget(scope, id); setShowExport(true); };
  const showSidePanels = !focusMode && view !== "cork" && view !== "outline" && view !== "bible" && view !== "entry";
  const { binderSlot, inspectorSlot } = buildSideSlots({
    tree, selectedSceneId, onSelectScene, callbacks, projects, activeProjectId,
    onSwitchProject, onCreateProject, dragCallbacks, quickCount, archivedCount,
    manuscriptTotal, overlays, storyBibleStore, activeScene, linksVersion, liveWordCount,
    chapterId, chapterTotal, onAddGoal, onExport, showSidePanels, view, onOpenEntry,
    historySnapshots, onOpenHistory, onTakeSnapshot,
  });
  const { onRenameEntity, onDeleteEntity } = makeEntityHandlers(storyBibleStore, onEntitiesChanged);  const ls = useLabelState(activeProjectId, labelStore);
  const viewStageContent = makeViewStage({
    view, doc, activeProjectId, storyBibleStore, onEntitiesChanged, tree, onSelectScene,
    onViewChange, selectedSceneId, linksVersion, reloadTree, dragCallbacks, onAddGoal,
    onArchiveScene: callbacks.onArchiveScene, onExport, entryStack, entryOrigin,
    onOpenEntry, onPushEntry, onEntryBack, onExitEntry, onRenameEntity, onDeleteEntity, labelStore, ls,
  });
  return {
    focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture, setShowSettings,
    setShowExport, setExportTarget, liveWordCount, manuscriptTotal, goalProgress, docName,
    binderSlot, inspectorSlot, viewStageContent, overlays, activeProjectId, motionOn, labelState: ls, labelStore,
  };
}

// ---------------------------------------------------------------------------
// AppContent
// ---------------------------------------------------------------------------

export function AppContent(props: AppContentProps) {
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture,
    setShowSettings, setShowExport, setExportTarget, liveWordCount, manuscriptTotal, goalProgress,
    docName, binderSlot, inspectorSlot, viewStageContent, overlays, motionOn,
    labelState, labelStore,
  } = useAppContentSlots(props);
  const { view, onViewChange, activeProjectId } = props;
  return (
    <>
      <AppShell focusMode={focusMode} anim={motionOn} viewKey={view}
        titleBar={<TitleBar view={view} onViewChange={onViewChange} docName={docName}
          goalsOn={goalsOn} hasQuickItems={hasQuickItems}
          onToggleGoals={() => setShowGoals(true)} onOpenQuick={() => setShowQuickCapture(true)}
          onEnterFocus={() => setFocusMode(true)} onOpenSettings={() => setShowSettings(true)}
          onOpenExport={() => { setExportTarget("manuscript", activeProjectId ?? ""); setShowExport(true); }} />}
        binder={binderSlot}
        viewStage={<>{focusMode && <FocusExitButton onExit={() => setFocusMode(false)} />}{viewStageContent}</>}
        inspector={inspectorSlot}
        statusBar={<StatusBar sceneWordCount={liveWordCount} goalsOn={goalsOn}
          manuscriptTotal={manuscriptTotal} goal={goalProgress} />}
      />
      <OverlayStack {...overlays} activeProjectId={activeProjectId} />
      <LabelManagerOverlay
        show={labelState.showLabelManager}
        activeProjectId={activeProjectId}
        labels={labelState.labels}
        labelStore={labelStore}
        onClose={() => labelState.setShowLabelManager(false)}
        onChanged={labelState.refreshLabels}
      />
    </>
  );
}
