/**
 * Pure gap-based integer sort_order helper.
 *
 * No Tauri, no React, no side effects. All ordering math lives here so
 * SqliteBinderStore and InMemoryBinderStore share the same algorithm.
 *
 * Strategy: renormalize the container to fresh gap-spaced values (1000, 2000, …)
 * after inserting at the target index. This is N small writes at single-user
 * scale and avoids the gap-exhaustion edge case entirely.
 *
 * `items` — the current container in sort_order order (ascending).
 * `toIndex` — 0-based target index for the item being moved.
 *
 * Returns an array of { id, sort_order } pairs for every item in the container,
 * ready to write as individual UPDATE statements.
 */
export interface SortOrderUpdate {
  id: string;
  sort_order: number;
}

/**
 * Compute new sort_orders for a container after moving `movedId` to `toIndex`.
 *
 * - `items`: ordered list of `{ id }` objects (already in sort_order order,
 *   movedId excluded if it came from a different container).
 * - `movedId`: the id being inserted.
 * - `toIndex`: 0-based position to insert at (clamped to valid range).
 *
 * Returns one `SortOrderUpdate` per item in the resulting container.
 */
export function computeReorder(
  items: { id: string }[],
  movedId: string,
  toIndex: number
): SortOrderUpdate[] {
  // Remove the moved item if already present (same-container reorder).
  const without = items.filter((x) => x.id !== movedId);
  // Insert at the target position (clamped).
  const clamped = Math.max(0, Math.min(toIndex, without.length));
  const reordered = [
    ...without.slice(0, clamped),
    { id: movedId },
    ...without.slice(clamped),
  ];
  // Assign gap-spaced sort_orders: 1000, 2000, …
  return reordered.map((item, i) => ({ id: item.id, sort_order: (i + 1) * 1000 }));
}
