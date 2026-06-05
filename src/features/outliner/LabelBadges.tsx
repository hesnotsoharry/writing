/**
 * LabelBadges — small colored dot+name pills for a scene row.
 *
 * Used by OutlinerRow to display the labels assigned to a scene.
 * Colors come from `--label-*` CSS custom properties set in tokens.css.
 * Receives the resolved Label objects (not IDs) so the parent does the
 * join once at the Outliner level (avoids N per-row lookups).
 */
import type { Label } from "../../db/labelStore";

/** Returns a CSS `color-mix` tint at 16% opacity over transparent. */
function tintVar(color: string): string {
  return `color-mix(in srgb, var(--label-${color}) 16%, transparent)`;
}

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
        background: tintVar(label.color),
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
