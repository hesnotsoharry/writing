import { StatusGlyph } from "../components/StatusGlyph";
import type { SceneStatus } from "../lib/status";
import { STATUS_META } from "../lib/status";

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

function StatusDisplay({ status }: { status: SceneStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: meta.dot }}>
      <StatusGlyph status={status} size={13} />
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
