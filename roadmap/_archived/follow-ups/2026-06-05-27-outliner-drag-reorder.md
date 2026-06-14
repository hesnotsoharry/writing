---
status: RESOLVED
resolved-during: followups-ui-batch
created: 2026-06-05
updated: 2026-06-13
source: wave-27-story-planning-batch
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K3 (2026-06-05) — drag handle renders in each Outliner row but fires nothing; rows cannot be reordered by dragging; documented as known gap in OUTLINER-SPEC.md §known-follow-up.
---

# Follow-up: outliner-drag-reorder

The Outliner view (Phase 3, wave-27) renders a drag handle on each row but the
drag-to-reorder behavior is not wired. The handle is visual-only — dragging a
row has no effect.

Wiring this requires:
1. Adding dnd-kit's DndContext + SortableContext around the Outliner row list.
2. Implementing useSortable per row, replacing the static row render.
3. Wiring the onDragEnd handler to the existing binder move op (binderStore.moveScene).
4. Adding a drag-overlay for visual feedback during the drag.

dnd-kit is already a project dependency (used by the corkboard). The binder move
op exists and is tested. The gap is the Outliner-specific wiring between dnd-kit
and that move op.

## Design reference

design-reference/OUTLINER-SPEC.md §known-follow-up — explicitly documents drag-to-reorder
as a post-Phase-3 item requiring dnd-kit integration.

src/features/outliner/Outliner.tsx — current implementation; the drag handle renders
but onDragEnd / DndContext are absent.

## Suggested resolution path

Standalone wave or early phase: add DndContext + SortableContext to Outliner, wire
onDragEnd to binderStore.moveScene, confirm with smoke (drag row, verify binder reorders).
Low risk — all pieces exist; this is wiring only.

## Resolution (2026-06-13)

Closed by orchestrator mechanical audit on 2026-06-13.
Evidence: Implemented: full dnd-kit wiring in `src/features/outliner/OutlinerDrag.tsx` (DndContext/SortableContext/onDragEnd → moveScene) (prior wave).
