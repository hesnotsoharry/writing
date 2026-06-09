import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";
import { SqliteSceneDocStore } from "../../db/sqliteSceneDocStore";
import { QUICK_NOTES_CHANGED_EVENT } from "../../lib/settings";
import { promoteNoteToScene } from "../quickcapture/promoteNoteToScene";
import type { QuickNote, SqliteQuickNoteStore } from "../quickcapture/SqliteQuickNoteStore";
import { SqliteQuickNoteStore as DefaultStore } from "../quickcapture/SqliteQuickNoteStore";

// Module-level singletons for production wiring.
const defaultStore = new DefaultStore();
const binderStore = new SqliteBinderStore();
const sceneDocStore = new SqliteSceneDocStore();

/** Buckets a created_at epoch-ms timestamp into a human-readable relative string. */
function formatWhen(createdAtMs: number): string {
  const diffMs = Date.now() - createdAtMs;
  const diffS = Math.floor(diffMs / 1000);
  const diffM = Math.floor(diffS / 60);
  const diffH = Math.floor(diffM / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffS < 60) return "just now";
  if (diffM < 60) return `${diffM}m ago`;
  if (diffH < 24) return `${diffH}h ago`;
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(createdAtMs).toLocaleDateString();
}

interface NoteCardProps {
  note: QuickNote;
  onEdit: (id: string, body: string) => void;
  onPromote: (note: QuickNote) => void;
  onDelete: (id: string) => void;
}

// onCommit receives the committed string value, or null to signal "revert" (Escape).
function NoteCardTextarea({ val, setVal, onCommit }: {
  val: string; setVal: (v: string) => void; onCommit: (body: string | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef(false);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  function finish(commitValue: string | null) {
    if (doneRef.current) return;
    doneRef.current = true;
    onCommit(commitValue);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { finish(null); }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { finish(val); }
  }

  return (
    <textarea ref={ref} value={val} onChange={(e) => setVal(e.target.value)}
      onKeyDown={handleKeyDown} onBlur={() => finish(val)}
      style={{
        width: "100%", border: "none", outline: "none", resize: "vertical",
        background: "transparent", fontFamily: "var(--font-prose)", fontSize: 15,
        lineHeight: 1.5, color: "var(--ink)", minHeight: 48,
      }} />
  );
}

function NoteCardActions({ note, onPromote, onDelete }: Pick<NoteCardProps, "note" | "onPromote" | "onDelete">) {
  return (
    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
      <button className="iconbtn" title="Promote to scene" type="button" onClick={() => onPromote(note)}>
        <Icon name="arrowRight" className="ic" style={{ width: 15, height: 15 }} />
      </button>
      <button className="iconbtn" title="Delete note" type="button" onClick={() => onDelete(note.id)}>
        <Icon name="trash" className="ic" style={{ width: 15, height: 15, color: "var(--danger)" }} />
      </button>
    </div>
  );
}

function NoteCard({ note, onEdit, onPromote, onDelete }: NoteCardProps) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(note.body);

  // null means "revert" (Escape pressed); string means "commit this value".
  function commit(body: string | null) {
    if (body !== null) {
      const trimmed = body.trim();
      if (trimmed && trimmed !== note.body) onEdit(note.id, trimmed);
      else setVal(note.body);
    } else {
      setVal(note.body);
    }
    setEditing(false);
  }

  return (
    <div style={{
      border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px",
      background: "var(--paper)", display: "flex", gap: 12, alignItems: "flex-start",
      transition: "border-color .12s", borderColor: editing ? "var(--accent)" : "var(--line)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <NoteCardTextarea val={val} setVal={setVal} onCommit={commit} />
        ) : (
          <div onClick={() => setEditing(true)} title="Click to edit"
            style={{ fontFamily: "var(--font-prose)", fontSize: 15, lineHeight: 1.5, color: "var(--ink)", cursor: "text" }}>
            {note.body}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="clock" style={{ width: 11, height: 11 }} />
          {formatWhen(note.created_at)}{editing ? " · editing — ⌘↵ to save" : ""}
        </div>
      </div>
      <NoteCardActions note={note} onPromote={onPromote} onDelete={onDelete} />
    </div>
  );
}

interface InboxProps {
  onClose: () => void;
  activeProjectId: string | null;
  setHasQuickItems: Dispatch<SetStateAction<boolean>>;
  store?: Pick<SqliteQuickNoteStore, "listUnfiled" | "updateBody" | "delete" | "markFiled">;
  promote?: (note: QuickNote) => Promise<void>;
}

interface UseInboxNotesArgs {
  activeProjectId: string | null;
  setHasQuickItems: Dispatch<SetStateAction<boolean>>;
  store: Pick<SqliteQuickNoteStore, "listUnfiled" | "updateBody" | "delete" | "markFiled">;
  effectivePromote: (note: QuickNote) => Promise<void>;
}

function useInboxNotes({ activeProjectId, setHasQuickItems, store, effectivePromote }: UseInboxNotesArgs) {
  // null = not yet loaded; [] = loaded, empty; [...] = loaded with notes.
  const [notes, setNotes] = useState<QuickNote[] | null>(null);

  useEffect(() => {
    if (activeProjectId === null) return;
    let cancelled = false;
    store.listUnfiled(activeProjectId).then((rows) => {
      if (!cancelled) setNotes(rows);
    }).catch((e) => console.error("[inbox] listUnfiled failed", e));
    return () => { cancelled = true; };
  }, [activeProjectId, store]);

  async function handleEdit(id: string, body: string) {
    try {
      await store.updateBody(id, body);
      setNotes((prev) => (prev ?? []).map((n) => n.id === id ? { ...n, body } : n));
    } catch (e) { console.error("[inbox] updateBody failed", e); }
  }

  async function handleDelete(id: string) {
    try {
      await store.delete(id);
      setNotes((prev) => {
        const remaining = (prev ?? []).filter((n) => n.id !== id);
        setHasQuickItems(remaining.length > 0);
        return remaining;
      });
      window.dispatchEvent(new CustomEvent(QUICK_NOTES_CHANGED_EVENT));
    } catch (e) { console.error("[inbox] delete failed", e); }
  }

  async function handlePromote(note: QuickNote) {
    try {
      await effectivePromote(note);
      setNotes((prev) => {
        const remaining = (prev ?? []).filter((n) => n.id !== note.id);
        setHasQuickItems(remaining.length > 0);
        return remaining;
      });
      window.dispatchEvent(new CustomEvent(QUICK_NOTES_CHANGED_EVENT));
    } catch (e) { console.error("[inbox] promote failed", e); }
  }

  return { notes, handleEdit, handleDelete, handlePromote };
}

export function Inbox({ onClose, activeProjectId, setHasQuickItems, store = defaultStore, promote }: InboxProps) {
  // Default promote: real orchestration. Promote does NOT live-refresh the binder tree
  // (the new scene appears on next project load) — setTree lives in the frozen App.tsx.
  const effectivePromote = promote ?? ((note: QuickNote) => {
    if (activeProjectId === null) return Promise.resolve();
    return promoteNoteToScene(
      { binderStore, sceneDocStore, quickNoteStore: store },
      { note, projectId: activeProjectId }
    ).then(() => undefined);
  });

  const { notes, handleEdit, handleDelete, handlePromote } = useInboxNotes({
    activeProjectId, setHasQuickItems, store, effectivePromote,
  });

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="inbox" className="ic" />Quick notes</div>
            <div className="sheet-sub">Click any note to edit · promote into a scene or delete</div>
          </div>
          <button className="iconbtn sheet-x" type="button" onClick={onClose}>
            <Icon name="x" className="ic" />
          </button>
        </div>
        <div className="sheet-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes !== null && notes.length === 0 && (
            <div className="empty-hint" style={{ textAlign: "center", padding: 28 }}>
              Inbox is empty. Capture a thought with ⌘K.
            </div>
          )}
          {(notes ?? []).map((n) => (
            <NoteCard key={n.id} note={n} onEdit={handleEdit} onPromote={handlePromote} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
}
