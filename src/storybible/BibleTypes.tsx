/**
 * Shared type definitions, constants, and the BibleTier component for the Story Bible.
 * Extracted to a dependency-cycle-free base so BibleListView and StoryBibleView
 * can both import without a circular dependency.
 */
import { useState } from "react";

import type { IconName } from "../components/Icon";
import { Icon } from "../components/Icon";
import type { Entity, StoryBibleStore } from "../db/storyBibleStore";
import type { GenericEntitySectionProps } from "./BibleEntitySection";
import { GenericEntitySection } from "./BibleEntitySection";

// ── Entity type definitions ────────────────────────────────────────────────────

export interface EntityTypeDef {
  type: string;
  label: string;
  icon: IconName;
  color: string;
  tier: "People & Groups" | "World & Lore" | "Themes" | "Custom";
}

export const BUILT_IN_TYPES: EntityTypeDef[] = [
  { type: "character", label: "Characters", icon: "users",   color: "character",  tier: "People & Groups" },
  { type: "faction",   label: "Factions",   icon: "pin",     color: "label-plum", tier: "People & Groups" },
  { type: "location",  label: "Locations",  icon: "mapPin",  color: "location",   tier: "World & Lore"   },
  { type: "item",      label: "Items",      icon: "archive", color: "label-clay", tier: "World & Lore"   },
  { type: "lore",      label: "Lore",       icon: "book",    color: "label-sea",  tier: "World & Lore"   },
  { type: "theme",     label: "Themes",     icon: "sparkle", color: "label-gold", tier: "Themes"         },
];

export const TIER_ORDER = ["People & Groups", "World & Lore", "Themes", "Custom"] as const;

// ── BibleTier ─────────────────────────────────────────────────────────────────

export interface BibleTierProps {
  tierLabel: string;
  defs: Array<EntityTypeDef | { type: string; label: string; icon: IconName; color: string }>;
  entitiesByType: Map<string, Entity[]>;
  store: StoryBibleStore;
  projectId: string;
  onMutated: () => void;
  refreshVersion: number;
  onOpenEntry?: (id: string, kind: string) => void;
}

export function BibleTier({
  tierLabel, defs, entitiesByType, store, projectId, onMutated, refreshVersion, onOpenEntry,
}: BibleTierProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  function toggleCol(type: string) {
    setCollapsedCols((prev) => {
      const next = new Set(prev); if (next.has(type)) next.delete(type); else next.add(type); return next;
    });
  }
  const sectionProps: Omit<GenericEntitySectionProps, "def" | "entities" | "collapsed" | "onToggle"> = {
    store, projectId, onMutated, refreshVersion, onOpenEntry,
  };
  return (
    <div className="bib-tier">
      <div className="bib-tier-label" style={{ cursor: "pointer" }} onClick={() => setCollapsed((v) => !v)}>
        <Icon name={collapsed ? "chevRight" : "chevDown"} style={{ width: 12, height: 12, marginRight: 6 }} />
        {tierLabel}
      </div>
      {!collapsed && (
        <div className="bib-cols">
          {defs.map((def) => (
            <GenericEntitySection key={def.type} def={def}
              entities={entitiesByType.get(def.type) ?? []}
              {...sectionProps}
              collapsed={collapsedCols.has(def.type)} onToggle={() => toggleCol(def.type)} />
          ))}
        </div>
      )}
    </div>
  );
}
