/**
 * Canonical 5-value scene status model.
 *
 * The DB column is free-form TEXT (migration 5) — no CHECK constraint.
 * Legacy rows may contain "done" (the old 3-value union). Always read
 * DB values through `normalizeStatus` before consuming them.
 */

export type SceneStatus = "blank" | "outline" | "draft" | "revise" | "final";

export interface StatusMeta {
  id: SceneStatus;
  label: string;
  /** CSS color string for the status dot. Final renders a check icon instead. */
  dot: string;
  /** True only for "final" — consumers render a check icon, not a dot. */
  isFinal: boolean;
}

// Dot colors match design-reference/data.jsx STATUS_META exactly.
export const STATUS_META: Record<SceneStatus, StatusMeta> = {
  blank:   { id: "blank",   label: "To write",  dot: "var(--ink-4)",  isFinal: false },
  outline: { id: "outline", label: "Outlined",  dot: "var(--note)",   isFinal: false },
  draft:   { id: "draft",   label: "Drafting",  dot: "var(--accent)", isFinal: false },
  revise:  { id: "revise",  label: "Revising",  dot: "#6a86a8",       isFinal: false },
  final:   { id: "final",   label: "Final",     dot: "var(--good)",   isFinal: true  },
};

export const STATUS_ORDER: SceneStatus[] = [
  "blank",
  "outline",
  "draft",
  "revise",
  "final",
];

const VALID = new Set<string>(STATUS_ORDER);

/**
 * Map a raw DB string to a valid SceneStatus.
 * - Legacy "done" → "final"
 * - Any unrecognised value → "blank"
 */
export function normalizeStatus(raw: string): SceneStatus {
  if (raw === "done") return "final";
  if (VALID.has(raw)) return raw as SceneStatus;
  return "blank";
}
