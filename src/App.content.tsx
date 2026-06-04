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
import { SceneInspector } from "./inspector/SceneInspector";
import { AppShell } from "./shell/AppShell";
import { StatusBar } from "./shell/StatusBar";
import { TitleBar } from "./shell/TitleBar";
import { StoryBibleView } from "./storybible/StoryBibleView";

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
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EditorPane({ doc }: { doc: Y.Doc | null }) {
  return (
    <main className="canvas-pane">
      {doc ? <Editor doc={doc} /> : <div className="canvas-empty">Select a scene to start writing.</div>}
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

export function AppContent({
  tree, selectedSceneId, doc, onSelectScene, callbacks,
  projects, activeProjectId, onSwitchProject, onCreateProject,
  dragCallbacks, view, onViewChange, linksVersion, onEntitiesChanged,
  overlays, storyBibleStore,
}: AppContentProps) {
  const { focusMode, setFocusMode, goalsOn, hasQuickItems, setShowGoals, setShowQuickCapture, setShowSettings, setShowExport } = overlays;
  useGlobalKeybindings(overlays);
  const liveWordCount = useLiveWordCount(doc);
  const docName = projects.find((p) => p.id === activeProjectId)?.title;
  const activeScene = useActiveScene(tree, selectedSceneId);
  const binderSlot = focusMode ? null : (
    <Binder tree={tree} selectedSceneId={selectedSceneId} onSelectScene={onSelectScene}
      callbacks={callbacks} projects={projects} activeProjectId={activeProjectId}
      onSwitchProject={onSwitchProject} onCreateProject={onCreateProject}
      dragCallbacks={dragCallbacks} />
  );
  const inspectorSlot = (!focusMode && view === "editor" && activeProjectId)
    ? <SceneInspector store={storyBibleStore} projectId={activeProjectId}
        sceneId={selectedSceneId} scene={activeScene}
        refreshKey={linksVersion} liveWordCount={liveWordCount} />
    : null;
  const viewStageContent = buildViewStage(view, doc, activeProjectId, { storyBibleStore, onEntitiesChanged, tree, onSelectScene, onViewChange });

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
        statusBar={<StatusBar sceneWordCount={liveWordCount} />}
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
  return <EditorPane doc={doc} />;
}
