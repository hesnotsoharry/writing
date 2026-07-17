/**
 * AppContent and its helpers — extracted from App.tsx to satisfy the
 * 300-line file limit. App.tsx owns bootstrapping + wiring; this file
 * owns the rendered shell composition (slots, focus mode, overlay stack).
 *
 * View-stage routing (CorkOutlinerView, buildViewStage) lives in
 * App.content.viewstage.tsx. EditorPane lives in App.content.editor.tsx.
 */
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

import { useExportActions } from "./App.content.export";
import { buildViewStage } from "./App.content.viewstage";
import { useGlobalKeybindings } from "./App.keybindings";
import type { OverlayStackProps } from "./App.overlays";
import { OverlayStack } from "./App.overlays";
import type { AppView, EntryFrame } from "./App.state";
import { Binder } from "./binder/Binder";
import type { BinderCallbacks } from "./binder/BinderCrud";
import type { DragCallbacks } from "./binder/BinderDrag";
import type { BinderTree } from "./binder/buildTree";
import type { MenuDescriptor } from "./components/menu/ContextMenu";
import { ContextMenu } from "./components/menu/ContextMenu";
import type { Project, Scene } from "./db/binderStore";
import type { Label, LabelColor, LabelStore } from "./db/labelStore";
import type { Snapshot } from "./db/snapshotStore";
import { SqliteGoalsStore } from "./db/sqliteGoalsStore";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import { useLiveWordCount } from "./editor/useLiveWordCount";
import { wrapInspectorSlot } from "./features/ai/AssistantPanel";
import { useArchivedCount } from "./features/archive/useArchivedCount";
import { AppFocusLayer, useFocusSettings } from "./features/focus/AppFocusLayer";
import type { GoalRecord } from "./features/goals/goalModel";
import { GOAL_META } from "./features/goals/goalTypes";
import { useDailyGoalProgress } from "./features/goals/useDailyGoalProgress";
import { LabelManager } from "./features/outliner/LabelManager";
import { type OtlSort } from "./features/outliner/Outliner";
import { useQuickCount } from "./features/quickcapture/useQuickCount";
import { useQuickItemsBadge } from "./features/quickcapture/useQuickItemsBadge";
import { useAiEnabled } from "./features/settings/settings.store";
import { SceneInspector } from "./inspector/SceneInspector";
import { useManuscriptWordCount } from "./lib/manuscriptWords";
import { GOALS_CHANGED_EVENT } from "./lib/settings";
import { AppShell } from "./shell/AppShell";
import { StatusBar } from "./shell/StatusBar";
import { TitleBar } from "./shell/TitleBar";
import { useEditorStyle } from "./theme/useEditorStyle";
import { useMotion } from "./theme/useMotion";

// ── Inspector view allowlist (brainstorm + editor show the right column) ──────

const INSPECTOR_VIEWS = new Set<AppView>(["editor", "brainstorm"]);

// ── Goal context menu ────────────────────────────────────────────────────────

const appGoalsStore = new SqliteGoalsStore();

function useGoalMenu(setShowGoals: (v: boolean) => void) {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [editGoalId, setEditGoalId] = useState<string | undefined>(undefined);
  const openGoalMenu = (e: React.MouseEvent, goal: GoalRecord) => setMenu({
    x: e.clientX, y: e.clientY,
    items: [
      { label: "Edit goal", icon: "edit",
        onClick: () => { setEditGoalId(goal.id); setShowGoals(true); } },
      { label: "Manage all", icon: "target", onClick: () => setShowGoals(true) },
      { type: "sep" },
      { label: "Delete goal", icon: "trash", danger: true,
        onClick: () => {
          void appGoalsStore.deleteGoal(goal.id)
            .then(() => window.dispatchEvent(new CustomEvent(GOALS_CHANGED_EVENT)))
            .catch(console.error);
        } },
    ],
  });
  return { menu, openGoalMenu, closeGoalMenu: () => setMenu(null), editGoalId, setEditGoalId };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface OverlayFlags extends OverlayStackProps {
  focusMode: boolean;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  goalsOn: boolean;
  hasQuickItems: boolean;
  setFindReplaceSeed?: (seed: string) => void;
}

export interface AppContentProps {
  tree: BinderTree; selectedSceneId: string | null; doc: Y.Doc | null;
  onSelectScene: (sceneId: string) => void; callbacks: BinderCallbacks;
  projects: Project[]; activeProjectId: string | null;
  onSwitchProject: (projectId: string) => void; onCreateProject: (title: string) => void;
  dragCallbacks: DragCallbacks; view: AppView; onViewChange: (view: AppView) => void;
  linksVersion: number; onEntitiesChanged: () => void; overlays: OverlayFlags;
  storyBibleStore: SqliteStoryBibleStore; reloadTree: () => void; archivedVersion: number;
  entryStack: EntryFrame[]; entryOrigin: "write" | "bible";
  onOpenEntry: (id: string, kind: string) => void; onPushEntry: (id: string, kind: string) => void;
  onEntryBack: () => void; onExitEntry: () => void;
  historySnapshots?: Snapshot[]; onOpenHistory?: () => void; onTakeSnapshot?: () => void;
  labelStore: LabelStore; trialDaysLeft?: number | null; onTrialPillClick?: () => void;  gateStatus?: "checking" | "needed" | "trial" | "cleared";
}

// ── Sub-components ───────────────────────────────────────────────────────────


function useActiveScene(tree: BinderTree, selectedSceneId: string | null): Scene | null {
  const all: Scene[] = [...tree.chapters.flatMap((ch) => ch.scenes), ...tree.shortPieces];
  return selectedSceneId != null ? (all.find((s) => s.id === selectedSceneId) ?? null) : null;
}

function useChapterInfo(tree: BinderTree, selectedSceneId: string | null, liveWordCount: number) {
  if (!selectedSceneId) return { chapterId: null, chapterTotal: null };
  const chapter = tree.chapters.find((ch) => ch.scenes.some((s) => s.id === selectedSceneId));
  if (!chapter) return { chapterId: null, chapterTotal: null };
  const total = chapter.scenes.reduce((acc, s) => acc + (s.id === selectedSceneId ? liveWordCount : (s.word_count ?? 0)), 0);
  return { chapterId: chapter.folder.id, chapterTotal: total };
}

// ── Label state hook ─────────────────────────────────────────────────────────

function useLabelState(activeProjectId: string | null, labelStore: LabelStore) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [sceneLabels, setSceneLabels] = useState<Record<string, string[]>>({});
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [outlinerSort, setOutlinerSort] = useState<OtlSort>({ col: "manual", dir: "asc" });
  const [outlinerRenaming, setOutlinerRenaming] = useState<string | null>(null);

  const refreshLabels = useCallback(() => {
    if (!activeProjectId) return;
    labelStore.listLabels(activeProjectId).then(setLabels)
      .catch((e: unknown) => console.error("[labels] listLabels failed", e));
    labelStore.getAllSceneLabels()
      .then((all) => { const byId: Record<string, string[]> = {};
        for (const [sid, lbls] of Object.entries(all)) { byId[sid] = lbls.map((l) => l.id); }
        setSceneLabels(byId); })
      .catch((e: unknown) => console.error("[labels] getAllSceneLabels failed", e));
  }, [activeProjectId, labelStore]);
  useEffect(() => { refreshLabels(); }, [refreshLabels]);

  return { labels, sceneLabels, showLabelManager, setShowLabelManager,
    outlinerSort, setOutlinerSort, outlinerRenaming, setOutlinerRenaming, refreshLabels };
}

// ── Label manager overlay ────────────────────────────────────────────────────

function moveLabel(labels: Label[], id: string, dir: "up" | "down"): string[] | null {
  const idx = labels.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const next = dir === "up" ? idx - 1 : idx + 1;
  if (next < 0 || next >= labels.length) return null;
  const ids = labels.map((l) => l.id);
  [ids[idx], ids[next]] = [ids[next], ids[idx]];
  return ids;
}

interface LabelManagerOverlayProps {
  show: boolean; activeProjectId: string | null; labels: Label[];
  labelStore: LabelStore; onClose: () => void; onChanged: () => void;
}

function LabelManagerOverlay({ show, activeProjectId, labels, labelStore, onClose, onChanged }: LabelManagerOverlayProps) {
  if (!show || !activeProjectId) return null;
  const e = (tag: string) => (err: unknown) => console.error(`[labels] ${tag} failed`, err);
  return (
    <LabelManager labels={labels} onClose={onClose}
      onRename={(id, name) => labelStore.updateLabel(id, { name }).then(onChanged).catch(e("updateLabel name"))}
      onColor={(id, color: LabelColor) => labelStore.updateLabel(id, { color }).then(onChanged).catch(e("updateLabel color"))}
      onAdd={() => labelStore.createLabel(activeProjectId).then(onChanged).catch(e("createLabel"))}
      onDelete={(id) => labelStore.deleteLabel(id).then(onChanged).catch(e("deleteLabel"))}
      onReorder={(id, dir) => {
        const ids = moveLabel(labels, id, dir);
        if (ids) labelStore.reorderLabels(ids).then(onChanged).catch(e("reorderLabels"));
      }}
    />
  );
}

// ── Side-slot builder ────────────────────────────────────────────────────────

interface SideSlotsProps {
  tree: BinderTree; selectedSceneId: string | null; onSelectScene: (id: string) => void;
  callbacks: AppContentProps["callbacks"]; projects: AppContentProps["projects"];
  activeProjectId: string | null; onSwitchProject: (id: string) => void;
  onCreateProject: (title: string) => void; dragCallbacks: DragCallbacks;
  quickCount: number; archivedCount: number; manuscriptTotal: number; overlays: OverlayFlags;
  storyBibleStore: AppContentProps["storyBibleStore"]; activeScene: Scene | null;
  linksVersion: number; liveWordCount: number; chapterId: string | null; chapterTotal: number | null;
  onAddGoal: (s: "scene" | "chapter", id: string) => void;  onExport: (s: "scene" | "chapter", id: string) => void;
  onGoalMenu?: (e: React.MouseEvent, goal: GoalRecord) => void;
  showSidePanels: boolean; view: AppView;
  onOpenEntry: (id: string, kind: string) => void;
  historySnapshots?: Snapshot[]; onOpenHistory?: () => void; onTakeSnapshot?: () => void; onInsertAtCaret?: (name: string) => void;
  onOpenBrainstorm?: (boardId: string) => void;  selectedBoardId?: string | null;  doc?: Y.Doc | null;  aiEnabled: boolean;  gateStatus?: "checking" | "needed" | "trial" | "cleared";  onSetSceneExcludedFromAi?: (id: string, exclude: boolean) => void;
}

function buildSideSlots(p: SideSlotsProps) {
  const callbacksWithGoal = { ...p.callbacks, onAddGoal: p.onAddGoal, onExport: p.onExport };
  const binderSlot = p.showSidePanels
    ? <Binder tree={p.tree} selectedSceneId={p.view === "brainstorm" ? null : p.selectedSceneId} onSelectScene={p.onSelectScene}
        callbacks={callbacksWithGoal} projects={p.projects} activeProjectId={p.activeProjectId}
        onSwitchProject={p.onSwitchProject} onCreateProject={p.onCreateProject}
        dragCallbacks={p.dragCallbacks} quickCount={p.quickCount} archivedCount={p.archivedCount}
        manuscriptTotal={p.manuscriptTotal} onOpenQuickNotes={() => p.overlays.setShowInbox(true)}
        onOpenArchive={() => p.overlays.setShowArchive(true)}
        onOpenBrainstorm={p.onOpenBrainstorm} activeBoardId={p.view === "brainstorm" ? (p.selectedBoardId ?? null) : null} />
    : null;
  const base = (p.view === "editor" && !!p.activeProjectId)
    ? <SceneInspector store={p.storyBibleStore} projectId={p.activeProjectId!}
        sceneId={p.selectedSceneId} scene={p.activeScene} refreshKey={p.linksVersion}
        liveWordCount={p.liveWordCount} manuscriptTotal={p.manuscriptTotal}
        chapterId={p.chapterId} chapterTotal={p.chapterTotal}
        historySnapshots={p.historySnapshots} onOpenHistory={p.onOpenHistory}
        onTakeSnapshot={p.onTakeSnapshot} onGoalMenu={p.onGoalMenu}
        onInsertAtCaret={p.onInsertAtCaret}
        onOpenEntry={(entityId, type) => {
          const kind = type.charAt(0).toUpperCase() + type.slice(1);
          p.onOpenEntry(entityId, kind);
        }} />
    : null;
  const inspectorSlot = (p.showSidePanels && !!p.activeProjectId && INSPECTOR_VIEWS.has(p.view)) ? wrapInspectorSlot(base, p) : null;
  return { binderSlot, inspectorSlot };
}

function makeEntityHandlers(store: SqliteStoryBibleStore, onEntitiesChanged: () => void) {
  const onDeleteEntity = (kind: string, id: string) =>
    store.deleteEntity(kind.toLowerCase(), id)
      .then(onEntitiesChanged)
      .catch((e: unknown) => console.error("[AppContent] deleteEntity failed", e));
  return { onDeleteEntity };
}

interface ViewStageArgs {
  view: AppView; doc: Y.Doc | null; activeProjectId: string | null;
  storyBibleStore: SqliteStoryBibleStore; onEntitiesChanged: () => void;
  tree: BinderTree; onSelectScene: (id: string) => void; onViewChange: (v: AppView) => void;
  selectedSceneId: string | null; linksVersion: number; reloadTree: () => void;
  dragCallbacks: DragCallbacks; onAddGoal: (s: "scene" | "chapter", id: string) => void;
  onArchiveScene: (id: string) => void; onExport: (s: "scene", id: string) => void;
  entryStack: EntryFrame[]; entryOrigin: "write" | "bible";
  onOpenEntry: (id: string, kind: string) => void; onPushEntry: (id: string, kind: string) => void;
  onEntryBack: () => void; onExitEntry: () => void;
  onDeleteEntity: (kind: string, id: string) => void;
  labelStore: LabelStore; ls: ReturnType<typeof useLabelState>; onTakeSnapshot?: (sceneId: string) => void; onOpenHistory?: (sceneId: string) => void;
  editorFocus?: { focusMode?: boolean; typewriterOn?: boolean; dimParagraphsOn?: boolean };
  onFindMentions?: (entityName: string) => void;  onRegisterInsert?: (fn: (text: string) => void) => void;  brainstormBoardId?: string | null;  onRenameScene?: BinderCallbacks["onRenameScene"];  onSetSceneStatus?: BinderCallbacks["onSetSceneStatus"];  onSetSceneExcludedFromAi?: BinderCallbacks["onSetSceneExcludedFromAi"];
}

function makeViewStage(a: ViewStageArgs) {
  return buildViewStage(a.view, a.doc, a.activeProjectId, {
    storyBibleStore: a.storyBibleStore, onEntitiesChanged: a.onEntitiesChanged,
    tree: a.tree, onSelectScene: a.onSelectScene, onViewChange: a.onViewChange,
    selectedSceneId: a.selectedSceneId, linksVersion: a.linksVersion, reloadTree: a.reloadTree,
    dragCallbacks: a.dragCallbacks, onAddGoal: a.onAddGoal, onArchiveScene: a.onArchiveScene,
    onExport: a.onExport, entryStack: a.entryStack, entryOrigin: a.entryOrigin,
    onOpenEntry: a.onOpenEntry, onPushEntry: a.onPushEntry, onEntryBack: a.onEntryBack,
    onExitEntry: a.onExitEntry, onDeleteEntity: a.onDeleteEntity,
    labelStore: a.labelStore, labels: a.ls.labels, sceneLabels: a.ls.sceneLabels,
    outlinerSort: a.ls.outlinerSort, setOutlinerSort: a.ls.setOutlinerSort,
    outlinerRenaming: a.ls.outlinerRenaming, setOutlinerRenaming: a.ls.setOutlinerRenaming,
    onOpenLabelManager: () => a.ls.setShowLabelManager(true), onLabelsChanged: a.ls.refreshLabels, onTakeSnapshot: a.onTakeSnapshot, onOpenHistory: a.onOpenHistory, editorFocus: a.editorFocus, onFindMentions: a.onFindMentions, onRegisterInsert: a.onRegisterInsert, brainstormBoardId: a.brainstormBoardId, onRenameScene: a.onRenameScene, onSetSceneStatus: a.onSetSceneStatus, onSetSceneExcludedFromAi: a.onSetSceneExcludedFromAi,
  });
}

// ── useAppContentSlots ───────────────────────────────────────────────────────

function useAppContentSlots(props: AppContentProps) {
  const { tree, selectedSceneId, doc, onSelectScene, callbacks, projects, activeProjectId,
    onSwitchProject, onCreateProject, dragCallbacks, view, onViewChange, linksVersion,
    onEntitiesChanged, overlays, storyBibleStore, archivedVersion, reloadTree, entryStack,
    entryOrigin, onOpenEntry, onPushEntry, onEntryBack, onExitEntry, historySnapshots, onOpenHistory, onTakeSnapshot, labelStore, gateStatus } = props;
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture, setShowSettings, setShowExport, setExportTarget, setShowFindReplace, setFindReplaceSeed } = overlays;
  const { onExport, openExport } = useExportActions(tree, selectedSceneId, setExportTarget, setShowExport); useGlobalKeybindings({ ...overlays, setShowFindReplace, view, openExport }); useQuickItemsBadge(activeProjectId, overlays.setHasQuickItems);
  useEditorStyle(); const motionOn = useMotion();
  const liveWordCount = useLiveWordCount(doc);
  const manuscriptTotal = useManuscriptWordCount({ tree, activeSceneId: selectedSceneId, liveActiveWords: liveWordCount });
  const goalProgress = useDailyGoalProgress({ projectId: activeProjectId ?? "", scope: "manuscript", targetId: null, currentScopeTotal: manuscriptTotal });
  const quickCount = useQuickCount(activeProjectId); const archivedCount = useArchivedCount(activeProjectId, archivedVersion);
  const docName = projects.find((p) => p.id === activeProjectId)?.title; const activeScene = useActiveScene(tree, selectedSceneId);
  const { chapterId, chapterTotal } = useChapterInfo(tree, selectedSceneId, liveWordCount);  const focusSettingsHook = useFocusSettings();
  const onAddGoal = (scope: "scene" | "chapter", id: string) => { overlays.setGoalsInitialScope({ scope, targetId: id }); setShowGoals(true); };
  const { menu: goalMenu, openGoalMenu, closeGoalMenu, editGoalId, setEditGoalId } = useGoalMenu(setShowGoals);  const aiEnabled = useAiEnabled();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);  const showSidePanels = !focusMode && view !== "cork" && view !== "outline" && view !== "bible" && view !== "entry";  const insertAtCaretRef = useRef<((text: string) => void) | null>(null);  const onRegisterInsert = useCallback((fn: (text: string) => void) => { insertAtCaretRef.current = fn; }, []);  const onInsertAtCaret = useCallback((name: string) => { insertAtCaretRef.current?.(name); }, []);  const selectSceneWithViewReset = useCallback((id: string) => { if (view === "brainstorm") onViewChange("editor"); onSelectScene(id); }, [view, onViewChange, onSelectScene]);
  // eslint-disable-next-line react-hooks/refs
  const { binderSlot, inspectorSlot } = buildSideSlots({
    tree, selectedSceneId, onSelectScene: selectSceneWithViewReset, callbacks, projects, activeProjectId,
    onSwitchProject, onCreateProject, dragCallbacks, quickCount, archivedCount,
    manuscriptTotal, overlays, storyBibleStore, activeScene, linksVersion, liveWordCount,
    chapterId, chapterTotal, onAddGoal, onExport, onGoalMenu: openGoalMenu,
    showSidePanels, view, onOpenEntry, historySnapshots, onOpenHistory, onTakeSnapshot,
    onInsertAtCaret, selectedBoardId, doc, aiEnabled, gateStatus, onSetSceneExcludedFromAi: callbacks.onSetSceneExcludedFromAi,
    onOpenBrainstorm: (boardId: string) => { setSelectedBoardId(boardId); onViewChange("brainstorm"); } });
  const { onDeleteEntity } = makeEntityHandlers(storyBibleStore, onEntitiesChanged);  const ls = useLabelState(activeProjectId, labelStore);
  const editorFocus = { focusMode, typewriterOn: focusSettingsHook.settings.typewriter, dimParagraphsOn: focusSettingsHook.settings.dimParagraphs };  const onFindMentions = (n: string) => { setFindReplaceSeed?.(n); setShowFindReplace(true); };
  // eslint-disable-next-line react-hooks/refs
  const viewStageContent = makeViewStage({
    view, doc, activeProjectId, storyBibleStore, onEntitiesChanged, tree, onSelectScene: selectSceneWithViewReset,
    onViewChange, selectedSceneId, linksVersion, reloadTree, dragCallbacks, onAddGoal,
    onArchiveScene: callbacks.onArchiveScene, onExport, entryStack, entryOrigin,
    onOpenEntry, onPushEntry, onEntryBack, onExitEntry, onDeleteEntity, labelStore, ls, onTakeSnapshot: callbacks.onTakeSnapshot, onOpenHistory: callbacks.onOpenHistory, editorFocus, onFindMentions, onRegisterInsert, brainstormBoardId: selectedBoardId, onRenameScene: callbacks.onRenameScene, onSetSceneStatus: callbacks.onSetSceneStatus, onSetSceneExcludedFromAi: callbacks.onSetSceneExcludedFromAi,
  });
  return {
    focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture, setShowSettings,
    setShowExport, openExport, liveWordCount, manuscriptTotal, goalProgress, docName,
    binderSlot, inspectorSlot, viewStageContent, overlays, activeProjectId, motionOn,
    labelState: ls, labelStore, focusSettingsHook, goalMenu, closeGoalMenu, editGoalId, setEditGoalId,
  };
}

// ── AppContent ───────────────────────────────────────────────────────────────

export function AppContent(props: AppContentProps) {
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture,
    setShowSettings, openExport, liveWordCount, manuscriptTotal, goalProgress,
    docName, binderSlot, inspectorSlot, viewStageContent, overlays, motionOn,
    labelState, labelStore, focusSettingsHook, goalMenu, closeGoalMenu, editGoalId, setEditGoalId,
  } = useAppContentSlots(props);
  const { view, onViewChange, activeProjectId, trialDaysLeft, onTrialPillClick } = props;
  const hudGoal = { current: goalProgress.words, target: goalProgress.target,
    pct: goalProgress.pct, streak: goalProgress.streak,
    name: goalProgress.on ? GOAL_META.daily.name : undefined };
  return (
    <>
      <AppShell focusMode={focusMode} dimOn={focusMode && focusSettingsHook.settings.dimParagraphs}
        typewriterOn={focusMode && focusSettingsHook.settings.typewriter} anim={motionOn} viewKey={view}
        titleBar={<TitleBar view={view} onViewChange={onViewChange} docName={docName}
          goalsOn={goalsOn} hasQuickItems={hasQuickItems}
          showFindReplace={overlays.showFindReplace} showHistory={overlays.showHistory} showQuickCapture={overlays.showQuickCapture} focusMode={focusMode} showSettings={overlays.showSettings}
          onToggleGoals={() => setShowGoals(true)} onOpenQuick={() => setShowQuickCapture(true)}
          onEnterFocus={() => { if (view === "editor") setFocusMode(true); }} onOpenSettings={() => setShowSettings(true)}
          onOpenExport={openExport}
          onOpenFind={() => { overlays.setFindReplaceSeed?.(""); overlays.setShowFindReplace(true); }}
          onOpenHistory={props.onOpenHistory} />}
        binder={binderSlot}
        viewStage={viewStageContent}
        inspector={inspectorSlot}
        statusBar={<StatusBar sceneWordCount={liveWordCount} goalsOn={goalsOn}
          manuscriptTotal={manuscriptTotal} goal={goalProgress} trialDaysLeft={trialDaysLeft} onTrialPillClick={onTrialPillClick} />}
      />
      <AppFocusLayer focusMode={focusMode} wordCount={liveWordCount} goal={hudGoal} goalOn={goalsOn} settingsHook={focusSettingsHook} onExit={() => setFocusMode(false)} />
      <OverlayStack {...overlays} activeProjectId={activeProjectId}
        editGoalId={editGoalId} setEditGoalId={setEditGoalId} manuscriptTotal={manuscriptTotal} />
      <ContextMenu menu={goalMenu} onClose={closeGoalMenu} />
      <LabelManagerOverlay show={labelState.showLabelManager} activeProjectId={activeProjectId}
        labels={labelState.labels} labelStore={labelStore}
        onClose={() => labelState.setShowLabelManager(false)} onChanged={labelState.refreshLabels} />
    </>
  );
}
