/**
 * OutlinerDrag — drag-reorder wrappers for the Outliner table view.
 *
 * Mirrors CorkGroupDnd (Corkboard.tsx): per-group DndContext + SortableContext,
 * optimistic liveIds + onDragOver arrayMove, render-phase clear guard.
 *
 * Handle-only drag: useSortableOutlinerRow returns { setNodeRef, style, handleProps }
 * where handleProps is spread onto the .otl-handle element only — the title click
 * and synopsis contentEditable are unaffected.
 *
 * Gating (manual-sort + onMoveScene provided) is the caller's responsibility
 * (OutlinerBody only mounts OutlinerGroupDnd when the gate is open).
 */
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

import type { Scene } from "../../db/binderStore";

// ── computeDragReorder ────────────────────────────────────────────────────────

/**
 * Pure reorder helper — no React deps, the unit-test seam.
 *
 * Returns the reordered id list and the landed index of activeId.
 * Graceful: returns original list unchanged when either id is absent or equal.
 */
export function computeDragReorder(
  ids: string[],
  activeId: string,
  overId: string,
): { ids: string[]; toIndex: number } {
  const ai = ids.indexOf(activeId);
  const oi = ids.indexOf(overId);
  if (ai === -1 || oi === -1 || ai === oi) {
    return { ids: [...ids], toIndex: Math.max(0, ai) };
  }
  const reordered = arrayMove(ids, ai, oi);
  return { ids: reordered, toIndex: oi };
}

// ── useSortableOutlinerRow ────────────────────────────────────────────────────

/**
 * Props to spread on the drag HANDLE element only (not the row container).
 * Typed as React.HTMLAttributes for safe JSX spreading.
 */
export interface HandleProps {
  handleListeners: React.HTMLAttributes<HTMLElement> | undefined;
  handleAttributes: React.HTMLAttributes<HTMLElement> | undefined;
}

export interface SortableRowResult {
  setNodeRef: (el: HTMLElement | null) => void;
  style: React.CSSProperties;
  handleProps: HandleProps;
}

/**
 * Per-row hook for handle-only drag.
 * Must be called inside a mounted OutlinerGroupDnd (DndContext + SortableContext).
 *
 * Spread handleProps on the handle cell; apply setNodeRef + style to the row div.
 */
export function useSortableOutlinerRow(id: string): SortableRowResult {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };
  return {
    setNodeRef,
    style,
    handleProps: {
      handleListeners: listeners as React.HTMLAttributes<HTMLElement> | undefined,
      handleAttributes: attributes as unknown as React.HTMLAttributes<HTMLElement>,
    },
  };
}

// ── useOutlinerGroupHandlers ──────────────────────────────────────────────────

interface GroupHandlerArgs {
  ids: string[];
  folderId: string | null;
  onMoveScene: (id: string, toFolderId: string | null, toIndex: number) => void;
  liveIds: string[] | null;
  setLiveIds: React.Dispatch<React.SetStateAction<string[] | null>>;
}

function useOutlinerGroupHandlers(a: GroupHandlerArgs) {
  const { ids, folderId, onMoveScene, liveIds, setLiveIds } = a;

  function onDragStart() { setLiveIds(ids); }

  function onDragOver(e: DragOverEvent) {
    if (!e.over) return;
    const overId = String(e.over.id);
    setLiveIds((prev) => {
      const cur = prev ?? ids;
      const { ids: next } = computeDragReorder(cur, String(e.active.id), overId);
      return next.join(",") === cur.join(",") ? prev : next;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const aid = String(event.active.id);
    const final = liveIds ?? ids;
    if (!liveIds || final.join() === ids.join()) { setLiveIds(null); return; }
    const toIndex = final.indexOf(aid);
    if (toIndex === -1) { setLiveIds(null); return; }
    onMoveScene(aid, folderId, toIndex);
  }

  function onDragCancel() { setLiveIds(null); }

  return { onDragStart, onDragOver, onDragEnd, onDragCancel, sortedIds: liveIds ?? ids };
}

// ── OutlinerGroupDnd ──────────────────────────────────────────────────────────

export interface OutlinerGroupDndProps {
  folderId: string | null;
  scenes: Scene[];
  onMoveScene: (id: string, toFolderId: string | null, toIndex: number) => void;
  children: (sortedScenes: Scene[]) => React.ReactNode;
}

/**
 * DnD wrapper for one chapter / short-pieces group in the Outliner.
 * One DndContext per group keeps reorder contained to that group.
 *
 * Uses verticalListSortingStrategy (list/table layout, not grid).
 * Chapter headers (.otl-chrow) live outside this component — the caller renders
 * them before the OutlinerGroupDnd so they're outside the sortable region.
 */
export function OutlinerGroupDnd(
  { folderId, scenes, onMoveScene, children }: OutlinerGroupDndProps,
) {
  const [liveIds, setLiveIds] = useState<string[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const ids = scenes.map((s) => s.id);

  // Render-phase clear guard — retire optimistic order once committed scenes match.
  if (liveIds !== null && liveIds.join(",") === ids.join(",")) {
    setLiveIds(null);
  }

  const { onDragStart, onDragOver, onDragEnd, onDragCancel, sortedIds } =
    useOutlinerGroupHandlers({ ids, folderId, onMoveScene, liveIds, setLiveIds });

  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  const sortedScenes = sortedIds.map((id) => byId[id]).filter(Boolean) as Scene[];

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        {children(sortedScenes)}
      </SortableContext>
    </DndContext>
  );
}
