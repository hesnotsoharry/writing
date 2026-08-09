/**
 * Canon context-menu builders for scene rows, chapter headers, and story-bible entity cards.
 *
 * Consumers pass callbacks; this module produces `MenuItem[]` arrays that
 * can be handed directly to `<ContextMenu menu={{ x, y, items }} />`.
 *
 * Export shape (coordination doc § "WAVE 17 — Foundation"):
 *   buildSceneMenu(cb)   — Rename / Set status… / Duplicate / Export / {sep} / Archive / Delete(danger)
 *   buildChapterMenu(cb) — Rename / New scene / {sep} / Export / Archive / {sep} / Delete(danger)
 *   buildEntityMenu(cb)  — Edit name / Open full entry (deferred no-op, Decision 3) / {sep} / Delete(danger)
 */

import type { MenuItem } from "./ContextMenu";

// ── Scene menu ────────────────────────────────────────────────────────────────

export type { SceneMenuCallbacks } from "../../binder/sceneActions";
export { buildSceneMenu } from "../../binder/sceneActions";

export interface ChapterMenuCallbacks {
  onRename: () => void;
  onNewScene: () => void;
  /** Pass () => showToast("Export — coming in a later wave") */
  onExport: () => void;
  onArchive: () => void;
  onDelete: () => void;
  /** Opens the Goals modal pre-scoped to this chapter. Optional — existing callers omit it. */
  onAddGoal?: () => void;
}

// ── Entity menu (story bible) ──────────────────────────────────────────────

export interface EntityMenuCallbacks {
  kind: string;
  onEditName: () => void;
  /** Edit the reserved role field (entity_fields key="role"). */
  onEditRole: () => void;
  onOpenFullEntry: () => void;
  onDelete: () => void;
}

export function buildEntityMenu(cb: EntityMenuCallbacks): MenuItem[] {
  return [
    { label: "Edit name",         onClick: cb.onEditName       },
    { label: "Edit role",         onClick: cb.onEditRole       },
    { label: "Open full entry",   onClick: cb.onOpenFullEntry  },
    { type: "sep"                                               },
    { label: `Delete ${cb.kind}`, danger: true, onClick: cb.onDelete },
  ];
}

// ── Chapter menu ──────────────────────────────────────────────────────────────

export function buildChapterMenu(cb: ChapterMenuCallbacks): MenuItem[] {
  const items: MenuItem[] = [
    { label: "Rename chapter",          onClick: cb.onRename   },
    { label: "New scene",               onClick: cb.onNewScene },
    { type: "sep"                                              },
    { label: "Export chapter…",    onClick: cb.onExport   },
    { label: "Archive chapter",         onClick: cb.onArchive  },
    { type: "sep"                                              },
    { label: "Delete chapter", danger: true, onClick: cb.onDelete },
  ];
  if (cb.onAddGoal !== undefined) {
    // Insert "Add goal…" after "New scene" (index 2, before the first sep).
    items.splice(2, 0, { label: "Add goal…", onClick: cb.onAddGoal });
  }
  return items;
}
