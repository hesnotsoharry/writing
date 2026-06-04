/**
 * AppContent and its helpers — extracted from App.tsx to satisfy the
 * 300-line file limit. App.tsx owns bootstrapping + wiring; this file
 * owns the rendered shell composition (slots, focus mode, overlay stack).
 */
import type { Dispatch, SetStateAction } from "react";
import { useRef } from "react";
import type * as Y from "yjs";

import { useGlobalKeybindings } from "./App.keybindings";
import type { OverlayStackProps } from "./App.overlays";
import { OverlayStack } from "./App.overlays";
import type { AppView } from "./App.state";
import { Binder } from "./binder/Binder";
import type { BinderCallbacks } from "./binder/BinderCrud";
import type { DragCallbacks } from "./binder/BinderDrag";
import type { BinderTree } from "./binder/buildTree";
import { Icon } from "./components/Icon";
import type { Project, Scene } from "./db/binderStore";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import { Editor } from "./editor/Editor";
import { useLiveWordCount } from "./editor/useLiveWordCount";
import { usePageFlip } from "./editor/usePageFlip";
import { useArchivedCount } from "./features/archive/useArchivedCount";
import { Corkboard } from "./features/corkboard/Corkboard";
import { useDailyGoalProgress } from "./features/goals/useDailyGoalProgress";
import { useQuickCount } from "./features/quickcapture/useQuickCount";
import { useQuickItemsBadge } from "./features/quickcapture/useQuickItemsBadge";
import { SceneInspector } from "./inspector/SceneInspector";
import { useManuscriptWordCount } from "./lib/manuscriptWords";
import { AppShell } from "./shell/AppShell";
import { StatusBar } from "./shell/StatusBar";
import { TitleBar } from "./shell/TitleBar";
import { StoryBibleView } from "./storybible/StoryBibleView";
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
  /** Reload the binder tree from the store — exposed for downstream phases (Corkboard P5, Inspector P4). */
  reloadTree: () => void;
  /** Bump counter for archive-count recomputation — increment after any archive or restore. */
  archivedVersion: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * EditorPane — owns the page-flip lifecycle so the flip state survives
 * the doc=null→doc=newDoc transition that unmounts/remounts Editor.
 * prevSceneRef lives here (above the unmount boundary) and correctly
 * tracks the outgoing scene even while the Editor is unmounted.
 */
function EditorPane({ doc, view, tree, selectedSceneId, storyBibleStore, linksVersion }: {
  doc: Y.Doc | null;
  view: AppView;
  tree: BinderTree;
  selectedSceneId: string | null;
  storyBibleStore: SqliteStoryBibleStore;
  linksVersion: number;
}) {
  // captureProseRef: Editor writes its captureProse fn here; usePageFlip reads it.
  const captureProseRef = useRef<() => string>(() => "");
  const { flip, onAnimationEnd } = usePageFlip({
    selectedSceneId, tree, view, captureProse: () => captureProseRef.current(),
  });
  return (
    <main className="canvas-pane">
      {doc
        ? <Editor doc={doc} tree={tree} selectedSceneId={selectedSceneId}
            storyBibleStore={storyBibleStore} linksVersion={linksVersion}
            flip={flip} onAnimationEnd={onAnimationEnd} captureProseRef={captureProseRef} />
        : <div className="canvas-empty">Select a scene to start writing.</div>}
    </main>
  );
}

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

/** Returns the folderId and chapter word total for the selected scene (null when short piece). */
function useChapterInfo(
  tree: BinderTree,
  selectedSceneId: string | null,
  liveWordCount: number,
): { chapterId: string | null; chapterTotal: number | null } {
  if (!selectedSceneId) return { chapterId: null, chapterTotal: null };
  const chapter = tree.chapters.find((ch) => ch.scenes.some((s) => s.id === selectedSceneId));
  if (!chapter) return { chapterId: null, chapterTotal: null };
  const total = chapter.scenes.reduce(
    (acc, s) => acc + (s.id === selectedSceneId ? liveWordCount : (s.word_count ?? 0)),
    0,
  );
  return { chapterId: chapter.folder.id, chapterTotal: total };
}

// ---------------------------------------------------------------------------
// AppContent
// ---------------------------------------------------------------------------

/** Builds the binder + inspector slots (extracted to keep useAppContentSlots ≤40 lines). */
function buildSideSlots(p: {
  tree: BinderTree; selectedSceneId: string | null; onSelectScene: (id: string) => void;
  callbacks: AppContentProps["callbacks"]; projects: AppContentProps["projects"];
  activeProjectId: string | null; onSwitchProject: (id: string) => void;
  onCreateProject: () => void; dragCallbacks: DragCallbacks;
  quickCount: number; archivedCount: number; manuscriptTotal: number; overlays: OverlayFlags;
  storyBibleStore: AppContentProps["storyBibleStore"]; activeScene: Scene | null;
  linksVersion: number; liveWordCount: number;
  chapterId: string | null; chapterTotal: number | null;
  onAddGoal: (s: "scene" | "chapter", id: string) => void;
  showSidePanels: boolean; view: AppView;
}) {
  const { setShowArchive } = p.overlays;
  const callbacksWithGoal = { ...p.callbacks, onAddGoal: p.onAddGoal };
  const binderSlot = p.showSidePanels
    ? <Binder tree={p.tree} selectedSceneId={p.selectedSceneId} onSelectScene={p.onSelectScene}
        callbacks={callbacksWithGoal} projects={p.projects} activeProjectId={p.activeProjectId}
        onSwitchProject={p.onSwitchProject} onCreateProject={p.onCreateProject}
        dragCallbacks={p.dragCallbacks} quickCount={p.quickCount}
        archivedCount={p.archivedCount}
        manuscriptTotal={p.manuscriptTotal}
        onOpenQuickNotes={() => p.overlays.setShowInbox(true)}
        onOpenArchive={() => setShowArchive(true)} />
    : null;
  const inspectorSlot = (p.showSidePanels && p.view === "editor" && p.activeProjectId)
    ? <SceneInspector store={p.storyBibleStore} projectId={p.activeProjectId}
        sceneId={p.selectedSceneId} scene={p.activeScene}
        refreshKey={p.linksVersion} liveWordCount={p.liveWordCount}
        manuscriptTotal={p.manuscriptTotal} chapterId={p.chapterId} chapterTotal={p.chapterTotal} />
    : null;
  return { binderSlot, inspectorSlot };
}

function useAppContentSlots(props: AppContentProps) {
  const { tree, selectedSceneId, doc, onSelectScene, callbacks, projects, activeProjectId,
    onSwitchProject, onCreateProject, dragCallbacks, view, onViewChange, linksVersion,
    onEntitiesChanged, overlays, storyBibleStore, archivedVersion } = props;
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals,
    setShowQuickCapture, setShowSettings, setShowExport } = overlays;
  useGlobalKeybindings(overlays);
  useQuickItemsBadge(activeProjectId, overlays.setHasQuickItems);
  useEditorStyle();
  const motionOn = useMotion();
  const liveWordCount = useLiveWordCount(doc);
  const manuscriptTotal = useManuscriptWordCount({ tree, activeSceneId: selectedSceneId, liveActiveWords: liveWordCount });
  const goalProgress = useDailyGoalProgress({ projectId: activeProjectId ?? "", scope: "manuscript", targetId: null, currentScopeTotal: manuscriptTotal });
  const quickCount = useQuickCount(activeProjectId);
  const archivedCount = useArchivedCount(activeProjectId, archivedVersion);
  const docName = projects.find((p) => p.id === activeProjectId)?.title;
  const activeScene = useActiveScene(tree, selectedSceneId);
  const { chapterId, chapterTotal } = useChapterInfo(tree, selectedSceneId, liveWordCount);
  const onAddGoal = (scope: "scene" | "chapter", targetId: string) => {
    overlays.setGoalsInitialScope({ scope, targetId });
    setShowGoals(true);
  };
  const showSidePanels = !focusMode && view !== "cork" && view !== "bible";
  const { binderSlot, inspectorSlot } = buildSideSlots({
    tree, selectedSceneId, onSelectScene, callbacks, projects, activeProjectId,
    onSwitchProject, onCreateProject, dragCallbacks, quickCount, archivedCount,
    manuscriptTotal, overlays, storyBibleStore, activeScene, linksVersion, liveWordCount,
    chapterId, chapterTotal, onAddGoal, showSidePanels, view,
  });
  const { reloadTree } = props;
  const viewStageContent = buildViewStage(view, doc, activeProjectId,
    { storyBibleStore, onEntitiesChanged, tree, onSelectScene, onViewChange, selectedSceneId,
      linksVersion, reloadTree, dragCallbacks, onAddGoal, onArchiveScene: callbacks.onArchiveScene });
  return { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture,
    setShowSettings, setShowExport, liveWordCount, manuscriptTotal, goalProgress, docName,
    binderSlot, inspectorSlot, viewStageContent, overlays, activeProjectId, motionOn };
}

export function AppContent(props: AppContentProps) {
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture,
    setShowSettings, setShowExport, liveWordCount, manuscriptTotal, goalProgress, docName,
    binderSlot, inspectorSlot, viewStageContent, overlays, activeProjectId, motionOn } = useAppContentSlots(props);
  const { view, onViewChange } = props;
  return (
    <>
      <AppShell focusMode={focusMode} anim={motionOn} viewKey={view}
        titleBar={<TitleBar view={view} onViewChange={onViewChange} docName={docName}
          goalsOn={goalsOn} hasQuickItems={hasQuickItems}
          onToggleGoals={() => setShowGoals(true)} onOpenQuick={() => setShowQuickCapture(true)}
          onEnterFocus={() => setFocusMode(true)} onOpenSettings={() => setShowSettings(true)}
          onOpenExport={() => setShowExport(true)} />}
        binder={binderSlot}
        viewStage={<>{focusMode && <FocusExitButton onExit={() => setFocusMode(false)} />}{viewStageContent}</>}
        inspector={inspectorSlot}
        statusBar={<StatusBar sceneWordCount={liveWordCount} goalsOn={goalsOn}
          manuscriptTotal={manuscriptTotal} goal={goalProgress} />}
      />
      <OverlayStack {...overlays} activeProjectId={activeProjectId} />
    </>
  );
}

// ---------------------------------------------------------------------------
// View-stage builder (pure — no hooks)
// ---------------------------------------------------------------------------

interface ViewStageCtx {
  storyBibleStore: SqliteStoryBibleStore;
  onEntitiesChanged: () => void;
  tree: BinderTree;
  onSelectScene: (sceneId: string) => void;
  onViewChange: (view: AppView) => void;
  selectedSceneId: string | null;
  linksVersion: number;
  reloadTree: () => void;
  dragCallbacks: DragCallbacks;
  /** Opens Goals modal pre-scoped; passed to Corkboard for right-click "Add goal". */
  onAddGoal: (scope: "scene" | "chapter", targetId: string) => void;
  /** Archives a scene; passed to Corkboard so its context-menu archive is real, not a toast. */
  onArchiveScene: (sceneId: string) => void;
}

function buildViewStage(
  view: AppView, doc: Y.Doc | null, activeProjectId: string | null, ctx: ViewStageCtx,
) {
  if (view === "cork") {
    return (
      <Corkboard
        tree={ctx.tree}
        onSelectScene={ctx.onSelectScene}
        onViewChange={ctx.onViewChange}
        reloadTree={ctx.reloadTree}
        dragCallbacks={ctx.dragCallbacks}
        onAddGoal={ctx.onAddGoal}
        onArchiveScene={ctx.onArchiveScene}
      />
    );
  }
  if (view === "bible" && activeProjectId) {
    return <StoryBibleView store={ctx.storyBibleStore} projectId={activeProjectId}
      onEntitiesChanged={ctx.onEntitiesChanged} />;
  }
  return <EditorPane doc={doc} view={view} tree={ctx.tree} selectedSceneId={ctx.selectedSceneId}
    storyBibleStore={ctx.storyBibleStore} linksVersion={ctx.linksVersion} />;
}
