import { useRef, useState } from "react";

import { buildStatusItems } from "../binder/statusPicker";
import { ContextMenu, type MenuDescriptor } from "../components/menu/ContextMenu";
import { StatusGlyph } from "../components/StatusGlyph";
import type { SceneStatus } from "../lib/status";
import { STATUS_META } from "../lib/status";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDisplay({ status, onClick }: {
  status: SceneStatus;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 6, color: meta.dot, cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      <StatusGlyph status={status} size={13} />
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Title-edit hook (mirrors InlineRename commit/cancel logic, h1-scoped)
// ---------------------------------------------------------------------------

function useTitleEdit(title: string, onRenameTitle?: (t: string) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const doneRef = useRef(false);
  function begin() { doneRef.current = false; setDraft(title); setEditing(true); }
  function commit() {
    if (doneRef.current) return;
    doneRef.current = true;
    const t = draft.trim();
    if (t) onRenameTitle?.(t);
    setEditing(false);
  }
  function cancel() {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }
  return { editing, draft, setDraft, begin, commit, onKeyDown };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorHeaderProps {
  chapterTitle: string;
  title: string;
  status: SceneStatus;
  words: number;
  characters: number;
  locations: number;
  /** Called with the new title when the user commits an inline rename. No-op when absent. */
  onRenameTitle?: (title: string) => void;
  /** Called with the chosen status when the user picks from the inline status picker. No-op when absent. */
  onSetStatus?: (status: SceneStatus) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EditorHeader — three canon header blocks above the prose editor.
 * W53 P1: title is inline-editable on click; status badge opens the shared picker.
 * Both new props are optional — the header degrades gracefully when absent.
 */
export function EditorHeader({
  chapterTitle, title, status, words, characters, locations,
  onRenameTitle, onSetStatus,
}: EditorHeaderProps) {
  const { editing, draft, setDraft, begin, commit, onKeyDown } = useTitleEdit(title, onRenameTitle);
  const [statusMenu, setStatusMenu] = useState<MenuDescriptor | null>(null);
  function handleStatusClick(e: React.MouseEvent<HTMLSpanElement>) {
    e.stopPropagation();
    setStatusMenu({
      x: e.clientX, y: e.clientY,
      items: buildStatusItems(status, (s) => { onSetStatus?.(s); setStatusMenu(null); }),
    });
  }
  return (
    <>
      <div className="scene-eyebrow">
        <span>{chapterTitle}</span>
        <span className="sep" />
        <StatusDisplay status={status} onClick={onSetStatus ? handleStatusClick : undefined} />
      </div>
      {editing ? (
        <input autoFocus className="scene-h1" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown} onBlur={commit} />
      ) : (
        <h1 className="scene-h1" onClick={onRenameTitle ? begin : undefined}
          style={onRenameTitle ? { cursor: "text" } : undefined}>{title}</h1>
      )}
      <div className="scene-byline">
        <span>{words.toLocaleString()} words</span>
        <span className="dotsep" />
        <span>{characters} characters · {locations} locations present</span>
      </div>
      {statusMenu && <ContextMenu menu={statusMenu} onClose={() => setStatusMenu(null)} />}
    </>
  );
}
