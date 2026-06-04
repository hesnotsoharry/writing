import { useState } from "react";

import type { AppView } from "../../App.state";
import type { BinderTree } from "../../binder/buildTree";
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
    const projectId =
      tree.chapters[0]?.folder.project_id ??
      tree.shortPieces[0]?.project_id;
    if (!projectId) return;
    defaultBinderStore.loadProject(projectId).then(({ folders, scenes }) => {
      setLocalTree(buildTree(folders, scenes));
    }).catch((err: unknown) => {
      console.warn("[corkboard] reload failed, keeping current tree", err);
    });
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

function useSceneMenu(overrides: Record<string, SceneStatus>, setSceneStatus: SetStatus, reload: () => void, setOverride: (id: string, s: SceneStatus) => void): SceneMenuHook {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [toast, setToast] = useState<ToastDescriptor | null>(null);
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);

  const handleContextMenu = (e: React.MouseEvent, scene: Scene) => {
    const effectiveStatus = overrides[scene.id] ?? scene.status;
    setMenu({
      x: e.clientX, y: e.clientY,
      items: buildSceneMenu({
        onRename: () => { setMenu(null); setRenamingSceneId(scene.id); },
        currentStatus: effectiveStatus,
        onSetStatus: (s) => {
          setOverride(scene.id, s);
          setMenu(null);
          void Promise.resolve(setSceneStatus(scene.id, s)).catch((err: unknown) =>
            console.error("[corkboard] setSceneStatus failed", err));
        },
        onDuplicate: () => setToast({ label: "Duplicate — coming in a later wave" }),
        onExport: () => setToast({ label: "Export — coming in a later wave" }),
        onArchive: () => setToast({ label: "Archive — coming in a later wave" }),
        onDelete: () => {
          setMenu(null);
          defaultBinderStore.deleteScene(scene.id).then(reload).catch((err: unknown) =>
            console.warn("[corkboard] deleteScene failed", err));
        },
      }),
    });
  };

  return { menu, toast, renamingSceneId, setMenu, setToast, setRenamingSceneId, handleContextMenu };
}

// ---------------------------------------------------------------------------
// CorkboardContent — tree layout with chapters and short pieces
// ---------------------------------------------------------------------------

interface CorkboardContentProps {
  localTree: BinderTree;
  overrides: Record<string, SceneStatus>;
  statusOf: (s: Scene) => SceneStatus;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  onCycleStatus: (scene: Scene) => void;
  onContextMenu: (e: React.MouseEvent, scene: Scene) => void;
  onReload: () => void;
  renamingSceneId: string | null;
  onRenameEnd: () => void;
}

function CorkboardContent(p: CorkboardContentProps) {
  const shared = {
    onSelectScene: p.onSelectScene,
    onViewChange: p.onViewChange,
    onCycleStatus: p.onCycleStatus,
    onContextMenu: p.onContextMenu,
    onReload: p.onReload,
    renamingSceneId: p.renamingSceneId,
    onRenameEnd: p.onRenameEnd,
  };
  return (
    <div className="corkboard-inner">
      {p.localTree.chapters.map((ch) => (
        <ChapterGroup key={ch.folder.id} chapter={ch} overrides={p.overrides} {...shared} />
      ))}
      <ShortPiecesGroup scenes={p.localTree.shortPieces} statusOf={p.statusOf} {...shared} />
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
}

export function Corkboard({
  tree,
  onSelectScene,
  onViewChange,
  setSceneStatus = (id, status) => defaultBinderStore.setSceneStatus(id, status),
}: CorkboardProps) {
  const { overrides, statusOf, cycleStatus, setOverride } = useCorkStatus(setSceneStatus);
  const { localTree, reload } = useLocalTree(tree);
  const { menu, toast, renamingSceneId, setMenu, setToast, setRenamingSceneId, handleContextMenu } =
    useSceneMenu(overrides, setSceneStatus, reload, setOverride);
  const renameEnd = () => setRenamingSceneId(null);

  return (
    <div className="corkboard">
      <CorkboardContent
        localTree={localTree}
        overrides={overrides}
        statusOf={statusOf}
        onSelectScene={onSelectScene}
        onViewChange={onViewChange}
        onCycleStatus={cycleStatus}
        onContextMenu={handleContextMenu}
        onReload={reload}
        renamingSceneId={renamingSceneId}
        onRenameEnd={renameEnd}
      />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <Toast toast={toast} onUndo={() => setToast(null)} onClose={() => setToast(null)} />
    </div>
  );
}
