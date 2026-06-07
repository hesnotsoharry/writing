/**
 * entityTypes.acceptance.test.ts — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 3.
 *
 * ⚠️ Implementers: DO NOT MODIFY THIS FILE. It expresses the canon contract for the new entity
 * types (item/faction/lore/theme) from the consumer's perspective. Make it pass without editing it.
 *
 * Canon source: design-reference/ENTITY-TYPES-SPEC.md (field labels + tier groupings).
 * Icon names: the local registry src/components/Icon.tsx — the spec's aspirational names
 * (box/flag/globe) do not exist there; the icons that DO exist and were added for this feature are
 * feather/users/sparkle/quote (per the salvage audit). Code is canon for which icons are available.
 *
 * The visual effects (avatar tint, Full-Entry hero fallback) are verified by the live CDP smoke for
 * this phase, not here — these assertions cover the data constants that drive them.
 */
import { describe, expect, it } from "vitest";

import { BUILT_IN_TYPES } from "../storybible/BibleTypes";
import { DEF_FIELDS } from "../storybible/fullEntry/defs";

describe("Wave 28 P3 — entity-type field labels (DEF_FIELDS) match the spec", () => {
  it("item facts are Kind · Owner · Status · First appears", () => {
    expect(DEF_FIELDS.item).toEqual(["Kind", "Owner", "Status", "First appears"]);
  });
  it("faction facts are Type · Seat · Members · Founded", () => {
    expect(DEF_FIELDS.faction).toEqual(["Type", "Seat", "Members", "Founded"]);
  });
  it("lore facts are Domain · When · Status", () => {
    expect(DEF_FIELDS.lore).toEqual(["Domain", "When", "Status"]);
  });
  it("theme facts are Motif · Status", () => {
    expect(DEF_FIELDS.theme).toEqual(["Motif", "Status"]);
  });
});

describe("Wave 28 P3 — Story Bible type defs (BUILT_IN_TYPES) match the spec table", () => {
  const byType = new Map(BUILT_IN_TYPES.map((d) => [d.type, d]));

  // type → [icon, color/accent, tier]
  const expected: Record<string, [string, string, string]> = {
    character: ["users", "character", "People & Groups"],
    faction: ["users", "label-plum", "People & Groups"],
    location: ["mapPin", "location", "People & Groups"],
    item: ["feather", "label-gold", "People & Groups"],
    lore: ["sparkle", "label-sea", "World & Lore"],
    theme: ["quote", "label-rose", "Themes"],
  };

  for (const [type, [icon, color, tier]] of Object.entries(expected)) {
    it(`${type}: icon=${icon}, accent=${color}, tier=${tier}`, () => {
      const def = byType.get(type);
      expect(def, `BUILT_IN_TYPES is missing "${type}"`).toBeDefined();
      expect(def?.icon).toBe(icon);
      expect(def?.color).toBe(color);
      expect(def?.tier).toBe(tier);
    });
  }

  it("Items and Factions both sit under the People & Groups tier (not World & Lore)", () => {
    expect(byType.get("item")?.tier).toBe("People & Groups");
    expect(byType.get("faction")?.tier).toBe("People & Groups");
  });
});
