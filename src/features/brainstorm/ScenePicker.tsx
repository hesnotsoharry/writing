/**
 * ScenePicker — floating scene-picker for the "Send to scene" flow.
 *
 * Visual language mirrors Phase 4's EntityPicker: floating popover,
 * search/filter input, list of items, close on outside click + Escape.
 * Rendered at the BoardCanvas level (outside the React Flow node tree) so
 * it is not affected by the canvas CSS transform when zoomed/panned.
 *
 * Only shown for TEXT cards (entity cards have no free text to send).
 */
import { useEffect, useRef, useState } from "react";

import type { BinderTree } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SceneRow {
  id: string;
  title: string;
  chapterTitle: string | null;
}

interface ScenePickerProps {
  tree: BinderTree;
  onPick: (sceneId: string) => void;
  onClose: () => void;
}

// ── ScenePickerList ───────────────────────────────────────────────────────────

function ScenePickerList({ rows, onPick }: { rows: SceneRow[]; onPick: (id: string) => void }) {
  if (rows.length === 0) {
    return <div className="board-scene-picker-empty">No scenes found.</div>;
  }
  return (
    <>
      {rows.map((s) => (
        <button key={s.id} type="button" className="board-scene-picker-row" onClick={() => onPick(s.id)}>
          <span className="board-scene-picker-title">{s.title || "Untitled"}</span>
          {s.chapterTitle && (
            <span className="board-scene-picker-chapter">{s.chapterTitle}</span>
          )}
        </button>
      ))}
    </>
  );
}

// ── ScenePicker ───────────────────────────────────────────────────────────────

export function ScenePicker({ tree, onPick, onClose }: ScenePickerProps) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  const allRows: SceneRow[] = [
    ...tree.chapters.flatMap((ch) =>
      ch.scenes.map((s) => ({ id: s.id, title: s.title, chapterTitle: ch.folder.title }))
    ),
    ...tree.shortPieces.map((s) => ({ id: s.id, title: s.title, chapterTitle: null })),
  ];
  const filtered = allRows.filter((s) => s.title.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={wrapRef} className="board-scene-picker">
      <div className="board-scene-picker-search">
        <Icon name="search" style={{ width: 13, height: 13, flexShrink: 0, color: "var(--ink-4)" }} />
        <input
          ref={inputRef}
          className="board-scene-picker-input"
          placeholder="Find scene…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        />
      </div>
      <div className="board-scene-picker-list">
        <ScenePickerList rows={filtered} onPick={onPick} />
      </div>
    </div>
  );
}
