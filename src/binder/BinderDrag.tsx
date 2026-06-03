/**
 * Drag wrappers for binder items (Phase 4) — @dnd-kit/core 6 + @dnd-kit/sortable 8.
 *
 * Multi-container sortable pattern: DndContext wraps the tree; three SortableContext
 * regions (chapters list, each chapter's scene list, short-pieces scene list).
 * A 5px pointer distance separates a click from a drag intent.
 *
 * Index semantics for reorder-down: overIndex is the current position of the item
 * under the cursor; arrayMove(items, activeIndex, overIndex) handles the removal
 * offset correctly, and computeReorder receives the final 0-based destination index.
 */
import type { DragEndEvent, DragOverEvent, UniqueIdentifier } from "@dnd-kit/core";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PropsWithChildren } from "react";
import { useState } from "react";

/** Group id used for the chapters SortableContext. */
export const CHAPTERS_GROUP = "chapters";
/** Group id used for the Short-pieces SortableContext. */
export const SHORT_PIECES_GROUP = "short-pieces";

/**
 * A flat map of container-id → ordered array of item ids.
 * CHAPTERS_GROUP → folder ids; SHORT_PIECES_GROUP → scene ids; each folderId → scene ids.
 */
export type ItemsMap = Record<string, string[]>;

export interface DragCallbacks {
  onMoveScene: (sceneId: string, toFolderId: string | null, toIndex: number) => void;
  onMoveFolder: (folderId: string, toIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Index resolution helpers
// ---------------------------------------------------------------------------

type SortablePayload = { containerId: string; index: number };

function asSortable(data: Record<string, unknown> | undefined): SortablePayload | null {
  if (!data?.sortable) return null;
  const s = data.sortable as SortablePayload;
  return { containerId: String(s.containerId), index: Number(s.index) };
}

/**
 * Resolve destination container id from over's data or id.
 * Returns null when over does not correspond to a known container.
 */
function resolveDestContainer(
  overId: UniqueIdentifier,
  overData: Record<string, unknown> | undefined,
  items: ItemsMap
): string | null {
  const s = asSortable(overData);
  // If the over target's auto-injected sortable.containerId is CHAPTERS_GROUP, the
  // pointer landed on a chapter-section row (a chapter droppable), not on a scene.
  // In that case the over id is the folderId itself — use it as the container when
  // it exists as a key in items (i.e. it is a real per-folder scene container).
  const sortableContainerId = s?.containerId ?? null;
  const overIdStr = String(overId);
  const candidate =
    sortableContainerId !== null && sortableContainerId !== CHAPTERS_GROUP
      ? sortableContainerId
      : overIdStr in items
        ? overIdStr
        : null;
  const result = candidate !== null && candidate in items ? candidate : null;
  return result;
}

// ---------------------------------------------------------------------------
// resolveDragTarget — extracts destination from a DragEndEvent
// ---------------------------------------------------------------------------

interface DragTarget {
  activeId: string;
  isChapter: boolean;
  destContainerId: string;
  toIndex: number;
}

interface ReorderCtx {
  activeId: string;
  srcContainer: string;
  overIndex: number;
  containerItems: string[];
}

/** Compute final 0-based destination index, handling reorder-down correctly. */
function computeDestIndex(destContainer: string, ctx: ReorderCtx): number {
  if (ctx.srcContainer !== destContainer) return ctx.overIndex;
  const activeIdx = ctx.containerItems.indexOf(ctx.activeId);
  if (activeIdx === -1) return ctx.overIndex;
  return arrayMove(ctx.containerItems, activeIdx, ctx.overIndex).indexOf(ctx.activeId);
}

function resolveDragTarget(event: DragEndEvent, items: ItemsMap): DragTarget | null {
  const { active, over } = event;
  if (!over) return null;
  const activeData = active.data.current as Record<string, unknown> | undefined;
  const isChapter = activeData?.type === "chapter";
  const srcContainer = isChapter
    ? CHAPTERS_GROUP
    : String(activeData?.containerId ?? "");
  const overData = over.data.current as Record<string, unknown> | undefined;
  const destContainerId = resolveDestContainer(over.id, overData, items);
  if (!destContainerId) return null;
  const ctx: ReorderCtx = {
    activeId: String(active.id),
    srcContainer,
    overIndex: asSortable(overData)?.index ?? 0,
    containerItems: items[destContainerId] ?? [],
  };
  const toIndex = computeDestIndex(destContainerId, ctx);
  return { activeId: ctx.activeId, isChapter, destContainerId, toIndex };
}

// ---------------------------------------------------------------------------
// handleDragEnd — dispatches to store callbacks
// ---------------------------------------------------------------------------

function handleDragEnd(
  event: DragEndEvent,
  items: ItemsMap,
  callbacks: DragCallbacks
): void {
  const target = resolveDragTarget(event, items);
  if (!target) return;
  const { activeId, isChapter, destContainerId, toIndex } = target;
  if (isChapter) {
    callbacks.onMoveFolder(activeId, toIndex);
  } else {
    const toFolderId = destContainerId === SHORT_PIECES_GROUP ? null : destContainerId;
    callbacks.onMoveScene(activeId, toFolderId, toIndex);
  }
}

// ---------------------------------------------------------------------------
// BinderDragProvider — root DndContext with stable sensors
// ---------------------------------------------------------------------------

interface ProviderProps {
  callbacks: DragCallbacks;
  items: ItemsMap;
}

/** Root drag context. Wrap the binder tree in this. */
export function BinderDragProvider({
  callbacks,
  items,
  children,
}: PropsWithChildren<ProviderProps>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    handleDragEnd(event, items, callbacks);
  }

  function onDragOver(event: DragOverEvent) {
    setActiveId(event.active.id);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {children}
      <DragOverlay>{activeId ? <DragGhost /> : null}</DragOverlay>
    </DndContext>
  );
}

/** Minimal visual drag ghost for binder rows. */
function DragGhost() {
  return (
    <div style={{ height: 28, background: "#e8e8e8", borderRadius: 4, opacity: 0.8 }} />
  );
}

// ---------------------------------------------------------------------------
// SortableSceneList — SortableContext + droppable container for a scene list
// ---------------------------------------------------------------------------

interface SortableSceneListProps {
  containerId: string;
  sceneIds: string[];
  children: React.ReactNode;
}

/**
 * Wraps a scene list in a SortableContext and registers the container div as a
 * droppable zone so empty containers accept drops.
 */
export function SortableSceneList({
  containerId,
  sceneIds,
  children,
}: SortableSceneListProps) {
  const { setNodeRef } = useDroppable({
    id: containerId,
    data: { type: "container", containerId },
  });
  return (
    <SortableContext id={containerId} items={sceneIds} strategy={verticalListSortingStrategy}>
      <ul
        ref={setNodeRef}
        style={{ listStyle: "none", margin: 0, padding: 0, minHeight: 8 }}
      >
        {children}
      </ul>
    </SortableContext>
  );
}

// ---------------------------------------------------------------------------
// SortableChapterList — SortableContext for chapter reorder
// ---------------------------------------------------------------------------

interface SortableChapterListProps {
  chapterIds: string[];
  children: React.ReactNode;
}

/** Wraps the chapter list in a SortableContext for chapter reorder. */
export function SortableChapterList({
  chapterIds,
  children,
}: SortableChapterListProps) {
  return (
    <SortableContext
      id={CHAPTERS_GROUP}
      items={chapterIds}
      strategy={verticalListSortingStrategy}
    >
      {children}
    </SortableContext>
  );
}

// ---------------------------------------------------------------------------
// useSortableScene / useSortableChapter hooks
// ---------------------------------------------------------------------------

/** Returns sortable props for a scene row. containerId = folderId | SHORT_PIECES_GROUP. */
export function useSortableScene(id: string, containerId: string) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id, data: { type: "scene", containerId } });
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return { ref: setNodeRef, style, attributes, listeners };
}

/** Returns sortable props for a chapter section. */
export function useSortableChapter(id: string) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id, data: { type: "chapter", containerId: CHAPTERS_GROUP } });
  const style: React.CSSProperties = {
    marginBottom: 8,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return { ref: setNodeRef, style, attributes, listeners };
}
