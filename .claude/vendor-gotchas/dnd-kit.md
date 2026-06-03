# dnd-kit — multi-container sortable: canonical pattern + gotchas

> Audience: an AI agent implementing drag-and-drop reorder across multiple containers
> (e.g. items movable between lists/folders) with `@dnd-kit`. Distilled from a full
> build (writing app binder: scenes movable within/between chapters + a loose bucket).
> Every gotcha below was a real, smoke-only-reproducible bug. lastVerified: 2026-06-03.

## Versions (use the stable line, NOT the alpha)

- `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^8.0.0, `@dnd-kit/utilities` ^3.2.2.
- **Do NOT use `@dnd-kit/react` / `@dnd-kit/dom` / `@dnd-kit/helpers` 0.x** — that's the
  experimental rewrite. It is sparsely documented, was reverse-engineerable only from its
  bundle, and produced multiple structural drag bugs. The `core`+`sortable` line is the
  mature, React-19-compatible, canonically-documented API. Reference: the official
  "Multiple Containers" storybook example is the source of truth for the cross-container pattern.

## The one architectural rule: single source of truth

Maintain ONE optimistic order map during a drag and commit FROM it. Do not compute the
commit position a second, independent way.

- `onDragStart`: seed `liveItems = { ...committedItems }` (a `containerId -> orderedIds[]` map).
- `onDragOver`: mutate `liveItems` — the **atomic** move (remove from source + insert into dest
  in ONE `setState`), with the direction modifier:
  ```
  const isBelowOver = over && active.rect.current.translated &&
    active.rect.current.translated.top > over.rect.top + over.rect.height;
  const newIndex = overIndex >= 0 ? overIndex + (isBelowOver ? 1 : 0) : overIds.length;
  set(prev => ({
    ...prev,
    [src]:  prev[src].filter(id => id !== activeId),
    [dest]: [...prev[dest].slice(0,newIndex), activeId, ...prev[dest].slice(newIndex)],
  }));
  ```
- `onDragEnd`: read the final position straight from `liveItems` and persist it —
  `toIndex = liveItems[dest].indexOf(activeId)`; call your store with `(activeId, dest, toIndex)`.
  Do NOT recompute via `over.data.sortable.index` + `arrayMove` — that double-counts the
  displacement `onDragOver` already applied (classic off-by-one: "lands one row above the preview").
- Clear `liveItems` via DERIVED STATE when the committed prop updates after persistence
  (see gotcha 5), NOT synchronously in `onDragEnd`.

## Gotchas (each was a real bug)

1. **Off-by-one on drop = two sources of truth.** If the preview is correct mid-drag but the
   commit lands one slot off, you are committing via a recomputed index instead of reading the
   optimistic order. Fix: commit `liveItems[dest].indexOf(activeId)`. Your store's reorder helper
   should filter the moved id out then insert at `toIndex` — that makes the live-array index the
   correct insertion index for free.

2. **Snap-back flicker on release.** Items briefly revert to the old order on drop, then jump to
   the new one. Cause: rendering is gated on `activeId !== null`, which flips false the instant the
   drag ends — but persistence is async, so for one render the list shows committed (old) order.
   Fix: gate rendering on **`liveItems !== null` (an `isLive` flag), not `activeId`**. Keep the
   optimistic order on screen until the committed prop catches up.

3. **Rendered children must follow the same map as `SortableContext.items`.** If `items` follows
   `liveItems` but the actual rendered rows still map over committed data, the dragged element's
   DOM node never leaves its source container → dnd-kit measures its rect there → destination
   displacement overshoots (e.g. ~4 rows) AND the item ghosts in both containers. Fix: render the
   rows from `liveItems` too (build a flat `itemById` lookup; `liveIds.map(id => itemById[id])`).

4. **`closestCorners` mis-resolves at container boundaries.** It frequently picks a *container
   section* element instead of the item row under the cursor, so `over.data.sortable.containerId`
   comes back as the wrong (group) id and you write a bad destination. Fix: use the canonical custom
   collision strategy — `pointerWithin(args)` → fall back to `rectIntersection(args)` → if the hit
   is a container, drill into it with `closestCenter` restricted to that container's item ids — with
   a `lastOverId` ref and a `recentlyMovedToNewContainer` ref to smooth transient boundary flips.

5. **`DragOverlay` flies back to the source on drop.** The DEFAULT `dropAnimation` animates the
   overlay back to the dragged node's ORIGINAL DOM position — which, after a cross-container move,
   is the source container. Fix: `<DragOverlay dropAnimation={null}>`. Separately: **keep
   `<DragOverlay>` mounted even if you render `{null}` inside it** — its mere presence is what
   suppresses the follow-the-cursor transform on the real item and keeps it static in the list
   (useful if you want the in-place drop slot to be the prominent indicator and no floating box).

6. **Empty containers reject drops.** A container with zero items collapses to 0px height, so the
   cursor can't hit its droppable. Fix: `minHeight` on the element holding the `useDroppable`
   `setNodeRef`, and make sure that element renders unconditionally (not `items.length && <ul/>`).
   Also ensure the collision drill-down KEEPS the container id when it's empty (`if
   (containerItems.length > 0)` before drilling, else return the container).

7. **ID collision when a container is ALSO a draggable.** If a container (e.g. a chapter/folder
   row that is itself sortable, `data.type:"container-as-item"`) registers the SAME id as its inner
   item-droppable, then `over.data.current.type` is ambiguous for that id, and an EMPTY such
   container resolves `over` to the wrong element — so a `type`-based guard misfires and you can't
   drop into it (while a non-draggable bucket works fine — that asymmetry is the tell). Proper fix:
   give the inner item-droppable a DISTINCT id (`${containerId}-items`) and map it back in your
   `findContainer`. Workaround: relax the guard to allow the drop when the container is effectively
   empty. Prefer the distinct-id fix.

8. **Guard the destination before persisting.** If container resolution can ever return a non-real
   id (an auto-generated `SortableContext` id, a group id, `undefined`), and you write it as the
   item's parent, a downstream rebuild may silently DROP the item from the UI while it persists with
   a bad parent in storage — data corruption that looks like "the item vanished." Fix: validate the
   resolved destination is a real container key before committing (`dest in items`), and add a
   startup repair that nulls/relocates any orphaned parent ids. Always give each `SortableContext`
   an explicit `id={containerId}` (omitting it yields an unstable auto-id — a common source of this).

9. **Recover from a failed persistence write.** If the store write rejects and you only `doReload`
   on success, the optimistic `liveItems` never clears → UI stuck showing a move that didn't save.
   Fix: reload after EVERY attempt (success AND failure) so the UI rolls back to true state. Always
   strip any global drag affordance (cursor class, body class) on BOTH `onDragEnd` and `onDragCancel`.

10. **Cursor / affordance.** A per-row `cursor: grab` won't show `grabbing` during the drag because
    the overlay portal and child cursors override it. Fix: inject a global rule active during drag —
    `body.dragging, body.dragging * { cursor: grabbing !important }` — toggled by a body class on
    start/end/cancel.

## Process lesson (the meta-gotcha)

dnd-kit bugs are **runtime-visual**: type-check, lint, and unit tests all pass while the drag is
visibly broken, and reading the source repeatedly mis-predicts runtime behavior (collision
resolution, drop animation, rect measurement). Two things actually find the truth:
- **Instrument and watch the console**: log `over.id`, `over.data.current`, the resolved container,
  and the committed index at each decision point; reproduce ONE drag; read the real values.
- **A single sharp behavioral clue beats a code re-read** — e.g. "empty bucket works, empty folder
  doesn't" instantly localizes to the container-vs-draggable asymmetry (gotcha 7).
Verify version-exact API behavior (`dropAnimation` defaults, sensor specifics) against current docs,
not memory — defaults drift between versions.
