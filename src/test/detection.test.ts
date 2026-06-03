import { describe, expect, it } from "vitest";

import { Entity } from "../db/storyBibleStore";
import { detectEntities } from "../lib/detection";

/**
 * Helper to construct an Entity with defaults for testing.
 * id, projectId, name are required; others default.
 */
function makeEntity(
  id: string,
  name: string,
  opts?: { type?: "character" | "location"; aliases?: string | null }
): Entity {
  return {
    id,
    projectId: "p1",
    type: opts?.type ?? "character",
    name,
    notes: null,
    aliases: opts?.aliases ?? null,
  };
}

describe("detectEntities — pure entity matcher", () => {
  it("simple match: text containing name returns entity id", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("Sarah walked in.", [sarah]);
    expect(result).toContain("id_sarah");
    expect(result).toHaveLength(1);
  });

  it("case-insensitive: text in lowercase matches entity name", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("sarah walked in.", [sarah]);
    expect(result).toContain("id_sarah");
  });

  it("no match: text without entity name returns empty", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("Nobody here.", [sarah]);
    expect(result).toHaveLength(0);
  });

  it("substring does not match: 'Sarahson' does not match 'Sarah'", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("Sarahson left.", [sarah]);
    expect(result).toHaveLength(0);
  });

  it("substring does not match: 'disarray' does not match 'Sarah'", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("disarray everywhere.", [sarah]);
    expect(result).toHaveLength(0);
  });

  it("possessive: 'Sarah\\'s' matches name 'Sarah'", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("Sarah's cloak.", [sarah]);
    expect(result).toContain("id_sarah");
    expect(result).toHaveLength(1);
  });

  it("longest-first, same span: longer name covers span, shorter contained name does not also match", () => {
    const anne = makeEntity("id_anne", "Anne");
    const anneShirley = makeEntity("id_anne_s", "Anne Shirley");
    const result = detectEntities("Anne Shirley wept.", [anne, anneShirley]);
    expect(result).toContain("id_anne_s");
    expect(result).not.toContain("id_anne");
    expect(result).toHaveLength(1);
  });

  it("longest-first, separate spans: both names matched in different spans", () => {
    const anne = makeEntity("id_anne", "Anne");
    const anneShirley = makeEntity("id_anne_s", "Anne Shirley");
    const result = detectEntities(
      "Anne smiled, then Anne Shirley left.",
      [anne, anneShirley]
    );
    expect(result).toContain("id_anne");
    expect(result).toContain("id_anne_s");
    expect(result).toHaveLength(2);
  });

  it("apostrophe in name: 'O\\'Brien' as literal apostrophe", () => {
    const obrien = makeEntity("id_obrien", "O'Brien");
    const result = detectEntities("O'Brien nodded.", [obrien]);
    expect(result).toContain("id_obrien");
    expect(result).toHaveLength(1);
  });

  it("hyphen in name: 'Anne-Marie' as literal hyphen", () => {
    const annemarie = makeEntity("id_am", "Anne-Marie");
    const result = detectEntities("Anne-Marie sang.", [annemarie]);
    expect(result).toContain("id_am");
    expect(result).toHaveLength(1);
  });

  it("regex metachar '.' in name: 'St. Mary\\'s' literal period matches text; 'StXMary\\'s' does not", () => {
    const stmarys = makeEntity("id_stm", "St. Mary's");
    const resultMatch = detectEntities("St. Mary's bells rang.", [stmarys]);
    expect(resultMatch).toContain("id_stm");

    // Verify that '.' is escaped (not any-char): StXMary's should NOT match.
    const resultNoMatch = detectEntities("StXMary's bells rang.", [stmarys]);
    expect(resultNoMatch).toHaveLength(0);
  });

  it("multi-word overlap, same span: longest-first prevents shorter component matches", () => {
    const lord = makeEntity("id_lord", "Lord");
    const harwick = makeEntity("id_harwick", "Harwick");
    const lordHarwick = makeEntity("id_lh", "Lord Harwick");

    // In the span "Lord Harwick", only the longest match fires.
    const result1 = detectEntities("Lord Harwick arrived.", [
      lord,
      harwick,
      lordHarwick,
    ]);
    expect(result1).toContain("id_lh");
    expect(result1).not.toContain("id_lord");
    expect(result1).not.toContain("id_harwick");
    expect(result1).toHaveLength(1);

    // In separate spans, both match.
    const result2 = detectEntities("The Lord met Harwick.", [
      lord,
      harwick,
      lordHarwick,
    ]);
    expect(result2).toContain("id_lord");
    expect(result2).toContain("id_harwick");
    expect(result2).not.toContain("id_lh");
    expect(result2).toHaveLength(2);
  });

  it("alias match: entity with aliases matches on alias in text", () => {
    const carter = makeEntity("id_carter", "Carter", {
      aliases: '["Dr. Carter","the Doctor"]',
    });
    const result1 = detectEntities("the Doctor entered.", [carter]);
    expect(result1).toContain("id_carter");

    const result2 = detectEntities("Dr. Carter spoke.", [carter]);
    expect(result2).toContain("id_carter");

    const result3 = detectEntities("Carter waited.", [carter]);
    expect(result3).toContain("id_carter");
  });

  it("empty entity list: returns empty", () => {
    const result = detectEntities("anything at all.", []);
    expect(result).toHaveLength(0);
  });

  it("empty text: returns empty", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("", [sarah]);
    expect(result).toHaveLength(0);
  });

  it("whitespace-only text: returns empty", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("   ", [sarah]);
    expect(result).toHaveLength(0);
  });

  it("deduplication: same entity mentioned twice returns one id", () => {
    const sarah = makeEntity("id_sarah", "Sarah");
    const result = detectEntities("Sarah saw Sarah again.", [sarah]);
    expect(result).toContain("id_sarah");
    expect(result).toHaveLength(1);
  });

  it("null aliases safe: entity with null aliases matches on name only, no throw", () => {
    const sarah = makeEntity("id_sarah", "Sarah", { aliases: null });
    const result = detectEntities("Sarah walked in.", [sarah]);
    expect(result).toContain("id_sarah");
    expect(result).toHaveLength(1);
  });

  it("mixed types both detected: character and location matched together", () => {
    const sarah = makeEntity("id_sarah", "Sarah", { type: "character" });
    const thornfield = makeEntity("id_tf", "Thornfield", {
      type: "location",
    });
    const result = detectEntities("Sarah reached Thornfield.", [
      sarah,
      thornfield,
    ]);
    expect(result).toContain("id_sarah");
    expect(result).toContain("id_tf");
    expect(result).toHaveLength(2);
  });
});
