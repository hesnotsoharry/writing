import { useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RenameInputProps {
  /** The initial value shown in the input. */
  value: string;
  /** Called with the committed (trimmed, falling back to original) value. */
  onCommit: (value: string) => void;
  /** Called when the user cancels via Escape. */
  onCancel: () => void;
}

// ── RenameInput ────────────────────────────────────────────────────────────

/**
 * Inline rename field. Autofocuses and selects all text on mount.
 * Enter commits; Escape cancels; blur also commits (same as source).
 */
export function RenameInput({ value, onCommit, onCancel }: RenameInputProps) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  // One-shot guard: commit and cancel are mutually exclusive. Escape fires
  // onCancel, but the resulting focus loss also fires onBlur — without this
  // guard a cancelled rename would commit. First handler to fire wins.
  const done = useRef(false);

  // Autofocus and select-all on mount.
  useEffect(() => {
    if (ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(v.trim() || value);
  };
  const cancel = () => {
    if (done.current) return;
    done.current = true;
    onCancel();
  };

  return (
    <input
      ref={ref}
      className="rename-input"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        else if (e.key === "Escape") cancel();
        e.stopPropagation();
      }}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    />
  );
}
