/**
 * Unit tests for alBuildIndex and alBuildMatcher.
 *
 * Contract assertions (per test-discipline rules):
 * 1. Empty input returns empty index.
 * 2. Two entities with same prefix — longer name sorts first in `sorted`.
 * 3. Variant resolution — a "The"-stripped alias variant is present in the matcher.
 * 4. Case-aware matching — lower-case variant of a proper name is NOT in byVariant
 *    (index is case-sensitive; prose detection relies on case).
 * 5. autolinkOn=false scenario — verified via alBuildMatcher with empty allowed set.
 * 6. Alias field expansion — aliases JSON is parsed and included as variants.
 * 7. Stop-word filtering — "The" alone (after stripping) is excluded.
 */

import { describe, expect, it } from "vitest";

import type { Entity } from "../db/storyBibleStore";
import { alBuildIndex, alBuildMatcher } from "../lib/alBuildIndex";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntity(
  id: string,
  name: string,
  opts?: { type?: string; aliases?: string | null; notes?: string | null },
): Entity {
  return {
    id,
    projectId: "p1",
    type: opts?.type ?? "character",
    name,
    notes: opts?.notes ?? null,
    aliases: opts?.aliases ?? null,
  };
}

// ---------------------------------------------------------------------------
// alBuildIndex
// ---------------------------------------------------------------------------

describe("alBuildIndex", () => {
  it("returns empty entries and sorted arrays when given an empty entity list", () => {
    const idx = alBuildIndex([]);
    expect(idx.entries).toHaveLength(0);
    expect(idx.sorted).toHaveLength(0);
  });

  it("returns one entry for a single entity", () => {
    const e = makeEntity("id1", "Maren Vale");
    const idx = alBuildIndex([e]);
    // Entries contains at least the canonical entity (may have The-stripped variant
    // pointing to the same entry, but entries is deduplicated by entry identity).
    expect(idx.entries.length).toBeGreaterThanOrEqual(1);
    const found = idx.entries.find((en) => en.id === "id1");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Maren Vale");
    expect(found?.type).toBe("character");
  });

  it("longer name sorts before shorter prefix name in sorted array", () => {
    const lady = makeEntity("id_lady", "Lady Nightingale");
    const night = makeEntity("id_night", "Nightingale");
    const idx = alBuildIndex([lady, night]);

    // sorted[0] should be the entry whose longest variant is "Lady Nightingale" (16 chars)
    // vs "Nightingale" (11 chars).
    const sortedIds = idx.sorted.map((e) => e.id);
    expect(sortedIds.indexOf("id_lady")).toBeLessThan(sortedIds.indexOf("id_night"));
  });

  it("includes notes as description when present, truncated to 120 chars", () => {
    const longNotes = "A".repeat(200);
    const e = makeEntity("id1", "Elara", { notes: longNotes });
    const idx = alBuildIndex([e]);
    const entry = idx.entries.find((en) => en.id === "id1");
    expect(entry?.description).toHaveLength(120);
  });

  it("description is undefined when notes is null", () => {
    const e = makeEntity("id1", "Elara", { notes: null });
    const idx = alBuildIndex([e]);
    const entry = idx.entries.find((en) => en.id === "id1");
    expect(entry?.description).toBeUndefined();
  });

  it("stop-word 'The' does not appear as a standalone variant", () => {
    const e = makeEntity("id1", "The Keepers", { type: "faction" });
    const { byVariant } = alBuildMatcher([e]);
    // "The" alone should never be a key — it's in AL_STOP.
    expect(byVariant.has("The")).toBe(false);
    // "The Keepers" and "Keepers" should both be present.
    expect(byVariant.has("The Keepers")).toBe(true);
    expect(byVariant.has("Keepers")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// alBuildMatcher
// ---------------------------------------------------------------------------

describe("alBuildMatcher", () => {
  it("returns re=null and empty byVariant for empty entity list", () => {
    const { re, byVariant } = alBuildMatcher([]);
    expect(re).toBeNull();
    expect(byVariant.size).toBe(0);
  });

  it("the returned regex matches a canonical name in text (case-aware, whole-word)", () => {
    const e = makeEntity("id_maren", "Maren Vale");
    const { re, byVariant } = alBuildMatcher([e]);
    expect(re).not.toBeNull();

    // Reset lastIndex before exec.
    re!.lastIndex = 0;
    const match = re!.exec("Maren Vale arrived at the gate.");
    expect(match).not.toBeNull();
    const matched = match![1] ?? match![0];
    expect(byVariant.get(matched)?.id).toBe("id_maren");
  });

  it("does NOT match lowercase version of a proper name (case-aware index)", () => {
    const e = makeEntity("id_maren", "Maren Vale");
    const { re } = alBuildMatcher([e]);
    re!.lastIndex = 0;
    // "maren vale" is all-lower — case-aware regex should not match.
    const match = re!.exec("maren vale walked in.");
    // Either no match at all, or if it matched the variant must not be the entity
    if (match !== null) {
      // If there's a match it can only be if "maren" was somehow added as a variant,
      // which it should not be (alVariants preserves original casing).
      const matched = match[1] ?? match[0];
      expect(matched).not.toBe("maren");
    }
    // The canonical expectation: maren (all-lower) is not in byVariant.
    const { byVariant } = alBuildMatcher([e]);
    expect(byVariant.has("maren")).toBe(false);
    expect(byVariant.has("maren vale")).toBe(false);
  });

  it("allowedTypes filter: entity not in allowed set produces no variants", () => {
    const character = makeEntity("id_char", "Maren", { type: "character" });
    const theme = makeEntity("id_theme", "Redemption", { type: "theme" });

    // Only allow "character" — theme should be filtered out.
    const { byVariant } = alBuildMatcher([character, theme], new Set(["character"]));
    expect(byVariant.has("Maren")).toBe(true);
    expect(byVariant.has("Redemption")).toBe(false);
  });

  it("allowedTypes=empty Set produces no variants (all chips off → link nothing)", () => {
    // This is the production path for autolinkTypes=[] after the Fix-2 change:
    // buildDecorations always builds a Set from autolinkTypes, so an empty array
    // produces an empty Set and filters every entry out → DecorationSet.empty.
    // This test guards alBuildMatcher's side of that contract (callers should
    // also hit the filtered.length===0 early-return before reaching here).
    const e = makeEntity("id1", "Maren");
    const { re, byVariant } = alBuildMatcher([e], new Set<string>());
    expect(re).toBeNull();
    expect(byVariant.size).toBe(0);
  });

  it("aliases in entity.aliases JSON are included as variants", () => {
    const e = makeEntity("id_carter", "Dr. Carter", {
      aliases: '["the Doctor","Carter"]',
    });
    const { byVariant } = alBuildMatcher([e]);
    expect(byVariant.has("Dr. Carter")).toBe(true);
    expect(byVariant.has("the Doctor")).toBe(true);
    expect(byVariant.has("Carter")).toBe(true);
  });

  it("possessive tolerance: regex boundary allows match immediately before apostrophe+s", () => {
    const e = makeEntity("id_maren", "Maren");
    const { re } = alBuildMatcher([e]);
    re!.lastIndex = 0;
    // "Maren's" — the apostrophe is not [A-Za-z] so the lookahead should pass.
    const match = re!.exec("Maren's cloak was gone.");
    expect(match).not.toBeNull();
    const matched = match![1] ?? match![0];
    expect(matched).toBe("Maren");
  });

  it("deduplication: duplicate entity name only produces one byVariant entry", () => {
    const a = makeEntity("id_a", "Maren");
    const b = makeEntity("id_b", "Maren"); // duplicate name, different id
    const { byVariant } = alBuildMatcher([a, b]);
    // First writer wins — only one entry for "Maren"
    expect(byVariant.get("Maren")?.id).toBe("id_a");
  });
});
