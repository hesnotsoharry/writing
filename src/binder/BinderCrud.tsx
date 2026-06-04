/**
 * CRUD affordance components for the Binder (Phase 2 rebuild).
 *
 * All mutations are behind right-click context menus (no always-visible
 * inline buttons). Double-click enters inline rename. Status changes are
 * threaded end-to-end via onSetSceneStatus.
 */
import { useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { buildChapterMenu, buildSceneMenu } from "../components/menu/sceneMenu";
import type { Scene } from "../db/binderStore";
import type { SceneStatus } from "../lib/status";
import { normalizeStatus,STATUS_META } from "../lib/status";
import { useBinderToast } from "./binderToast";
import type { BinderTree } from "./buildTree";

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

export function confirmDeleteScene(scene: Scene, onDeleteScene: (id: string) => void) {
  if (window.confirm(`Delete scene "${scene.title}"?`)) onDeleteScene(scene.id);
}

export function confirmDeleteChapter(
  folder: BinderTree["chapters"][0]["folder"],
  onDeleteChapter: (id: string) => void
) {
  if (window.confirm(`Delete chapter "${folder.title}"? Its scenes will move to Short pieces.`)) {
    onDeleteChapter(folder.id);
  }
}

// ── SceneStatusIndicator ──────────────────────────────────────────────────

interface SceneStatusIndicatorProps { status: SceneStatus; }

function SceneStatusIndicator({ status }: SceneStatusIndicatorProps) {
  const meta = STATUS_META[normalizeStatus(status)];
  if (meta.isFinal) {
    return <span className="scene-check" title="Final"><Icon name="check" /></span>;
  }
  return <span className="scene-dot" style={{ background: meta.dot }} title={meta.label} />;
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
        onExport: () => showToast("Export — coming in a later wave"),
        onArchive: () => callbacks.onArchiveScene(scene.id),
        onDelete: () => confirmDeleteScene(scene, callbacks.onDeleteScene),
        onAddGoal: callbacks.onAddGoal
          ? () => callbacks.onAddGoal!("scene", scene.id)
          : undefined,
      }),
    });
  }

  return { menu, setMenu, openMenu };
}

/** One scene row: status indicator + title + word count. Mutations via context menu. */
export function SceneRow({ scene, isSelected, onSelect, callbacks }: SceneRowProps) {
  const [editing, setEditing] = useState(false);
  const { menu, setMenu, openMenu } = useSceneMenu(scene, callbacks, () => setEditing(true));

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
        <SceneStatusIndicator status={scene.status} />
        {titleEl}
        <span className="scene-words">{wordCount}</span>
      </li>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </>
  );
}

// ── ChapterHeader ─────────────────────────────────────────────────────────

type ChapterFolder = BinderTree["chapters"][0]["folder"];

function useChapterMenu(
  folder: ChapterFolder,
  chapter: BinderTree["chapters"][0],
  callbacks: BinderCallbacks,
  onRename: () => void,
) {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const showToast = useBinderToast();

  function openMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({
      x: e.clientX, y: e.clientY,
      items: buildChapterMenu({
        onRename,
        onNewScene: () => callbacks.onCreateScene(folder.id),
        onExport: () => showToast("Export — coming in a later wave"),
        onArchive: () => callbacks.onArchiveChapter(folder.id),
        onDelete: () => confirmDeleteChapter(folder, callbacks.onDeleteChapter),
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
  const { menu, setMenu, openMenu, sceneCount } = useChapterMenu(
    chapter.folder, chapter, callbacks, () => setEditing(true),
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
    </>
  );
}
