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

import type { SceneStatus } from "../../lib/status";
import { STATUS_META, STATUS_ORDER } from "../../lib/status";
import type { MenuItem } from "./ContextMenu";

// ── Scene menu ────────────────────────────────────────────────────────────────

export interface SceneMenuCallbacks {
  onRename: () => void;
  currentStatus: SceneStatus;
  onSetStatus: (s: SceneStatus) => void;
  onDuplicate: () => void;
  /** Pass () => showToast("Export — coming in a later wave") */
  onExport: () => void;
  onArchive: () => void;
  onDelete: () => void;
  /** Opens the Goals modal pre-scoped to this scene. Optional — existing callers omit it. */
  onAddGoal?: () => void;
}

export function buildSceneMenu(cb: SceneMenuCallbacks): MenuItem[] {
  const statusSubmenu: MenuItem[] = STATUS_ORDER.map((s) => ({
    label: STATUS_META[s].label,
    swatch: STATUS_META[s].dot,
    tick: s === cb.currentStatus,
    onClick: () => cb.onSetStatus(s),
  }));

  const items: MenuItem[] = [
    { label: "Rename",           onClick: cb.onRename    },
    { label: "Set status",       submenu: statusSubmenu  },
    { label: "Duplicate",        onClick: cb.onDuplicate },
    { label: "Export scene…", onClick: cb.onExport  },
    { type: "sep"                                        },
    { label: "Archive",          onClick: cb.onArchive   },
    { label: "Delete",           danger: true, onClick: cb.onDelete },
  ];
  if (cb.onAddGoal !== undefined) {
    items.splice(4, 0, { label: "Add goal…", onClick: cb.onAddGoal });
  }
  return items;
}

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
  kind: "Character" | "Location";
  onEditName: () => void;
  /** "Open full entry" — deferred no-op per Decision 3; Lane 24 wires the real handler. */
  onOpenFullEntry: () => void;
  onDelete: () => void;
}

export function buildEntityMenu(cb: EntityMenuCallbacks): MenuItem[] {
  return [
    { label: "Edit name",         onClick: cb.onEditName       },
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
