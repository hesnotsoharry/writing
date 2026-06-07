/**
 * LabelBadges — small colored dot+name pills for a scene row.
 *
 * Used by OutlinerRow to display the labels assigned to a scene.
 * Colors come from `--label-*` CSS custom properties set in tokens.css.
 * Receives the resolved Label objects (not IDs) so the parent does the
 * join once at the Outliner level (avoids N per-row lookups).
 */
import type { Label } from "../../db/labelStore";

function solidVar(color: string): string {
  return `var(--label-${color})`;
}

interface LabelPillProps {
  label: Label;
}

function LabelPill({ label }: LabelPillProps) {
  return (
    <span
      className="lbl-pill"
      style={{
        background: `var(--label-${label.color}-tint)`,
        color: solidVar(label.color),
      }}
    >
      <span
        className="lbl-dot"
        style={{ background: solidVar(label.color) }}
      />
      {label.name}
    </span>
  );
}

interface LabelBadgesProps {
  labels: Label[];
}

/**
 * Renders a row of tinted label pills. Empty list renders nothing.
 */
export function LabelBadges({ labels }: LabelBadgesProps) {
  if (labels.length === 0) return null;
  return (
    <>
      {labels.map((l) => (
        <LabelPill key={l.id} label={l} />
      ))}
    </>
  );
}
