/**
 * Shared status-picker item builder.
 *
 * Produces a `MenuItem[]` list (one entry per STATUS_ORDER value) for use
 * with `<ContextMenu>` in both the Binder dot-click and Outliner dot-click
 * pickers. Mirrors the shape of the status submenu in sceneMenu.ts.
 */
import type { IconName } from "../components/Icon";
import type { MenuItem } from "../components/menu/ContextMenu";
import type { SceneStatus } from "../lib/status";
import { STATUS_META, STATUS_ORDER } from "../lib/status";

/**
 * Build a flat list of status items suitable for a ContextMenu.
 *
 * @param current - The scene's current status (tick is shown on this item).
 * @param onPick  - Called with the chosen status when the user clicks an item.
 */
export function buildStatusItems(
  current: SceneStatus,
  onPick: (s: SceneStatus) => void,
): MenuItem[] {
  return STATUS_ORDER.map((s) => ({
    label: STATUS_META[s].label,
    icon: STATUS_META[s].icon as IconName,
    tick: s === current,
    onClick: () => onPick(s),
  }));
}
