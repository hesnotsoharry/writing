import type { SceneStatus } from "../lib/status";
import { STATUS_META, STATUS_ORDER } from "../lib/status";

export type SceneAction =
  | { type: "sep" }
  | {
      type?: never;
      label: string;
      swatch?: string;
      tick?: boolean;
      danger?: boolean;
      onClick?: () => void;
      submenu?: SceneAction[];
    };

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
  /** Take a named snapshot of the scene. Optional — existing callers omit it. */
  onTakeSnapshot?: () => void;
  /** Open the Version History overlay for the scene. Optional — existing callers omit it. */
  onOpenHistory?: () => void;
}

export function buildSceneMenu(cb: SceneMenuCallbacks): SceneAction[] {
  const statusSubmenu: SceneAction[] = STATUS_ORDER.map((s) => ({
    label: STATUS_META[s].label,
    swatch: STATUS_META[s].dot,
    tick: s === cb.currentStatus,
    onClick: () => cb.onSetStatus(s),
  }));

  const items: SceneAction[] = [
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
  // Version history items: insert a sep + Take snapshot + Version history…
  // before the existing sep (which is now at index 4 or 5 depending on onAddGoal).
  // Simplest: append after Export scene…, before the sep block.
  if (cb.onTakeSnapshot !== undefined || cb.onOpenHistory !== undefined) {
    // Find the first sep index to insert before it.
    const sepIdx = items.findIndex((it) => it.type === "sep");
    const historyItems: SceneAction[] = [];
    if (cb.onTakeSnapshot !== undefined) {
      historyItems.push({ label: "Take snapshot", onClick: cb.onTakeSnapshot });
    }
    if (cb.onOpenHistory !== undefined) {
      historyItems.push({ label: "Version history…", onClick: cb.onOpenHistory });
    }
    items.splice(sepIdx, 0, ...historyItems);
  }
  return items;
}


