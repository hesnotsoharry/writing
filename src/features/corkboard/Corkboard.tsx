import type { DragEndEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext } from "@dnd-kit/sortable";
import { useState } from "react";

import type { AppView } from "../../App.state";
import type { DragCallbacks } from "../../binder/BinderDrag";
import type { BinderTree, Chapter } from "../../binder/buildTree";
import { buildTree } from "../../binder/buildTree";
import { ContextMenu, type MenuDescriptor } from "../../components/menu/ContextMenu";
import { buildSceneMenu } from "../../components/menu/sceneMenu";
import { Toast, type ToastDescriptor } from "../../components/menu/Toast";
import type { Scene, SceneStatus } from "../../db/binderStore";
import type { SetStatus } from "./CorkCard";
import { ChapterGroup, defaultBinderStore, ShortPiecesGroup, useCorkStatus } from "./CorkCard";

// ---------------------------------------------------------------------------
// useLocalTree — local working copy + reload (render-phase sync, no effect)
// ---------------------------------------------------------------------------

function useLocalTree(tree: BinderTree) {
  const [prevTree, setPrevTree] = useState(tree);
  const [localTree, setLocalTree] = useState<BinderTree>(tree);

  if (prevTree !== tree) { setPrevTree(tree); setLocalTree(tree); }

  const reload = () => {
    const projectId = tree.chapters[0]?.folder.project_id ?? tree.shortPieces[0]?.project_id;
    if (!projectId) return;
    defaultBinderStore.loadProject(projectId).then(({ folders, scenes }) => {
      setLocalTree(buildTree(folders, scenes));
    }).catch((err: unknown) => { console.warn("[corkboard] reload failed", err); });
  };

  return { localTree, reload };
}

// ---------------------------------------------------------------------------
// useSceneMenu — context-menu + toast + rename-activation state
// ---------------------------------------------------------------------------

interface SceneMenuHook {
  menu: MenuDescriptor | null;
  toast: ToastDescriptor | null;
  renamingSceneId: string | null;
  setMenu: (m: MenuDescriptor | null) => void;
  setToast: (t: ToastDescriptor | null) => void;
  setRenamingSceneId: (id: string | null) => void;
  handleContextMenu: (e: React.MouseEvent, scene: Scene) => void;
}

interface SceneMenuArgs {
  overrides: Record<string, SceneStatus>;
  setSceneStatus: SetStatus;
  reload: () => void;
  setOverride: (id: string, s: SceneStatus) => void;
  onAfterStatusWrite?: () => void;
  onAfterDelete?: () => void;
  onAddGoal?: (scope: "scene" | "chapter", targetId: string) => void;
  onArchiveScene?: (sceneId: string) => void;
}

function useSceneMenu(a: SceneMenuArgs): SceneMenuHook {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [toast, setToast] = useState<ToastDescriptor | null>(null);
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent, scene: Scene) => {
    const effectiveStatus = a.overrides[scene.id] ?? scene.status;
    setMenu({
      x: e.clientX, y: e.clientY,
      items: buildSceneMenu({
        onRename: () => { setMenu(null); setRenamingSceneId(scene.id); },
        currentStatus: effectiveStatus,
        onSetStatus: (s) => {
          a.setOverride(scene.id, s);
          setMenu(null);
          void Promise.resolve(a.setSceneStatus(scene.id, s))
            .then(() => { a.onAfterStatusWrite?.(); })
            .catch((err: unknown) => { console.error("[corkboard] setSceneStatus failed", err); });
        },
        onDuplicate: () => setToast({ label: "Duplicate — coming in a later wave" }),
        onExport: () => setToast({ label: "Export — coming in a later wave" }),
        onArchive: a.onArchiveScene
          ? () => { setMenu(null); a.onArchiveScene!(scene.id); }
          : () => setToast({ label: "Archive — coming in a later wave" }),
        onDelete: () => {
          setMenu(null);
          defaultBinderStore.deleteScene(scene.id)
            .then(() => { a.reload(); a.onAfterDelete?.(); })
            .catch((err: unknown) => { console.warn("[corkboard] deleteScene failed", err); });
        },
        onAddGoal: a.onAddGoal
          ? () => a.onAddGoal!("scene", scene.id)
          : undefined,
      }),
    });
  };

  return { menu, toast, renamingSceneId, setMenu, setToast, setRenamingSceneId, handleContextMenu };
}

// ---------------------------------------------------------------------------
// CorkGroupDnd — DnD wrapper for a single chapter/short-pieces group.
// One DndContext per group keeps the drag contained and avoids cross-group collision.
// ---------------------------------------------------------------------------

interface GroupDndHandlerArgs {
  ids: string[];
  folderId: string | null;
  cbs: DragCallbacks;
  onAfterDrop: () => void;
  liveIds: string[] | null;
  setLiveIds: (v: string[] | null | ((prev: string[] | null) => string[] | null)) => void;
}

function useGroupDragHandlers(a: GroupDndHandlerArgs) {
  const { ids, folderId, cbs, liveIds, setLiveIds } = a;

  function onDragStart() { setLiveIds(ids); }

  function onDragOver(e: { active: { id: string | number }; over: { id: string | number } | null }) {
    if (!e.over) return;
    setLiveIds((prev) => {
      const cur = prev ?? ids;
      const oi = cur.indexOf(String(e.active.id));
      const ni = cur.indexOf(String(e.over!.id));
      return (oi === -1 || ni === -1 || oi === ni) ? prev : arrayMove(cur, oi, ni);
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const aid = String(event.active.id);
    const final = liveIds ?? ids;
    setLiveIds(null);
    if (!event.over || event.active.id === event.over.id) return;
    const toIndex = final.indexOf(aid);
    // onMoveScene already calls doReload after the DB write resolves (App.handlers.ts).
    // Do NOT call onAfterDrop here — that would fire reloadTree synchronously BEFORE
    // the write settles, causing a double-reload race (pre-write flash then post-write reload).
    if (toIndex !== -1) { cbs.onMoveScene(aid, folderId, toIndex); }
  }

  function onDragCancel() { setLiveIds(null); }

  return { onDragStart, onDragOver, onDragEnd, onDragCancel, sortedIds: liveIds ?? ids };
}

interface CorkGroupDndProps {
  folderId: string | null;
  scenes: Scene[];
  cbs: DragCallbacks;
  onAfterDrop: () => void;
  children: (sortedScenes: Scene[]) => React.ReactNode;
}

export function CorkGroupDnd({ folderId, scenes, cbs, onAfterDrop, children }: CorkGroupDndProps) {
  const [liveIds, setLiveIds] = useState<string[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const ids = scenes.map((s) => s.id);
  const { onDragStart, onDragOver, onDragEnd, onDragCancel, sortedIds } =
    useGroupDragHandlers({ ids, folderId, cbs, onAfterDrop, liveIds, setLiveIds });
  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  const sortedScenes = sortedIds.map((id) => byId[id]).filter(Boolean) as Scene[];
  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragOver={onDragOver}
      onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
      <SortableContext items={sortedIds} strategy={rectSortingStrategy}>
        {children(sortedScenes)}
      </SortableContext>
      <DragOverlay dropAnimation={null}>{null}</DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// CorkboardContent — tree layout with chapters and short pieces
// ---------------------------------------------------------------------------

interface SharedGroupProps {
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  onCycleStatus: (scene: Scene) => void;
  onContextMenu: (e: React.MouseEvent, scene: Scene) => void;
  onReload: () => void;
  renamingSceneId: string | null;
  onRenameEnd: () => void;
  sortable: boolean;
}

interface CorkboardContentProps {
  localTree: BinderTree;
  overrides: Record<string, SceneStatus>;
  statusOf: (s: Scene) => SceneStatus;
  dragCallbacks?: DragCallbacks;
  onAfterDrop: () => void;
  shared: SharedGroupProps;
}

interface RenderChapterArgs {
  ch: Chapter; cbs: DragCallbacks; onAfterDrop: () => void;
  shared: SharedGroupProps; overrides: Record<string, SceneStatus>;
}

function renderChapter({ ch, cbs, onAfterDrop, shared, overrides }: RenderChapterArgs) {
  return (
    <CorkGroupDnd key={ch.folder.id} folderId={ch.folder.id}
      scenes={ch.scenes} cbs={cbs} onAfterDrop={onAfterDrop}>
      {(live) => <ChapterGroup chapter={{ ...ch, scenes: live }} overrides={overrides} {...shared} />}
    </CorkGroupDnd>
  );
}

function CorkboardContent({ localTree, overrides, statusOf, dragCallbacks, onAfterDrop, shared }: CorkboardContentProps) {
  return (
    <div className="corkboard-inner">
      {dragCallbacks
        ? localTree.chapters.map((ch) => renderChapter({ ch, cbs: dragCallbacks, onAfterDrop, shared, overrides }))
        : localTree.chapters.map((ch) => (
            <ChapterGroup key={ch.folder.id} chapter={ch} overrides={overrides} {...shared} />
          ))}
      {dragCallbacks
        ? (
          <CorkGroupDnd folderId={null} scenes={localTree.shortPieces}
            cbs={dragCallbacks} onAfterDrop={onAfterDrop}>
            {(live) => <ShortPiecesGroup scenes={live} statusOf={statusOf} {...shared} />}
          </CorkGroupDnd>
        )
        : <ShortPiecesGroup scenes={localTree.shortPieces} statusOf={statusOf} {...shared} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corkboard
// ---------------------------------------------------------------------------

interface CorkboardProps {
  tree: BinderTree;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  setSceneStatus?: SetStatus;
  /** Reload the shared binder tree — called after any status write or DnD drop. */
  reloadTree?: () => void;
  /** Drag-reorder callbacks — when provided, cards become draggable. */
  dragCallbacks?: DragCallbacks;
  /** Opens the Goals modal pre-scoped to a scene. Optional. */
  onAddGoal?: (scope: "scene" | "chapter", targetId: string) => void;
  /** Archives a scene via the real store; when absent falls back to the "coming later" toast. */
  onArchiveScene?: (sceneId: string) => void;
}

export function Corkboard({
  tree,
  onSelectScene,
  onViewChange,
  setSceneStatus = (id, status) => defaultBinderStore.setSceneStatus(id, status),
  reloadTree,
  dragCallbacks,
  onAddGoal,
  onArchiveScene,
}: CorkboardProps) {
  const { overrides, statusOf, cycleStatus, setOverride } = useCorkStatus(setSceneStatus, reloadTree);
  const { localTree, reload } = useLocalTree(tree);
  const { menu, toast, renamingSceneId, setMenu, setToast, setRenamingSceneId, handleContextMenu } =
    useSceneMenu({ overrides, setSceneStatus, reload, setOverride, onAfterStatusWrite: reloadTree, onAfterDelete: reloadTree, onAddGoal, onArchiveScene });
  const shared: SharedGroupProps = {
    onSelectScene, onViewChange, onCycleStatus: cycleStatus, onContextMenu: handleContextMenu,
    onReload: reload, renamingSceneId, onRenameEnd: () => setRenamingSceneId(null),
    sortable: !!dragCallbacks,
  };
  return (
    <div className="corkboard">
      <CorkboardContent
        localTree={localTree} overrides={overrides} statusOf={statusOf}
        dragCallbacks={dragCallbacks} onAfterDrop={() => { reloadTree?.(); }}
        shared={shared}
      />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <Toast toast={toast} onUndo={() => setToast(null)} onClose={() => setToast(null)} />
    </div>
  );
}
