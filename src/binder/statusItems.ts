/**
 * Shared status-picker item builder.
 *
 * Produces a `MenuItem[]` list (one entry per STATUS_ORDER value) for use
 * with `<ContextMenu>` in both the Binder dot-click and Outliner dot-click
 * pickers. Mirrors the shape of the status submenu in sceneMenu.ts.
 */
import type { IconName } from "../components/iconPaths";
import type { SceneStatus } from "../lib/status";
import { STATUS_META, STATUS_ORDER } from "../lib/status";

export interface StatusAction {
  label: string;
  icon: IconName;
  iconColor: string;
  tick: boolean;
  onClick: () => void;
}

/**
 * Build a flat list of status items suitable for a ContextMenu.
 *
 * @param current - The scene's current status (tick is shown on this item).
 * @param onPick  - Called with the chosen status when the user clicks an item.
 */
export function buildStatusItems(
  current: SceneStatus,
  onPick: (s: SceneStatus) => void,
): StatusAction[] {
  return STATUS_ORDER.map((s) => ({
    label: STATUS_META[s].label,
    icon: STATUS_META[s].icon as IconName,
    iconColor: STATUS_META[s].dot,
    tick: s === current,
    onClick: () => onPick(s),
  }));
}
