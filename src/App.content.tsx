/**
 * AppContent and its helpers — extracted from App.tsx to satisfy the
 * 300-line file limit. App.tsx owns bootstrapping + wiring; this file
 * owns the rendered shell composition (slots, focus mode, overlay stack).
 */
import type { Dispatch, SetStateAction } from "react";
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
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EditorPane({ doc, view, tree, selectedSceneId, storyBibleStore, linksVersion }: {
  doc: Y.Doc | null;
  view: AppView;
  tree: BinderTree;
  selectedSceneId: string | null;
  storyBibleStore: SqliteStoryBibleStore;
  linksVersion: number;
}) {
  return (
    <main className="canvas-pane">
      {doc
        ? <Editor doc={doc} view={view} tree={tree} selectedSceneId={selectedSceneId}
            storyBibleStore={storyBibleStore} linksVersion={linksVersion} />
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

// ---------------------------------------------------------------------------
// AppContent
// ---------------------------------------------------------------------------

function useAppContentSlots(props: AppContentProps) {
  const { tree, selectedSceneId, doc, onSelectScene, callbacks, projects, activeProjectId,
    onSwitchProject, onCreateProject, dragCallbacks, view, onViewChange, linksVersion,
    onEntitiesChanged, overlays, storyBibleStore } = props;
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture,
    setShowSettings, setShowExport, setShowArchive } = overlays;
  useGlobalKeybindings(overlays);
  useQuickItemsBadge(activeProjectId, overlays.setHasQuickItems);
  useEditorStyle(); // wave-17: --font-prose/--prose-size/--prose-leading/--prose-measure
  const liveWordCount = useLiveWordCount(doc);
  const manuscriptTotal = useManuscriptWordCount({ tree, activeSceneId: selectedSceneId, liveActiveWords: liveWordCount });
  const goalProgress = useDailyGoalProgress({ projectId: activeProjectId ?? "", currentTotal: manuscriptTotal });
  const quickCount = useQuickCount(activeProjectId);
  const docName = projects.find((p) => p.id === activeProjectId)?.title;
  const activeScene = useActiveScene(tree, selectedSceneId);
  // Binder and inspector are hidden in focus mode and also when the full-screen
  // cork/bible views are active — those views own the entire center stage.
  const showSidePanels = !focusMode && view !== "cork" && view !== "bible";
  const binderSlot = showSidePanels
    ? (
      <Binder tree={tree} selectedSceneId={selectedSceneId} onSelectScene={onSelectScene}
        callbacks={callbacks} projects={projects} activeProjectId={activeProjectId}
        onSwitchProject={onSwitchProject} onCreateProject={onCreateProject}
        dragCallbacks={dragCallbacks} quickCount={quickCount}
        manuscriptTotal={manuscriptTotal}
        onOpenQuickNotes={() => overlays.setShowInbox(true)}
        onOpenArchive={() => setShowArchive(true)} />
    )
    : null;
  const inspectorSlot = (showSidePanels && view === "editor" && activeProjectId)
    ? <SceneInspector store={storyBibleStore} projectId={activeProjectId}
        sceneId={selectedSceneId} scene={activeScene}
        refreshKey={linksVersion} liveWordCount={liveWordCount} />
    : null;
  const viewStageContent = buildViewStage(view, doc, activeProjectId,
    { storyBibleStore, onEntitiesChanged, tree, onSelectScene, onViewChange, selectedSceneId, linksVersion });
  return { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture,
    setShowSettings, setShowExport, liveWordCount, manuscriptTotal, goalProgress, docName,
    binderSlot, inspectorSlot, viewStageContent, overlays, activeProjectId };
}

export function AppContent(props: AppContentProps) {
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture,
    setShowSettings, setShowExport, liveWordCount, manuscriptTotal, goalProgress, docName,
    binderSlot, inspectorSlot, viewStageContent, overlays, activeProjectId } = useAppContentSlots(props);
  const { view, onViewChange } = props;
  return (
    <>
      <AppShell focusMode={focusMode}
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
}

function buildViewStage(
  view: AppView, doc: Y.Doc | null, activeProjectId: string | null, ctx: ViewStageCtx,
) {
  if (view === "cork") {
    return <Corkboard tree={ctx.tree} onSelectScene={ctx.onSelectScene} onViewChange={ctx.onViewChange} />;
  }
  if (view === "bible" && activeProjectId) {
    return <StoryBibleView store={ctx.storyBibleStore} projectId={activeProjectId}
      onEntitiesChanged={ctx.onEntitiesChanged} />;
  }
  return <EditorPane doc={doc} view={view} tree={ctx.tree} selectedSceneId={ctx.selectedSceneId}
    storyBibleStore={ctx.storyBibleStore} linksVersion={ctx.linksVersion} />;
}
