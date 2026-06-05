/**
 * StoryBibleView — tiered entity browser for Phase 5 (Wave 27).
 * Composition root: individual pieces live in:
 *   BibleTypes.tsx — EntityTypeDef, BUILT_IN_TYPES, TIER_ORDER, BibleTier
 *   BibleEntitySection.tsx — GenericEntitySection + helpers
 *   BibleListView.tsx — BibleListView + useStoryBibleLists
 *   EntityRow.tsx — EntityRow component
 */
import { useEffect, useState } from "react";

import type { StoryBibleStore } from "../db/storyBibleStore";
import { BibleListView, useStoryBibleLists } from "./BibleListView";
import { RelationshipMap } from "./RelationshipMap";

// Re-export shared types so callers can import them from the canonical path.
export type { EntityTypeDef } from "./BibleTypes";
export { BibleTier,BUILT_IN_TYPES, TIER_ORDER } from "./BibleTypes";

// ── StoryBibleView public interface ───────────────────────────────────────────

export interface StoryBibleViewProps {
  store: StoryBibleStore;
  projectId: string;
  onEntitiesChanged?: () => void;
  onOpenEntry?: (id: string, kind: string) => void;
}

type BibleSubView = "list" | "map";

function useCursorReset() {
  useEffect(() => {
    document.documentElement.style.cursor = "";
    document.body.classList.remove("binder-dragging");
  }, []);
}

export function StoryBibleView({ store, projectId, onEntitiesChanged, onOpenEntry }: StoryBibleViewProps) {
  const { entitiesByType, customTypes, refreshVersion, refresh, mapEntities, mapRelations } =
    useStoryBibleLists(store, projectId, onEntitiesChanged);
  useCursorReset();
  const [subView, setSubView] = useState<BibleSubView>("list");

  if (subView === "map") {
    return (
      <RelationshipMap entities={mapEntities} relations={mapRelations}
        onOpenEntry={(id, kind) => { setSubView("list"); onOpenEntry?.(id, kind); }}
        onBack={() => setSubView("list")} />
    );
  }
  return (
    <BibleListView store={store} projectId={projectId}
      entitiesByType={entitiesByType} customTypes={customTypes}
      refreshVersion={refreshVersion} refresh={refresh}
      onOpenEntry={onOpenEntry}
      onShowMap={() => setSubView("map")} />
  );
}
