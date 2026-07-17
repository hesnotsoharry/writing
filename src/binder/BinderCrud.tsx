/**
 * CRUD affordance components for the Binder (Phase 2 rebuild).
 *
 * All mutations are behind right-click context menus (no always-visible
 * inline buttons). Double-click enters inline rename. Status changes are
 * threaded end-to-end via onSetSceneStatus.
 */
import { useEffect, useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { buildChapterMenu, buildSceneMenu } from "../components/menu/sceneMenu";
import { StatusGlyph } from "../components/StatusGlyph";
import type { Scene } from "../db/binderStore";
import type { SceneStatus } from "../lib/status";
import { normalizeStatus } from "../lib/status";
import { useBinderToast } from "./binderToast";
import type { BinderTree } from "./buildTree";
import { buildStatusItems } from "./statusPicker";

// ── Public types ──────────────────────────────────────────────────────────

/** All CRUD callbacks threaded from App → Binder → sub-components. */
export interface BinderCallbacks {
  onCreateChapter: () => void;
  onCreateScene: (folderId: string | null) => void;
  onRenameFolder: (id: string, title: string) => void;
  onRenameScene: (id: string, title: string) => void;
  onDeleteChapter: (id: string) => void;
  onDeleteScene: (id: string) => void;
  onSetSceneStatus: (id: string, status: SceneStatus) => void;
  /** Archive stubs — real DB writes wired in a later wave. */
  onArchiveScene: (id: string) => void;
  onArchiveChapter: (id: string) => void;
  /**
   * Opens the Goals modal pre-scoped to a scene or chapter.
   * Optional — omitting it disables the "Add goal…" item in context menus.
   */
  onAddGoal?: (scope: "scene" | "chapter", targetId: string) => void;
  /**
   * Opens the Export overlay pre-scoped to a scene or chapter.
   * Optional — omitting it falls back to the "coming in a later wave" toast.
   */
  onExport?: (scope: "scene" | "chapter", targetId: string) => void;
  /**
   * Take a named snapshot of a scene.
   * Optional — existing callers omit it; missing = item hidden from menu.
   */
  onTakeSnapshot?: (sceneId: string) => void;
  /**
   * Open the Version History overlay for a scene.
   * Optional — existing callers omit it; missing = item hidden from menu.
   */
  onOpenHistory?: (sceneId: string) => void;
  /**
   * Persist the AI-context shield flag for a scene.
   * Optional — omitting it disables the EditorHeader toggle.
   */
  onSetSceneExcludedFromAi?: (sceneId: string, exclude: boolean) => void;
}

// ── InlineRename ──────────────────────────────────────────────────────────

interface InlineRenameProps {
  current: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}

/** Text input that commits on Enter/blur and cancels on Escape. */
export function InlineRename({ current, onCommit, onCancel }: InlineRenameProps) {
  const [value, setValue] = useState(current);
  const doneRef = useRef(false);

  function commit() {
    if (doneRef.current) return;
    doneRef.current = true;
    const t = value.trim();
    if (t) onCommit(t);
    else onCancel();
  }

  function cancel() {
    if (doneRef.current) return;
    doneRef.current = true;
    onCancel();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }

  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      className="rename-input"
    />
  );
}

// ── Shared delete confirmations ───────────────────────────────────────────

interface DeleteConfirmProps { itemType: string; itemTitle: string; warning?: string; onConfirm: () => void; onCancel: () => void; }

export function DeleteConfirm({ itemType, itemTitle, warning, onConfirm, onCancel }: DeleteConfirmProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onCancel(); } };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);
  return (
    <div className="scrim" role="presentation" style={{ position: "fixed", zIndex: 100 }} onMouseDown={onCancel}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-head"><div>
          <div className="sheet-title" id="delete-confirm-title">Delete {itemType}?</div>
          <div className="sheet-sub">“{itemTitle}” will be deleted.</div>
        </div></div>
        {warning && <div className="sheet-body"><p>{warning}</p></div>}
        <div className="sheet-foot">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>Delete {itemType}</button>
        </div>
      </div>
    </div>
  );
}

// ── SceneStatusIndicator ──────────────────────────────────────────────────

interface SceneStatusIndicatorProps {
  status: SceneStatus;
  /** When provided, wraps the dot/check in a clickable element (cursor: pointer). */
  onClick?: (e: React.MouseEvent) => void;
}

function SceneStatusIndicator({ status, onClick }: SceneStatusIndicatorProps) {
  return (
    <StatusGlyph
      status={normalizeStatus(status)}
      size={13}
      onClick={onClick}
    />
  );
}

// ── SceneRow ──────────────────────────────────────────────────────────────

export interface SceneRowProps {
  scene: Scene;
  isSelected: boolean;
  onSelect: () => void;
  callbacks: BinderCallbacks;
}

function useSceneMenu(
  scene: Scene,
  callbacks: BinderCallbacks,
  onRename: () => void,
  onDelete: () => void,
) {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const showToast = useBinderToast();

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX, y: e.clientY,
      items: buildSceneMenu({
        onRename,
        currentStatus: normalizeStatus(scene.status),
        onSetStatus: (s) => callbacks.onSetSceneStatus(scene.id, s),
        onDuplicate: () => showToast("Duplicate — coming in a later wave"),
        onExport: callbacks.onExport
          ? () => callbacks.onExport!("scene", scene.id)
          : () => showToast("Export — coming in a later wave"),
        onArchive: () => callbacks.onArchiveScene(scene.id),
        onDelete,
        onAddGoal: callbacks.onAddGoal
          ? () => callbacks.onAddGoal!("scene", scene.id)
          : undefined,
        onTakeSnapshot: callbacks.onTakeSnapshot
          ? () => callbacks.onTakeSnapshot!(scene.id)
          : undefined,
        onOpenHistory: callbacks.onOpenHistory
          ? () => callbacks.onOpenHistory!(scene.id)
          : undefined,
      }),
    });
  }

  return { menu, setMenu, openMenu };
}

/** One scene row: status indicator + title + word count. Mutations via context menu. */
export function SceneRow({ scene, isSelected, onSelect, callbacks }: SceneRowProps) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { menu, setMenu, openMenu } = useSceneMenu(scene, callbacks, () => setEditing(true), () => setDeleteOpen(true));

  function handleStatusClick(e: React.MouseEvent) {
    e.stopPropagation();
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: buildStatusItems(normalizeStatus(scene.status), (s) => {
        callbacks.onSetSceneStatus(scene.id, s);
        setMenu(null);
      }),
    });
  }

  const wordCount = scene.word_count != null ? scene.word_count.toLocaleString() : "—";
  const titleEl = editing
    ? <InlineRename current={scene.title}
        onCommit={(t) => { callbacks.onRenameScene(scene.id, t); setEditing(false); }}
        onCancel={() => setEditing(false)} />
    : <span className="scene-title">{scene.title}</span>;

  return (
    <>
      <li className={"scene-row" + (isSelected ? " active" : "")}
        onClick={onSelect} onContextMenu={openMenu}
        onDoubleClick={() => setEditing(true)}>
        <SceneStatusIndicator status={scene.status} onClick={handleStatusClick} />
        {titleEl}
        <span className="scene-words">{wordCount}</span>
      </li>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      {deleteOpen && <DeleteConfirm itemType="scene" itemTitle={scene.title}
        onCancel={() => setDeleteOpen(false)} onConfirm={() => { setDeleteOpen(false); callbacks.onDeleteScene(scene.id); }} />}
    </>
  );
}

// ── ChapterHeader ─────────────────────────────────────────────────────────

type ChapterFolder = BinderTree["chapters"][0]["folder"];

function useChapterMenu(
  folder: ChapterFolder,
  chapter: BinderTree["chapters"][0],
  callbacks: BinderCallbacks,
  actions: { onRename: () => void; onDelete: () => void },
) {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const showToast = useBinderToast();

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX, y: e.clientY,
      items: buildChapterMenu({
        onRename: actions.onRename,
        onNewScene: () => callbacks.onCreateScene(folder.id),
        onExport: callbacks.onExport
          ? () => callbacks.onExport!("chapter", folder.id)
          : () => showToast("Export — coming in a later wave"),
        onArchive: () => callbacks.onArchiveChapter(folder.id),
        onDelete: actions.onDelete,
        onAddGoal: callbacks.onAddGoal
          ? () => callbacks.onAddGoal!("chapter", folder.id)
          : undefined,
      }),
    });
  }

  return { menu, setMenu, openMenu, sceneCount: chapter.scenes.length };
}

interface ChapterHeaderProps {
  chapter: BinderTree["chapters"][0];
  callbacks: BinderCallbacks;
  open?: boolean;
  onToggle?: () => void;
}

/** Chapter heading row: collapse toggle + title. Mutations via context menu. */
export function ChapterHeader({ chapter, callbacks, open = true, onToggle = () => {} }: ChapterHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { menu, setMenu, openMenu, sceneCount } = useChapterMenu(
    chapter.folder, chapter, callbacks, { onRename: () => setEditing(true), onDelete: () => setDeleteOpen(true) },
  );

  const titleEl = editing
    ? <InlineRename current={chapter.folder.title}
        onCommit={(t) => { callbacks.onRenameFolder(chapter.folder.id, t); setEditing(false); }}
        onCancel={() => setEditing(false)} />
    : <span className="ch-title">{chapter.folder.title}</span>;

  return (
    <>
      <div className={"chapter-row" + (open ? "" : " closed")}
        onClick={onToggle} onContextMenu={openMenu}
        onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}>
        <span className="twist"><Icon name="chevDown" style={{ width: 13, height: 13 }} /></span>
        {titleEl}
        <span className="ch-count">{sceneCount}</span>
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      {deleteOpen && <DeleteConfirm itemType="chapter" itemTitle={chapter.folder.title}
        warning="Its scenes will move to Short pieces."
        onCancel={() => setDeleteOpen(false)} onConfirm={() => { setDeleteOpen(false); callbacks.onDeleteChapter(chapter.folder.id); }} />}
    </>
  );
}
