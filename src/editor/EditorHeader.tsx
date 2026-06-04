import { Icon } from "../components/Icon";
import type { SceneStatus } from "../lib/status";
import { STATUS_META } from "../lib/status";

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function StatusDisplay({ status }: { status: SceneStatus }) {
  const meta = STATUS_META[status];
  const color = meta.dot === "var(--ink-4)" ? "var(--ink-3)" : meta.dot;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color }}>
      {meta.isFinal
        ? <Icon name="check" style={{ width: 13, height: 13 }} />
        : <span style={{ width: 7, height: 7, borderRadius: "50%", background: meta.dot }} />}
      {meta.label}
    </span>
  );
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EditorHeader — renders the three canon header blocks above the prose editor.
 * Mirrors design-reference/canvas.jsx:63-79 (read-only status per Decision 2).
 */
export function EditorHeader({
  chapterTitle,
  title,
  status,
  words,
  characters,
  locations,
}: EditorHeaderProps) {
  return (
    <>
      <div className="scene-eyebrow">
        <span>{chapterTitle}</span>
        <span className="sep" />
        <StatusDisplay status={status} />
      </div>
      <h1 className="scene-h1">{title}</h1>
      <div className="scene-byline">
        <span>{words.toLocaleString()} words</span>
        <span className="dotsep" />
        <span>{characters} characters · {locations} locations present</span>
      </div>
    </>
  );
}
