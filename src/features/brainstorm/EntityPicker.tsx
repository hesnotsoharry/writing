/**
 * EntityPicker — floating entity picker for the board toolbar.
 *
 * Reuses InspPicker (the inspector's entity-link picker) for visual language per
 * the task requirement to match existing picker patterns. Positioned as an
 * absolute-positioned popover below the "Add entity card" toolbar button.
 * Closes on Escape (via InspPicker) and on clicks outside the picker.
 */
import { useEffect, useRef } from "react";

import type { Entity } from "../../db/storyBibleStore";
import { InspPicker } from "../../inspector/InspPicker";

// ── EntityPicker ──────────────────────────────────────────────────────────────

interface EntityPickerProps {
  entities: Entity[];
  onPick: (entity: Entity) => void;
  onClose: () => void;
}

export function EntityPicker({ entities, onPick, onClose }: EntityPickerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

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
