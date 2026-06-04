/**
 * Editable — inline-editable text field.
 * Ported from design-reference/entry.jsx Editable.
 *
 * Click-to-edit; commit on blur / Enter (single-line); Esc cancels;
 * auto-grow textarea (multiline). Parent should remount via key when the
 * external value changes (same discipline as EntityRowNotes key={id}).
 */

import { useEffect, useRef, useState } from "react";

interface EditableProps {
  value: string;
  placeholder: string;
  multiline?: boolean;
  className?: string;
  onCommit: (value: string) => void;
}

function useEditFocus(editing: boolean, multiline: boolean) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    if ("setSelectionRange" in el) el.setSelectionRange(el.value.length, el.value.length);
    if (multiline && el instanceof HTMLTextAreaElement) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [editing, multiline]);
  return ref;
}

function EditArea({ draft, setDraft, commit, cancel }: {
  draft: string;
  setDraft: (s: string) => void;
  commit: () => void;
  cancel: () => void;
}) {
  const ref = useEditFocus(true, true);
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancel();
  }
  return (
    <textarea
      ref={ref as React.RefObject<HTMLTextAreaElement>}
      className="fe-edit-area"
      value={draft} rows={2}
      onChange={(e) => {
        setDraft(e.target.value);
        e.target.style.height = "auto";
        e.target.style.height = `${e.target.scrollHeight}px`;
      }}
      onBlur={commit} onKeyDown={handleKey}
    />
  );
}

function EditInput({ draft, setDraft, commit, cancel }: {
  draft: string;
  setDraft: (s: string) => void;
  commit: () => void;
  cancel: () => void;
}) {
  const ref = useEditFocus(true, false);
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") cancel();
    else if (e.key === "Enter") { e.preventDefault(); commit(); }
  }
  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      className="fe-edit-input"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={handleKey}
    />
  );
}

export function Editable({ value, placeholder, multiline = false, className, onCommit }: EditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value ?? "").trim()) onCommit(trimmed);
  }
  function cancel() { setDraft(value); setEditing(false); }

  if (editing && multiline) return <EditArea draft={draft} setDraft={setDraft} commit={commit} cancel={cancel} />;
  if (editing) return <EditInput draft={draft} setDraft={setDraft} commit={commit} cancel={cancel} />;
  return (
    <span className={`${className ?? ""} fe-editable`} onClick={() => setEditing(true)}>
      {value ? value : <span className="fe-placeholder">{placeholder}</span>}
    </span>
  );
}
