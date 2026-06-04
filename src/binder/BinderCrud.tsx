/**
 * CRUD affordance components for the Binder (Phase 2).
 *
 * Kept in a separate file so Binder.tsx stays under the 300-line ESLint limit.
 * All components here are pure presentational; state is strictly local (inline
 * rename) or lifted to App via callbacks.
 */
import { useRef, useState } from "react";

import type { Scene } from "../db/binderStore";
import type { BinderTree } from "./buildTree";

/** All CRUD callbacks threaded from App → Binder → sub-components. */
export interface BinderCallbacks {
  onCreateChapter: () => void;
  onCreateScene: (folderId: string | null) => void;
  onRenameFolder: (id: string, title: string) => void;
  onRenameScene: (id: string, title: string) => void;
  onDeleteChapter: (id: string) => void;
  onDeleteScene: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

export const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  color: "var(--ink-3)",
  padding: "0 3px",
  lineHeight: 1,
  flexShrink: 0,
};

// ---------------------------------------------------------------------------
// InlineRename
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SceneDisplay
// ---------------------------------------------------------------------------

interface SceneDisplayProps {
  scene: Scene;
  isSelected: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onDeleteScene: (id: string) => void;
}

function confirmDeleteScene(scene: Scene, onDeleteScene: (id: string) => void) {
  if (window.confirm(`Delete scene "${scene.title}"?`)) onDeleteScene(scene.id);
}

function SceneDisplay({ scene, isSelected, onSelect, onStartEdit, onDeleteScene }: SceneDisplayProps) {
  return (
    <li className={"scene-row" + (isSelected ? " active" : "")}>
      <button onClick={onSelect} className="scene-title">{scene.title}</button>
      <button title="Rename scene" onClick={onStartEdit} style={iconBtnStyle}>✎</button>
      <button
        title="Delete scene"
        onClick={() => confirmDeleteScene(scene, onDeleteScene)}
        style={{ ...iconBtnStyle, marginRight: 4 }}
      >×</button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// SceneRow
// ---------------------------------------------------------------------------

interface SceneRowProps {
  scene: Scene;
  isSelected: boolean;
  onSelect: () => void;
  onRenameScene: (id: string, title: string) => void;
  onDeleteScene: (id: string) => void;
}

/** One scene row: select button + ✎ rename toggle + × delete. */
export function SceneRow({ scene, isSelected, onSelect, onRenameScene, onDeleteScene }: SceneRowProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li style={{ padding: "2px 16px 2px 28px" }}>
        <InlineRename
          current={scene.title}
          onCommit={(title) => { onRenameScene(scene.id, title); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <SceneDisplay
      scene={scene}
      isSelected={isSelected}
      onSelect={onSelect}
      onStartEdit={() => setEditing(true)}
      onDeleteScene={onDeleteScene}
    />
  );
}

// ---------------------------------------------------------------------------
// ChapterDisplay
// ---------------------------------------------------------------------------

interface ChapterDisplayProps {
  folder: BinderTree["chapters"][0]["folder"];
  onStartEdit: () => void;
  onCreateScene: (folderId: string) => void;
  onDeleteChapter: (id: string) => void;
}

function confirmDeleteChapter(
  folder: BinderTree["chapters"][0]["folder"],
  onDeleteChapter: (id: string) => void
) {
  if (window.confirm(`Delete chapter "${folder.title}"? Its scenes will move to Short pieces.`)) {
    onDeleteChapter(folder.id);
  }
}

function ChapterDisplay({ folder, onStartEdit, onCreateScene, onDeleteChapter }: ChapterDisplayProps) {
  return (
    <div className="chapter-row">
      <span className="ch-title">{folder.title}</span>
      <button title="Rename chapter" onClick={onStartEdit} style={iconBtnStyle}>✎</button>
      <button title="Add scene" onClick={() => onCreateScene(folder.id)} style={iconBtnStyle}>+</button>
      <button
        title="Delete chapter"
        onClick={() => confirmDeleteChapter(folder, onDeleteChapter)}
        style={{ ...iconBtnStyle, marginRight: 4 }}
      >×</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterHeader
// ---------------------------------------------------------------------------

interface ChapterHeaderProps {
  chapter: BinderTree["chapters"][0];
  callbacks: BinderCallbacks;
}

/** Chapter heading row: rename affordance + add-scene + delete-chapter controls. */
export function ChapterHeader({ chapter, callbacks }: ChapterHeaderProps) {
  const [editing, setEditing] = useState(false);
  const { folder } = chapter;

  if (editing) {
    return (
      <div style={{ padding: "2px 16px" }}>
        <InlineRename
          current={folder.title}
          onCommit={(title) => { callbacks.onRenameFolder(folder.id, title); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }
  return (
    <ChapterDisplay
      folder={folder}
      onStartEdit={() => setEditing(true)}
      onCreateScene={(folderId) => callbacks.onCreateScene(folderId)}
      onDeleteChapter={(id) => callbacks.onDeleteChapter(id)}
    />
  );
}
