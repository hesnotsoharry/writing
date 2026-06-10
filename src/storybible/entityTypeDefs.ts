/**
 * Built-in entity type definitions for the Relationship Map.
 * Provides the six canonical types (character · location · item · faction ·
 * lore · theme) keyed by their type string, plus a resolver that layers
 * store-backed custom types over the built-ins with a safe icon fallback.
 */

import { ICON_PATHS, type IconName } from '../components/Icon';
import type { CustomEntityType } from '../db/storyBibleStore';

/** Shape consumed by RelationshipMap nodes and the map-key card. */
export interface EntityTypeDef {
  /** Human-readable label for filter chips and the map-key card. */
  label: string;
  /** ICON_PATHS key identifying the glyph rendered inside the node. */
  icon: IconName;
  /**
   * CSS custom-property reference resolving to the type's accent colour,
   * e.g. `"var(--label-clay)"`. Use directly in inline styles.
   */
  color: string;
}

/**
 * Built-in six-type definitions keyed by the canonical type string.
 * Theme is included for completeness; the map excludes it by design.
 */
export const ENTITY_TYPE_DEFS: Readonly<Record<string, EntityTypeDef>> = {
  character: { label: 'Character', icon: 'user',    color: 'var(--label-clay)'  },
  location:  { label: 'Location',  icon: 'mapPin',  color: 'var(--label-moss)'  },
  item:      { label: 'Item',      icon: 'box',     color: 'var(--label-gold)'  },
  faction:   { label: 'Faction',   icon: 'flag',    color: 'var(--label-plum)'  },
  lore:      { label: 'Lore',      icon: 'globe',   color: 'var(--label-sea)'   },
  theme:     { label: 'Theme',     icon: 'sparkle', color: 'var(--label-slate)' },
};

/**
 * Resolve a type name to its EntityTypeDef.
 *
 * Priority: built-in → custom (by name) → generic fallback.
 * The icon from a custom type is validated against ICON_PATHS; any unrecognised
 * value falls back to `circleOpen` so the map never crashes on a bad icon name.
 */
export function resolveEntityTypeDef(
  typeName: string,
  customTypes: Pick<CustomEntityType, 'name' | 'icon' | 'color'>[],
): EntityTypeDef {
  const builtin = ENTITY_TYPE_DEFS[typeName];
  if (builtin) return builtin;

  const custom = customTypes.find((ct) => ct.name === typeName);
  if (custom) {
    // Runtime `in` check guarantees validity; TS can't narrow string via `in`.
    const icon = (custom.icon in ICON_PATHS ? custom.icon : 'circleOpen') as IconName;
    return { label: custom.name, icon, color: custom.color };
  }

  return { label: typeName, icon: 'circleOpen', color: 'var(--ink-3)' };
}
