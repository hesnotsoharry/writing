/**
 * EntityPicker — floating entity picker for the board toolbar.
 *
 * Reuses InspPicker (the inspector's entity-link picker) for visual language per
 * the task requirement to match existing picker patterns. Positioned as an
 * absolute-positioned popover below the "Add entity card" toolbar button.
 * Closes on Escape (via InspPicker) and on clicks outside the picker.
 */
import type React from "react";
import { useRef } from "react";

import type { Entity } from "../../db/storyBibleStore";
import { InspPicker } from "../../inspector/InspPicker";
import { useDismissOnOutside } from "./boardCanvasHooks";

// ── EntityPicker ──────────────────────────────────────────────────────────────

interface EntityPickerProps {
  entities: Entity[];
  onPick: (entity: Entity) => void;
  onClose: () => void;
  excludeRef?: React.RefObject<HTMLElement | null>;
}

export function EntityPicker({ entities, onPick, onClose, excludeRef }: EntityPickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  useDismissOnOutside(wrapRef, onClose, true, excludeRef);

  return (
    <div ref={wrapRef} className="board-entity-picker">
      <InspPicker
        candidates={entities}
        placeholder="Find entity…"
        onPick={onPick}
        onClose={onClose}
      />
    </div>
  );
}
