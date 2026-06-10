/**
 * Unit tests for resolveEntityTypeDef.
 * Contracts: built-in lookup, custom-type merge, unknown-icon fallback.
 */
import { describe, expect, it } from 'vitest';

import type { CustomEntityType } from '../db/storyBibleStore';
import { ENTITY_TYPE_DEFS, resolveEntityTypeDef } from '../storybible/entityTypeDefs';

type Slim = Pick<CustomEntityType, 'name' | 'icon' | 'color'>;

const NO_CUSTOM: Slim[] = [];

describe('resolveEntityTypeDef', () => {
  it('returns the built-in def unchanged for a known built-in type', () => {
    const result = resolveEntityTypeDef('character', NO_CUSTOM);
    expect(result).toBe(ENTITY_TYPE_DEFS['character']);
    expect(result.icon).toBe('user');
    expect(result.color).toBe('var(--label-clay)');
    expect(result.label).toBe('Character');
  });

  it('returns the correct def for each of the five mapped built-in types', () => {
    expect(resolveEntityTypeDef('location', NO_CUSTOM).color).toBe('var(--label-moss)');
    expect(resolveEntityTypeDef('item',     NO_CUSTOM).icon).toBe('box');
    expect(resolveEntityTypeDef('faction',  NO_CUSTOM).icon).toBe('flag');
    expect(resolveEntityTypeDef('lore',     NO_CUSTOM).color).toBe('var(--label-sea)');
  });

  it('returns the custom-type def when the type name matches a custom entry', () => {
    const customs: Slim[] = [
      { name: 'creature', icon: 'flame', color: 'var(--label-rose)' },
    ];
    const result = resolveEntityTypeDef('creature', customs);
    expect(result.label).toBe('creature');
    expect(result.icon).toBe('flame');
    expect(result.color).toBe('var(--label-rose)');
  });

  it('falls back to circleOpen when the custom icon name is not an ICON_PATHS key', () => {
    const customs: Slim[] = [
      { name: 'spirit', icon: 'not-a-real-glyph', color: 'var(--label-plum)' },
    ];
    const result = resolveEntityTypeDef('spirit', customs);
    expect(result.icon).toBe('circleOpen');
    expect(result.color).toBe('var(--label-plum)');
  });

  it('returns a generic fallback when the type is unknown and no custom match exists', () => {
    const result = resolveEntityTypeDef('unknown-type', NO_CUSTOM);
    expect(result.icon).toBe('circleOpen');
    expect(result.label).toBe('unknown-type');
    expect(result.color).toBe('var(--ink-3)');
  });
});
