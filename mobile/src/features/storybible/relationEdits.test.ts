import { InMemoryStoryBibleStore } from "@writersnook/db/inMemoryStoryBibleStore";
import { describe, expect, it } from "vitest";

import type { Relation } from "../../shared/storyBibleStore";
import { isRelated, relationsBetween, relationTargets, toggleRelation } from "./relationEdits";

const PROJECT = "project-1";

function relation(overrides: Partial<Relation>): Relation {
  return {
    id: crypto.randomUUID(), projectId: PROJECT, fromEntity: "a", toEntity: "b",
    label: "Related to", reciprocalId: null, createdAt: Date.now(), ...overrides,
  };
}

describe("relationsBetween / isRelated", () => {
  it("finds a row joining the pair in either direction", () => {
    const relations = [relation({ fromEntity: "a", toEntity: "b" })];
    expect(relationsBetween(relations, "a", "b")).toHaveLength(1);
    expect(relationsBetween(relations, "b", "a")).toHaveLength(1);
    expect(isRelated(relations, "a", "b")).toBe(true);
    expect(isRelated(relations, "b", "a")).toBe(true);
  });

  it("leaves an unrelated pair untouched", () => {
    const relations = [relation({ fromEntity: "a", toEntity: "b" })];
    expect(relationsBetween(relations, "a", "c")).toEqual([]);
    expect(isRelated(relations, "a", "c")).toBe(false);
  });
});

describe("relationTargets", () => {
  it("flags linked entities and carries the existing relation's label, sorted by name", () => {
    const entities = [
      { id: "b", name: "Bree" }, { id: "a", name: "Alden" }, { id: "c", name: "Corin" },
    ];
    const relations = [relation({ fromEntity: "a", toEntity: "b", label: "Sibling of" })];
    const targets = relationTargets(entities, relations, "a");
    expect(targets).toEqual([
      { id: "b", name: "Bree", linked: true, label: "Sibling of" },
      { id: "c", name: "Corin", linked: false, label: undefined },
    ]);
  });

  it("excludes the selected entity itself", () => {
    const entities = [{ id: "a", name: "Alden" }, { id: "b", name: "Bree" }];
    const targets = relationTargets(entities, [], "a");
    expect(targets.map((target) => target.id)).toEqual(["b"]);
  });
});

describe("toggleRelation", () => {
  it("creates a relation labelled 'Related to' when none exists", async () => {
    const store = new InMemoryStoryBibleStore();
    const linked = await toggleRelation({ store, projectId: PROJECT, relations: [] }, "a", "b");
    expect(linked).toBe(true);
    const relations = await store.allRelations(PROJECT);
    expect(relations).toHaveLength(1);
    expect(relations[0]).toMatchObject({ fromEntity: "a", toEntity: "b", label: "Related to" });
  });

  it("removes every joining row, both directions, including duplicates", async () => {
    const store = new InMemoryStoryBibleStore();
    const forward = await store.addRelation(PROJECT, { fromEntity: "a", toEntity: "b", label: "Related to" });
    const reverse = await store.addRelation(PROJECT, { fromEntity: "b", toEntity: "a", label: "Related to" });
    const relations = [forward, reverse];
    const linked = await toggleRelation({ store, projectId: PROJECT, relations }, "a", "b");
    expect(linked).toBe(false);
    expect(await store.allRelations(PROJECT)).toEqual([]);
  });

  it("refuses to link an entity to itself", async () => {
    const store = new InMemoryStoryBibleStore();
    const linked = await toggleRelation({ store, projectId: PROJECT, relations: [] }, "a", "a");
    expect(linked).toBe(false);
    expect(await store.allRelations(PROJECT)).toEqual([]);
  });

  it("leaves other entities' relations alone", async () => {
    const store = new InMemoryStoryBibleStore();
    const untouched = await store.addRelation(PROJECT, { fromEntity: "a", toEntity: "c", label: "Related to" });
    await toggleRelation({ store, projectId: PROJECT, relations: [] }, "a", "b");
    const relations = await store.allRelations(PROJECT);
    expect(relations.some((relation) => relation.id === untouched.id)).toBe(true);
    expect(relations.some((relation) => relation.fromEntity === "a" && relation.toEntity === "b")).toBe(true);
  });
});
