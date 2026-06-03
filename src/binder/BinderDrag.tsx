/**
 * Drag wrappers for binder items (Phase 4).
 *
 * Uses @dnd-kit/react useSortable with group-based multi-container support.
 * Scenes carry group = folderId | "short-pieces"; chapters carry group = "chapters".
 * A 5px pointer movement is required before a drag starts, so clicks still fire.
 *
 * handleDragEnd uses @dnd-kit/helpers move() to compute the post-drag order,
 * then derives the moved item's new group and index from that result.
 * This is robust to whether dnd-kit's source.index is pre- or post-removal.
 */
import type { DragEndEvent } from "@dnd-kit/dom";
import { PointerActivationConstraints, PointerSensor } from "@dnd-kit/dom";
import { move } from "@dnd-kit/helpers";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { isSortableOperation, useSortable } from "@dnd-kit/react/sortable";
import type { PropsWithChildren } from "react";

/** Group id used for the chapters container. */
export const CHAPTERS_GROUP = "chapters";
/** Group id used for the Short-pieces container. */
export const SHORT_PIECES_GROUP = "short-pieces";

const pointerSensorWithDistance = PointerSensor.configure({
  activationConstraints: [
    new PointerActivationConstraints.Distance({ value: 5 }),
  ],
});

/**
 * A flat map of group-id → ordered array of item ids.
 * chapters → folder ids; SHORT_PIECES_GROUP → scene ids; each folderId → scene ids.
 */
export type ItemsMap = Record<string, string[]>;

export interface DragCallbacks {
  onMoveScene: (sceneId: string, toFolderId: string | null, toIndex: number) => void;
  onMoveFolder: (folderId: string, toIndex: number) => void;
}

function findInMap(
  map: ItemsMap,
  id: string
): { group: string; index: number } | null {
  for (const [group, ids] of Object.entries(map)) {
    const idx = ids.indexOf(id);
    if (idx !== -1) return { group, index: idx };
  }
  return null;
}

function handleDragEnd(
  event: DragEndEvent,
  items: ItemsMap,
  callbacks: DragCallbacks
): void {
  const { operation, canceled } = event;
  if (canceled) return;
  if (!isSortableOperation(operation)) return;
  const { source } = operation;
  if (!source) return;

  const sourceId = String(source.id);
  const isChapter = source.group === CHAPTERS_GROUP || source.initialGroup === CHAPTERS_GROUP;

  // move() recomputes the full items map using the library's own index semantics.
  const next = move(items, event) as ItemsMap;
  const landed = findInMap(next, sourceId);
  if (!landed) return;

  if (isChapter) {
    callbacks.onMoveFolder(sourceId, landed.index);
  } else {
    const toFolderId =
      landed.group === SHORT_PIECES_GROUP ? null : landed.group;
    callbacks.onMoveScene(sourceId, toFolderId, landed.index);
  }
}

/** Root drag context. Wrap the binder tree in this. */
export function BinderDragProvider({
  callbacks,
  items,
  children,
}: PropsWithChildren<{ callbacks: DragCallbacks; items: ItemsMap }>) {
  return (
    <DragDropProvider
      sensors={[pointerSensorWithDistance]}
      onDragEnd={(event) => handleDragEnd(event, items, callbacks)}
    >
      {children}
    </DragDropProvider>
  );
}

/** Draggable wrapper for a scene row. */
export function useSortableScene(id: string, index: number, group: string) {
  return useSortable({ id, index, group });
}

/** Draggable wrapper for a chapter header. */
export function useSortableChapter(id: string, index: number) {
  return useSortable({ id, index, group: CHAPTERS_GROUP });
}

/**
 * Registers a container element as a droppable zone so that dragging onto
 * an empty container (no sortable children) is still handled.
 * id must match the group key used in ItemsMap (e.g. SHORT_PIECES_GROUP or folderId).
 */
export function useDroppableContainer(id: string) {
  return useDroppable({ id });
}
