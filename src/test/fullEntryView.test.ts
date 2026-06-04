/**
 * Unit tests for pure helpers in src/storybible/fullEntry/defs.ts.
 * Tests contract (not implementation details) — each case asserts
 * specific output values, not just "is defined" or "is truthy".
 */

import { describe, expect, it } from "vitest";

import type { Folder, Scene } from "../db/binderStore";
import type { EntityField } from "../db/storyBibleStore";
import {
  buildAppearsIn,
  DEF_FIELDS,
  DEF_SECTIONS,
  mergeFacts,
  mergeSections,
  SEED_KEY,
} from "../storybible/fullEntry/defs";

// ── buildAppearsIn ────────────────────────────────────────────────────────────

describe("buildAppearsIn", () => {
  const folders: Folder[] = [
    { id: "f1", project_id: "p1", title: "Chapter One", sort_order: 1 },
    { id: "f2", project_id: "p1", title: "Epilogue", sort_order: 2 },
  ];
  const scenes: Scene[] = [
    {
      id: "s1", project_id: "p1", folder_id: "f1",
      title: "The Beginning", synopsis: null,
      sort_order: 1, word_count: 1200, status: "draft",
    },
    {
      id: "s2", project_id: "p1", folder_id: "f2",
      title: "Farewell", synopsis: null,
      sort_order: 1, word_count: 450, status: "final",
    },
    {
      id: "s3", project_id: "p1", folder_id: null,
      title: "Prelude", synopsis: null,
      sort_order: 1, word_count: 0, status: "blank",
    },
  ];

  it("maps scene ids to correct rows preserving input order", () => {
    const rows = buildAppearsIn(["s2", "s1"], folders, scenes);
    expect(rows).toHaveLength(2);
    expect(rows[0].sceneId).toBe("s2");
    expect(rows[0].title).toBe("Farewell");
    expect(rows[0].chapter).toBe("Epilogue");
    expect(rows[0].status).toBe("final");
    expect(rows[0].words).toBe(450);
    expect(rows[1].sceneId).toBe("s1");
    expect(rows[1].chapter).toBe("Chapter One");
  });

  it("skips unknown scene ids silently", () => {
    const rows = buildAppearsIn(["s1", "UNKNOWN", "s2"], folders, scenes);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.sceneId)).toEqual(["s1", "s2"]);
  });

  it("returns empty array when sceneIds is empty", () => {
    expect(buildAppearsIn([], folders, scenes)).toHaveLength(0);
  });

  it("scene with no folder gets chapter = empty string", () => {
    const rows = buildAppearsIn(["s3"], folders, scenes);
    expect(rows).toHaveLength(1);
    expect(rows[0].chapter).toBe("");
    expect(rows[0].words).toBe(0);
  });
});

// ── mergeFacts ────────────────────────────────────────────────────────────────

describe("mergeFacts", () => {
  it("returns all default labels for character with empty value when nothing stored", () => {
    const result = mergeFacts("character", []);
    const labels = result.map((f) => f.label);
    expect(labels).toEqual(DEF_FIELDS.character);
    expect(result.every((f) => f.value === "")).toBe(true);
  });

  it("fills stored value for matching label, leaves others empty", () => {
    const stored: EntityField[] = [
      { id: "1", entityId: "e1", kind: "fact", key: "Age", value: "34", sort: 1 },
    ];
    const result = mergeFacts("character", stored);
    expect(result.find((f) => f.label === "Age")?.value).toBe("34");
    expect(result.find((f) => f.label === "Occupation")?.value).toBe("");
  });

  it("ignores stored section fields — only uses kind=fact rows", () => {
    const stored: EntityField[] = [
      { id: "1", entityId: "e1", kind: "section", key: "Age", value: "fake", sort: 1 },
    ];
    const result = mergeFacts("character", stored);
    expect(result.find((f) => f.label === "Age")?.value).toBe("");
  });

  it("returns location default labels for location type", () => {
    const result = mergeFacts("location", []);
    expect(result.map((f) => f.label)).toEqual(DEF_FIELDS.location);
  });

  it("returns all four default labels for character", () => {
    const result = mergeFacts("character", []);
    expect(result).toHaveLength(DEF_FIELDS.character.length);
  });
});

// ── mergeSections ─────────────────────────────────────────────────────────────

describe("mergeSections", () => {
  it("returns all default section keys for character with empty text when nothing stored", () => {
    const result = mergeSections("character", [], null);
    const keys = result.map((s) => s.key);
    expect(keys).toEqual(DEF_SECTIONS.character.map((s) => s.key));
    expect(result.filter((s) => s.key !== SEED_KEY.character).every((s) => s.text === "")).toBe(true);
  });

  it("seeds the SEED_KEY section from notes when no stored sections exist", () => {
    const result = mergeSections("character", [], "Some backstory notes");
    const backstory = result.find((s) => s.key === SEED_KEY.character);
    expect(backstory?.text).toBe("Some backstory notes");
  });

  it("does NOT seed from notes when stored sections are present (even for seed key)", () => {
    const stored: EntityField[] = [
      { id: "1", entityId: "e1", kind: "section", key: "appearance", value: "Tall", sort: 1 },
    ];
    const result = mergeSections("character", stored, "Should not appear as backstory seed");
    const backstory = result.find((s) => s.key === SEED_KEY.character);
    // notes seed is suppressed once ANY stored section exists
    expect(backstory?.text).toBe("");
  });

  it("uses stored value over seed when seed key itself is stored", () => {
    const stored: EntityField[] = [
      {
        id: "1", entityId: "e1", kind: "section",
        key: SEED_KEY.character, value: "Stored backstory", sort: 1,
      },
    ];
    const result = mergeSections("character", stored, "Notes that should be ignored");
    const backstory = result.find((s) => s.key === SEED_KEY.character);
    expect(backstory?.text).toBe("Stored backstory");
  });

  it("ignores stored fact fields — only uses kind=section rows", () => {
    const stored: EntityField[] = [
      { id: "1", entityId: "e1", kind: "fact", key: "backstory", value: "fake", sort: 1 },
    ];
    const result = mergeSections("character", stored, null);
    // stored fact should not count as a section — seed key still seeds from null → ""
    const backstory = result.find((s) => s.key === SEED_KEY.character);
    expect(backstory?.text).toBe("");
  });

  it("location SEED_KEY is significance", () => {
    expect(SEED_KEY.location).toBe("significance");
    const result = mergeSections("location", [], "Location notes");
    const significance = result.find((s) => s.key === "significance");
    expect(significance?.text).toBe("Location notes");
  });

  it("preserves icon and label from DEF_SECTIONS on each returned row", () => {
    const result = mergeSections("character", [], null);
    const goals = result.find((s) => s.key === "goals");
    expect(goals?.icon).toBe("target");
    expect(goals?.label).toBe("Goals & motivation");
  });
});
