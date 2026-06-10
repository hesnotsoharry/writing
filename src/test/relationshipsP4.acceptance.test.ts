/**
 * relationshipsP4.acceptance.test.ts — acceptance tests for Wave 28 P4 + Wave 31 P2.
 *
 * Wave 28 P4 (original contracts — kept):
 *   1. Q-PRESETS: RELATION_PRESETS has per-type keys; '*' fallback retained.
 *   2. allRelations alias on StoryBibleStore.
 *
 * Wave 31 P2 (added):
 *   3. deriveEdges adapter: edge derivation from Relation[], theme exclusion, degree, involvedIds.
 *
 * Pure logic tests only. Visual / SVG rendering verified by orchestrator CDP smoke.
 */
import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import type { Entity, Relation } from "../db/storyBibleStore";
import { getPresetsForType, RELATION_PRESETS } from "../db/storyBibleStore";
import { deriveEdges } from "../storybible/RelationshipMap";


// ── Wave 28 P4: per-type RELATION_PRESETS ─────────────────────────────────────

describe("Wave 28 P4 — per-type RELATION_PRESETS (Q-PRESETS)", () => {
  it("defines real per-type keys, not just the '*' catch-all", () => {
    expect(RELATION_PRESETS.character, "RELATION_PRESETS needs a 'character' key").toBeDefined();
    expect(RELATION_PRESETS.faction, "RELATION_PRESETS needs a 'faction' key").toBeDefined();
    expect(RELATION_PRESETS["*"], "the '*' fallback must remain").toBeDefined();
  });

  it("character presets carry the family/social vocabulary (parent↔child pair present)", () => {
    const labels = getPresetsForType("character");
    expect(labels.length).toBeGreaterThan(0);
    const parent = labels.find((p) => p.label === "Parent of");
    expect(parent, "character presets should include 'Parent of'").toBeDefined();
    expect(parent?.inv).toBe("Child of");
  });

  it("faction presets carry the membership vocabulary (Member of ↔ Has member)", () => {
    const labels = getPresetsForType("faction");
    expect(labels.length).toBeGreaterThan(0);
    const member = labels.find((p) => p.label === "Member of");
    expect(member, "faction presets should include a 'Member of' entry").toBeDefined();
    expect(member?.inv).toBe("Has member");
  });

  it("location presets carry the containment vocabulary (Located in ↔ Contains)", () => {
    expect(RELATION_PRESETS.location, "RELATION_PRESETS needs a 'location' key").toBeDefined();
    const labels = getPresetsForType("location");
    expect(labels.length).toBeGreaterThan(0);
    const located = labels.find((p) => p.label === "Located in");
    expect(located, "location presets should include 'Located in'").toBeDefined();
    expect(located?.inv).toBe("Contains");
  });

  it("an unknown custom type falls back to the non-empty '*' list", () => {
    const labels = getPresetsForType("some-custom-type-xyz");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).toEqual(RELATION_PRESETS["*"]);
  });
});

// ── Wave 28 P4: allRelations alias ────────────────────────────────────────────

describe("Wave 28 P4 — allRelations alias on the store", () => {
  it("returns every relation for the project (delegates to listRelations w/o entityId)", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "Maren", null);
    const b = await store.createCharacter("proj-1", "Kai", null);
    const c = await store.createCharacter("proj-2", "Other", null);
    await store.addRelation("proj-1", { fromEntity: a.id, toEntity: b.id, label: "Friend of" });
    await store.addRelation("proj-2", { fromEntity: c.id, toEntity: a.id, label: "Knows" });

    const all = await store.allRelations("proj-1");
    expect(all.length).toBe(1);
    expect(all[0].fromEntity).toBe(a.id);
    const viaList = await store.listRelations("proj-1");
    expect(all).toEqual(viaList);
  });
});

// ── Wave 31 P2: deriveEdges adapter ───────────────────────────────────────────

const mkEntity = (id: string, type: string): Entity => ({
  id, type, projectId: "proj", name: `Entity-${id}`, notes: null, aliases: null,
});

const mkRelation = (id: string, from: string, to: string, label: string): Relation => ({
  id, fromEntity: from, toEntity: to, label,
  projectId: "proj", reciprocalId: null, createdAt: 0,
});

describe("Wave 31 P2 — deriveEdges: edge derivation from Relation[]", () => {
  it("produces one undirected edge per sorted id pair, deduping a reciprocal row", () => {
    const entities = [mkEntity("a", "character"), mkEntity("b", "character")];
    const relations = [mkRelation("r1", "a", "b", "Friend of"), mkRelation("r2", "b", "a", "Friend of")];
    const { edges } = deriveEdges(entities, relations);
    expect(edges.length).toBe(1);
    expect(edges[0]).toEqual({ a: "a", b: "b", label: "Friend of" });
  });

  it("skips a relation when either endpoint entity is missing from the entities array", () => {
    const entities = [mkEntity("a", "character")];
    const relations = [mkRelation("r1", "a", "ghost", "knows")];
    const { edges } = deriveEdges(entities, relations);
    expect(edges.length).toBe(0);
  });

  it("excludes theme-type entities — relations touching a theme produce no nodes or edges", () => {
    const entities = [mkEntity("a", "character"), mkEntity("t", "theme")];
    const relations = [mkRelation("r1", "a", "t", "explores")];
    const { edges, involvedIds } = deriveEdges(entities, relations);
    expect(edges.length).toBe(0);
    expect(involvedIds.has("t")).toBe(false);
    expect(involvedIds.has("a")).toBe(false);
  });

  it("computes undirected degree: each edge increments both endpoints by 1", () => {
    const entities = [mkEntity("a", "character"), mkEntity("b", "location"), mkEntity("c", "item")];
    const relations = [mkRelation("r1", "a", "b", "visits"), mkRelation("r2", "a", "c", "owns")];
    const { degree } = deriveEdges(entities, relations);
    expect(degree["a"]).toBe(2);
    expect(degree["b"]).toBe(1);
    expect(degree["c"]).toBe(1);
  });

  it("involvedIds contains exactly the entities that appear in at least one edge", () => {
    const entities = [mkEntity("a", "character"), mkEntity("b", "location"), mkEntity("c", "item")];
    const relations = [mkRelation("r1", "a", "b", "visits")];
    const { involvedIds } = deriveEdges(entities, relations);
    expect(involvedIds.has("a")).toBe(true);
    expect(involvedIds.has("b")).toBe(true);
    expect(involvedIds.has("c")).toBe(false);
  });

  it("two theme-only-touching entities both absent from involvedIds even if they have mutual relations", () => {
    const entities = [mkEntity("t1", "theme"), mkEntity("t2", "theme")];
    const relations = [mkRelation("r1", "t1", "t2", "related")];
    const { edges, involvedIds } = deriveEdges(entities, relations);
    expect(edges.length).toBe(0);
    expect(involvedIds.size).toBe(0);
  });
});
