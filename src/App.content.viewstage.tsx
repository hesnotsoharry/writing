/**
 * buildViewStage + CorkOutlinerView — extracted from App.content.tsx to satisfy
 * the 300-line file limit. Owns the view routing logic and the cork/outliner
 * toggle panel.
 */
import type * as Y from "yjs";

import { EditorPane } from "./App.content.editor";
import { EntryViewStage } from "./App.entryView";
import type { AppView, EntryFrame } from "./App.state";
import type { DragCallbacks } from "./binder/BinderDrag";
import type { BinderTree } from "./binder/buildTree";
import { Icon } from "./components/Icon";
import type { Scene } from "./db/binderStore";
import type { Label, LabelStore } from "./db/labelStore";
import type { SqliteStoryBibleStore } from "./db/sqliteStoryBibleStore";
import type { EditorFocusProps } from "./editor/Editor";
import { BoardView } from "./features/brainstorm/BoardView";
import { Corkboard } from "./features/corkboard/Corkboard";
import { type OtlSort, Outliner } from "./features/outliner/Outliner";
import { STATUS_ORDER } from "./lib/status";
import { StoryBibleView } from "./storybible/StoryBibleView";

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

export interface ViewStageCtx {
  storyBibleStore: SqliteStoryBibleStore;
  onEntitiesChanged: () => void;
  tree: BinderTree;
  onSelectScene: (sceneId: string) => void;
  onViewChange: (view: AppView) => void;
  selectedSceneId: string | null;
  linksVersion: number;
  reloadTree: () => void;
  dragCallbacks: DragCallbacks;
  onAddGoal: (scope: "scene" | "chapter", targetId: string) => void;
  onArchiveScene: (sceneId: string) => void;
  onExport: (scope: "scene", targetId: string) => void;
  entryStack: EntryFrame[];
  entryOrigin: "write" | "bible";
  onOpenEntry: (id: string, kind: string) => void;
  onPushEntry: (id: string, kind: string) => void;
  onEntryBack: () => void;
  onExitEntry: () => void;
  onDeleteEntity: (kind: string, id: string) => void;
  labelStore: LabelStore;
  labels: Label[];
  sceneLabels: Record<string, string[]>;
  outlinerSort: OtlSort;
  setOutlinerSort: (updater: (s: OtlSort) => OtlSort) => void;
  outlinerRenaming: string | null;
  setOutlinerRenaming: (id: string | null) => void;
  onOpenLabelManager: () => void;
  onLabelsChanged: () => void;
  onTakeSnapshot?: (sceneId: string) => void;
  onOpenHistory?: (sceneId: string) => void;
  /** Focus-mode props forwarded to EditorPane → Editor (all optional). */
  editorFocus?: EditorFocusProps;
  /** Opens Find & Replace with the given entity name prefilled. */
  onFindMentions?: (entityName: string) => void;
  /** Registers the editor inserter fn so the inspector can insert entity names at caret. */
  onRegisterInsert?: (fn: (text: string) => void) => void;
}

// ---------------------------------------------------------------------------
// CorkOutlinerView helpers
// ---------------------------------------------------------------------------

interface CorkOutlinerProps {
  view: AppView;
  tree: BinderTree;
  onSelectScene: (id: string) => void;
  onViewChange: (v: AppView) => void;
  reloadTree: () => void;
  dragCallbacks: DragCallbacks;
  onAddGoal: (scope: "scene" | "chapter", targetId: string) => void;
  onArchiveScene: (sceneId: string) => void;
  onExport: (scope: "scene", targetId: string) => void;
  labelStore: LabelStore;
  labels: Label[];
  sceneLabels: Record<string, string[]>;
  outlinerSort: OtlSort;
  setOutlinerSort: (updater: (s: OtlSort) => OtlSort) => void;
  outlinerRenaming: string | null;
  setOutlinerRenaming: (id: string | null) => void;
  onOpenLabelManager: () => void;
  onLabelsChanged: () => void;
  onTakeSnapshot?: (sceneId: string) => void;
  onOpenHistory?: (sceneId: string) => void;
}

function makeOutlinerHandlers(p: CorkOutlinerProps) {
  return {
    onOpenScene: p.onSelectScene,
    onViewChange: p.onViewChange,
    setRenaming: p.setOutlinerRenaming,
    onExport: (sceneId: string) => p.onExport("scene", sceneId),
    onSetSynopsis: (id: string, text: string) => {
      import("./db/sqliteBinderStore").then(({ SqliteBinderStore }) => {
        new SqliteBinderStore().setSceneSynopsis(id, text || null)
          .then(p.reloadTree)
          .catch((e: unknown) => console.error("[outliner] setSceneSynopsis failed", e));
      }).catch((e: unknown) => console.error("[outliner] import sqliteBinderStore failed", e));
    },
    onRename: (id: string, title: string) => {
      import("./db/sqliteBinderStore").then(({ SqliteBinderStore }) => {
        new SqliteBinderStore().renameScene(id, title)
          .then(p.reloadTree)
          .catch((e: unknown) => console.error("[outliner] renameScene failed", e));
      }).catch((e: unknown) => console.error("[outliner] import sqliteBinderStore failed", e));
    },
    onStatus: (_e: React.MouseEvent, scene: Scene) => {
      const idx = STATUS_ORDER.indexOf(scene.status);
      const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
      import("./db/sqliteBinderStore").then(({ SqliteBinderStore }) => {
        new SqliteBinderStore().setSceneStatus(scene.id, next)
          .then(p.reloadTree)
          .catch((e: unknown) => console.error("[outliner] setSceneStatus failed", e));
      }).catch((e: unknown) => console.error("[outliner] import sqliteBinderStore failed", e));
    },
    onToggleLabel: (sceneId: string, labelId: string) => {
      const assigned = p.sceneLabels[sceneId] ?? [];
      const op = assigned.includes(labelId)
        ? p.labelStore.unassignLabel(sceneId, labelId)
        : p.labelStore.assignLabel(sceneId, labelId);
      op.then(p.onLabelsChanged)
        .catch((e: unknown) => console.error("[outliner] toggle label failed", e));
    },
  };
}

function PlanContent(p: CorkOutlinerProps & { isOutline: boolean }) {
  if (p.isOutline) {
    return <Outliner tree={p.tree} labels={p.labels} sceneLabels={p.sceneLabels}
      sort={p.outlinerSort} setSort={p.setOutlinerSort}
      renaming={p.outlinerRenaming} onManageLabels={p.onOpenLabelManager}
      onMoveScene={p.dragCallbacks.onMoveScene}
      h={makeOutlinerHandlers(p)} />;
  }
  return <Corkboard tree={p.tree} onSelectScene={p.onSelectScene} onViewChange={p.onViewChange}
    reloadTree={p.reloadTree} dragCallbacks={p.dragCallbacks}
    onAddGoal={p.onAddGoal} onArchiveScene={p.onArchiveScene} onExport={p.onExport}
    labels={p.labels} sceneLabels={p.sceneLabels}
    onTakeSnapshot={p.onTakeSnapshot} onOpenHistory={p.onOpenHistory}
    onToggleLabel={(sceneId, labelId) => {
      const assigned = p.sceneLabels[sceneId] ?? [];
      const op = assigned.includes(labelId)
        ? p.labelStore.unassignLabel(sceneId, labelId)
        : p.labelStore.assignLabel(sceneId, labelId);
      op.then(p.onLabelsChanged)
        .catch((e: unknown) => console.error("[corkboard] toggle label failed", e));
    }} />;
}

/** Planning area with Corkboard ⇄ Outliner toggle. "cork"/"outline" both activate the TitleBar segment. */
export function CorkOutlinerView(p: CorkOutlinerProps) {
  const isOutline = p.view === "outline";
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="plan-toggle-bar">
        <div className="segmented">
          <button className={!isOutline ? "on" : ""} aria-pressed={!isOutline} onClick={() => p.onViewChange("cork")}>
            <Icon name="grid" className="ic" /> Corkboard
          </button>
          <button className={isOutline ? "on" : ""} aria-pressed={isOutline} onClick={() => p.onViewChange("outline")}>
            <Icon name="list" className="ic" /> Outliner
          </button>
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={p.onOpenLabelManager}>
          <Icon name="palette" className="ic" style={{ width: 14, height: 14 }} /> Labels
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", backgroundColor: "var(--parchment-deep)" }}>
        <PlanContent {...p} isOutline={isOutline} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildViewStage
// ---------------------------------------------------------------------------

export function buildViewStage(
  view: AppView, doc: Y.Doc | null, activeProjectId: string | null, ctx: ViewStageCtx,
) {
  if (view === "cork" || view === "outline") {
    return (
      <CorkOutlinerView
        view={view} tree={ctx.tree} onSelectScene={ctx.onSelectScene}
        onViewChange={ctx.onViewChange} reloadTree={ctx.reloadTree}
        dragCallbacks={ctx.dragCallbacks} onAddGoal={ctx.onAddGoal}
        onArchiveScene={ctx.onArchiveScene} onExport={ctx.onExport}
        labelStore={ctx.labelStore} labels={ctx.labels} sceneLabels={ctx.sceneLabels}
        outlinerSort={ctx.outlinerSort} setOutlinerSort={ctx.setOutlinerSort}
        outlinerRenaming={ctx.outlinerRenaming} setOutlinerRenaming={ctx.setOutlinerRenaming}
        onOpenLabelManager={ctx.onOpenLabelManager} onLabelsChanged={ctx.onLabelsChanged}
        onTakeSnapshot={ctx.onTakeSnapshot} onOpenHistory={ctx.onOpenHistory}
      />
    );
  }
  if (view === "bible" && activeProjectId) {
    return <StoryBibleView store={ctx.storyBibleStore} projectId={activeProjectId}
      onEntitiesChanged={ctx.onEntitiesChanged} onOpenEntry={ctx.onOpenEntry} />;
  }
  if (view === "brainstorm") {
    return <BoardView />;
  }
  if (view === "entry") {
    return <EntryViewStage
      store={ctx.storyBibleStore} entryStack={ctx.entryStack} entryOrigin={ctx.entryOrigin}
      tree={ctx.tree} onSelectScene={ctx.onSelectScene} onPushEntry={ctx.onPushEntry}
      onEntryBack={ctx.onEntryBack} onExitEntry={ctx.onExitEntry}
      onDeleteEntity={ctx.onDeleteEntity} />;
  }
  return <EditorPane doc={doc} view={view} tree={ctx.tree} selectedSceneId={ctx.selectedSceneId}
    storyBibleStore={ctx.storyBibleStore} linksVersion={ctx.linksVersion}
    onOpenEntry={ctx.onOpenEntry} activeProjectId={activeProjectId}
    onFindMentions={ctx.onFindMentions} onRegisterInsert={ctx.onRegisterInsert} {...(ctx.editorFocus ?? {})} />;
}
