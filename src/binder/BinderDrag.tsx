/**
 * Drag wrappers for binder items — @dnd-kit/core 6 + @dnd-kit/sortable 8.
 *
 * Multi-container sortable: DndContext wraps the tree; SortableContext regions for
 * chapters, each chapter's scenes, and short-pieces scenes. 5px pointer distance
 * separates click from drag.
 *
 * Cross-container live preview: BinderDragProvider maintains an optimistic liveItems
 * copy during a drag. onDragOver atomically removes the active id from the source
 * array and inserts it at the correct destination index (isBelowOverItem modifier).
 * SortableSceneList reads liveItems whenever a drag is active so the source removal
 * is reflected immediately — no ghost-in-both-containers.
 *
 * Collision detection: pointerWithin → rectIntersection with findContainer drill-down
 * suppresses the chapter-header transient collision (Symptom C). lastOverId ref and
 * recentlyMovedToNewContainer ref prevent re-collision thrash at container boundaries.
 *
 * Flicker-free dragEnd: derived-state pair (prevItems/setPrevItems) clears liveItems
 * when the committed items prop changes (DB write landed) — no bounce-back frame.
 */
import type {
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  getFirstCollision,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

import type { Scene } from "../db/binderStore";

// Inject a one-time global rule so `cursor: grabbing` wins over any per-element
// inline `cursor: grab` while a drag is active. The class is toggled in onDragStart
// and removed in onDragEnd / onDragCancel so the cursor resets reliably.
const _styleEl = document.createElement("style");
_styleEl.textContent = "body.binder-dragging,body.binder-dragging *{cursor:grabbing!important}";
document.head.appendChild(_styleEl);

export const CHAPTERS_GROUP = "chapters";
export const SHORT_PIECES_GROUP = "short-pieces";

export type ItemsMap = Record<string, string[]>;

export interface DragCallbacks {
  onMoveScene: (sceneId: string, toFolderId: string | null, toIndex: number) => void;
  onMoveFolder: (folderId: string, toIndex: number) => void;
}

// ---------------------------------------------------------------------------
// DragActiveContext — exposes activeId so SortableSceneList knows when to
// read liveItems vs the committed sceneIds prop.
// ---------------------------------------------------------------------------

export type SceneById = Record<string, Scene>;
export type FolderById = Record<string, string>;

interface DragActiveCtx { activeId: UniqueIdentifier | null; liveItems: ItemsMap; isLive: boolean; sceneById: SceneById; folderById: FolderById }
const DragActiveContext = createContext<DragActiveCtx>(
  { activeId: null, liveItems: {}, isLive: false, sceneById: {}, folderById: {} }
);

export function useDragActive(): DragActiveCtx {
  return useContext(DragActiveContext);
}

// commitChapterFromLive — mirrors commitSceneFromLive: reads toIndex directly from
// liveItems[CHAPTERS_GROUP] so the commit matches the preview exactly (no off-by-one).
function commitChapterFromLive(aid: string, effectiveItems: ItemsMap, callbacks: DragCallbacks): boolean {
  const order = effectiveItems[CHAPTERS_GROUP] ?? [];
  const toIndex = order.indexOf(aid);
  if (toIndex === -1) return false;
  callbacks.onMoveFolder(aid, toIndex);
  return true;
}

// ---------------------------------------------------------------------------
// findContainer — two-level map lookup for collision detection.
// Returns the container id that owns the given id, or null.
// A key in items is itself a container; otherwise scan each container's array.
// ---------------------------------------------------------------------------

function findContainer(id: UniqueIdentifier, items: ItemsMap): string | null {
  const idStr = String(id);
  if (idStr in items) return idStr;
  for (const [containerId, ids] of Object.entries(items)) {
    if (ids.includes(idStr)) return containerId;
  }
  return null;
}

// useCollisionDetection — custom strategy hook (fixes Symptom C).
// Owns lastOverId and recentlyMoved refs so the rule never sees external-ref mutation.
// Returns { collisionDetection, recentlyMovedRef } so BinderDragProvider can pass
// recentlyMovedRef to useDragHandlers for reset on dragEnd/dragCancel.

function useCollisionDetection(activeId: UniqueIdentifier | null, effectiveItems: ItemsMap
): { collisionDetection: CollisionDetection; recentlyMovedRef: React.MutableRefObject<boolean> } {
  const lastOverIdRef = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedRef = useRef<boolean>(false);

  const collisionDetection: CollisionDetection = useCallback((args) => {
    if (activeId !== null && String(activeId) in effectiveItems) {
      return closestCenter({ ...args, droppableContainers:
        args.droppableContainers.filter((c) => String(c.id) in effectiveItems) });
    }
    const hits = pointerWithin(args);
    const cols = hits.length > 0 ? hits : rectIntersection(args);
    let overId = getFirstCollision(cols, "id");
    if (overId !== null) {
      if (String(overId) in effectiveItems) {
        const inner = args.droppableContainers.filter(
          (c) => c.id !== overId && effectiveItems[String(overId)]?.includes(String(c.id))
        );
        if (inner.length > 0) {
          overId = getFirstCollision(closestCenter({ ...args, droppableContainers: inner }), "id") ?? overId;
        }
      }
      lastOverIdRef.current = overId;
      return [{ id: overId }];
    }
    if (recentlyMovedRef.current) lastOverIdRef.current = activeId;
    return lastOverIdRef.current !== null ? [{ id: lastOverIdRef.current }] : [];
  }, [activeId, effectiveItems]);

  return { collisionDetection, recentlyMovedRef };
}

// ---------------------------------------------------------------------------
// Atomic onDragOver — fixes Symptoms A & B.
// Single setLiveItems call: remove from source AND insert at destination.
// isBelowOverItem modifier gives correct index for reorder-down.
// ---------------------------------------------------------------------------

type SetLiveItems = React.Dispatch<React.SetStateAction<ItemsMap | null>>;

interface AtomicOverArgs { active: DragOverEvent["active"]; over: NonNullable<DragOverEvent["over"]>; overContainer: string; committedItems: ItemsMap }

// Returns true when a cross-container move occurred so the caller can set recentlyMovedRef.
function applyAtomicDragOver(args: AtomicOverArgs, src: string, set: SetLiveItems): boolean {
  const { active, over, overContainer, committedItems } = args;
  set((prev) => {
    const base = prev ?? { ...committedItems };
    const aid = String(active.id);
    const srcIds = (base[src] ?? []).filter((id) => id !== aid);
    const overIds = base[overContainer] ?? [];
    let overIndex = overIds.indexOf(String(over.id));
    if (overIndex === -1) overIndex = overIds.length;
    const translated = active.rect.current.translated;
    const isBelowOver = translated !== null && translated.top > over.rect.top + over.rect.height;
    const destIds = overIds.filter((id) => id !== aid);
    destIds.splice(overIndex + (isBelowOver ? 1 : 0), 0, aid);
    return { ...base, [src]: srcIds, [overContainer]: destIds };
  });
  return src !== overContainer;
}

// commitSceneFromLive — reads final position from effectiveItems (Fix 1: single source of truth).
// Returns false when the scene is not found (drop outside any valid container).
function commitSceneFromLive(aid: string, effectiveItems: ItemsMap, callbacks: DragCallbacks): boolean {
  const dest = Object.keys(effectiveItems).find(
    (k) => k !== CHAPTERS_GROUP && (effectiveItems[k] ?? []).includes(aid)
  ) ?? null;
  if (!dest) return false;
  callbacks.onMoveScene(aid, dest === SHORT_PIECES_GROUP ? null : dest, (effectiveItems[dest] ?? []).indexOf(aid));
  return true;
}

// isChapterHeaderHover — true only when over a chapter-type element that holds scenes
// other than the dragged one. folder.id is shared by the chapter sortable (type "chapter")
// and its droppable scene container (type "container"), so an empty chapter resolves `over`
// to the chapter-type element; we must not block that case.
function isChapterHeaderHover(overId: UniqueIdentifier, activeId: UniqueIdentifier, overType: unknown, items: ItemsMap): boolean {
  return overType === "chapter" && (items[String(overId)] ?? []).some((id) => id !== String(activeId));
}

interface HandlerDeps {
  committedItems: ItemsMap; effectiveItems: ItemsMap; setLiveItems: SetLiveItems;
  setActiveId: React.Dispatch<React.SetStateAction<UniqueIdentifier | null>>;
  srcContainerRef: React.MutableRefObject<string | null>;
  recentlyMovedRef: React.MutableRefObject<boolean>; callbacks: DragCallbacks;
}

function useDragHandlers(deps: HandlerDeps) {
  const { committedItems, effectiveItems, setLiveItems, setActiveId,
    srcContainerRef, recentlyMovedRef, callbacks } = deps;

  function onDragStart(event: DragStartEvent) {
    document.body.classList.add("binder-dragging");
    setActiveId(event.active.id);
    const data = event.active.data.current as Record<string, unknown> | undefined;
    setLiveItems({ ...committedItems });
    srcContainerRef.current = data?.type === "chapter"
      ? CHAPTERS_GROUP : String(data?.containerId ?? "");
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as Record<string, unknown> | undefined;
    // Chapter reorder: single-container move within CHAPTERS_GROUP.
    if (activeData?.type === "chapter") { applyAtomicDragOver({ active, over, overContainer: CHAPTERS_GROUP, committedItems }, CHAPTERS_GROUP, setLiveItems); return; }
    const overData = over.data.current as Record<string, unknown> | undefined;
    const overContainer = findContainer(over.id, effectiveItems);
    if (!overContainer || overContainer === CHAPTERS_GROUP) return;
    if (isChapterHeaderHover(over.id, active.id, overData?.type, effectiveItems)) return;
    const src = srcContainerRef.current ?? "";
    if (applyAtomicDragOver({ active, over, overContainer, committedItems }, src, setLiveItems)) recentlyMovedRef.current = true;
    srcContainerRef.current = overContainer;
  }

  function onDragEnd(event: DragEndEvent) {
    document.body.classList.remove("binder-dragging");
    setActiveId(null); srcContainerRef.current = null; recentlyMovedRef.current = false;
    const aid = String(event.active.id);
    const activeData = event.active.data.current as Record<string, unknown> | undefined;
    const commit = activeData?.type === "chapter" ? commitChapterFromLive : commitSceneFromLive;
    if (!commit(aid, effectiveItems, callbacks)) setLiveItems(null);
  }

  function onDragCancel() {
    document.body.classList.remove("binder-dragging");
    setActiveId(null); srcContainerRef.current = null; recentlyMovedRef.current = false;
    setLiveItems(null);
  }

  return { onDragStart, onDragOver, onDragEnd, onDragCancel };
}

// ---------------------------------------------------------------------------
// BinderDragProvider — root DndContext
// ---------------------------------------------------------------------------

interface ProviderProps { callbacks: DragCallbacks; items: ItemsMap; sceneById: SceneById; folderById: FolderById }

export function BinderDragProvider({ callbacks, items, sceneById, folderById, children }: PropsWithChildren<ProviderProps>) {
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [liveItems, setLiveItems] = useState<ItemsMap | null>(null);
  const [prevItems, setPrevItems] = useState<ItemsMap>(items);
  const srcContainerRef = useRef<string | null>(null);

  if (prevItems !== items) {
    setPrevItems(items);
    if (liveItems !== null) setLiveItems(null);
  }

  const effectiveItems = liveItems ?? items;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { collisionDetection, recentlyMovedRef } = useCollisionDetection(activeId, effectiveItems);

  const { onDragStart, onDragOver, onDragEnd, onDragCancel } = useDragHandlers({
    committedItems: items, effectiveItems, setLiveItems, setActiveId,
    srcContainerRef, recentlyMovedRef, callbacks,
  });

  return (
    <DragActiveContext value={{ activeId, liveItems: effectiveItems, isLive: liveItems !== null, sceneById, folderById }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        {children}
        {/* DragOverlay kept present (no content) so dnd-kit suppresses CSS transform
            on the active node — the in-place slot stays static in the list. */}
        <DragOverlay dropAnimation={null}>{null}</DragOverlay>
      </DndContext>
    </DragActiveContext>
  );
}

// ---------------------------------------------------------------------------
// SortableSceneList — reads liveItems when drag is active (fixes Symptom A source-ghost)
// ---------------------------------------------------------------------------

interface SortableSceneListProps {
  containerId: string;
  sceneIds: string[];
  children: React.ReactNode;
}

export function SortableSceneList({ containerId, sceneIds, children }: SortableSceneListProps) {
  const { setNodeRef } = useDroppable({ id: containerId, data: { type: "container", containerId } });
  const { isLive, liveItems } = useDragActive();
  // Gate on liveItems presence (isLive), not activeId. After dragEnd, activeId is null
  // but liveItems stays until the committed prop arrives — this keeps the optimistic
  // order on screen during the async store-write gap, preventing the snap-back flicker.
  const sortableIds = isLive ? (liveItems[containerId] ?? []) : sceneIds;
  // Collapse the drop-zone visually when empty and not in a live drag, so it
  // contributes no gap above the empty-state hint. The <ul> stays mounted so
  // useDroppable is always registered — avoids the race where onDragOver fires
  // before React flushes the mount on first isLive flip.
  const visuallyEmpty = sceneIds.length === 0 && !isLive;
  return (
    <SortableContext id={containerId} items={sortableIds} strategy={verticalListSortingStrategy}>
      <ul
        ref={setNodeRef}
        className={"scene-list" + (visuallyEmpty ? " scene-list--empty" : "")}
        style={{ listStyle: "none", minHeight: visuallyEmpty ? 0 : 40 }}
      >
        {children}
      </ul>
    </SortableContext>
  );
}

// ---------------------------------------------------------------------------
// SortableChapterList — SortableContext for chapter reorder
// ---------------------------------------------------------------------------

interface SortableChapterListProps { chapterIds: string[]; children: React.ReactNode }

export function SortableChapterList({ chapterIds, children }: SortableChapterListProps) {
  const { isLive, liveItems } = useDragActive();
  const sortableIds = isLive ? (liveItems[CHAPTERS_GROUP] ?? []) : chapterIds;
  return (
    <SortableContext id={CHAPTERS_GROUP} items={sortableIds} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

// ---------------------------------------------------------------------------
// useSortableScene / useSortableChapter hooks
// ---------------------------------------------------------------------------

// Prominent in-place drop-slot: paper-white lifted card at the projected landing position.
// Matches the visual weight the floating overlay had — paper surface, line border, elevation.
const dropSlot: React.CSSProperties = {
  background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-xs)",
  boxShadow: "var(--shadow-sm)",
};

export function useSortableScene(id: string, containerId: string) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id, data: { type: "scene", containerId } });
  const style: React.CSSProperties = {
    ...(isDragging ? dropSlot : {}), cursor: "grab", touchAction: "none",
    transform: CSS.Transform.toString(transform), transition,
  };
  return { ref: setNodeRef, style, attributes, listeners };
}

export function useSortableChapter(id: string) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id, data: { type: "chapter", containerId: CHAPTERS_GROUP } });
  // isDragging applies the slot treatment to the FULL chapter block (header + scene list).
  const style: React.CSSProperties = {
    marginBottom: 8, ...(isDragging ? dropSlot : {}),
    cursor: "grab", touchAction: "none",
    transform: CSS.Transform.toString(transform), transition,
  };
  return { ref: setNodeRef, style, attributes, listeners };
}
