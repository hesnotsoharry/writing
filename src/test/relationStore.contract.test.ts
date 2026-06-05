/**
 * ORCHESTRATOR-OWNED ACCEPTANCE TEST — Wave 27, Phase 4 (store seam).
 *
 * Locks the relation CRUD contract on InMemoryStoryBibleStore:
 *   addRelation, listRelations, deleteRelation, updateRelationLabel.
 * Runs against InMemoryStoryBibleStore only — per the existing test pattern.
 */
import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";

describe("relation store contract (Wave 27 Phase 4)", () => {
  it("addRelation returns a Relation row with the correct fields", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Maren", null);
    const other = await store.createCharacter("proj-1", "Kai", null);

    const rel = await store.addRelation("proj-1", { fromEntity: char.id, toEntity: other.id, label: "Friend of" });

    expect(rel.projectId).toBe("proj-1");
    expect(rel.fromEntity).toBe(char.id);
    expect(rel.toEntity).toBe(other.id);
    expect(rel.label).toBe("Friend of");
    expect(rel.reciprocalId).toBeNull();
    expect(typeof rel.createdAt).toBe("number");
    expect(typeof rel.id).toBe("string");
  });

  it("addRelation with reciprocalLabel writes the inverse edge and links both", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Maren", null);
    const other = await store.createCharacter("proj-1", "Kai", null);

    const fwd = await store.addRelation("proj-1", { fromEntity: char.id, toEntity: other.id, label: "Parent of", reciprocalLabel: "Child of" });

    expect(fwd.reciprocalId).not.toBeNull();

    const all = await store.listRelations("proj-1");
    expect(all).toHaveLength(2);

    const inv = all.find((r) => r.fromEntity === other.id && r.toEntity === char.id);
    expect(inv).toBeDefined();
    expect(inv?.label).toBe("Child of");
    expect(inv?.reciprocalId).toBe(fwd.id);
  });

  it("addRelation is dedup-safe — duplicate call returns the existing row", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Maren", null);
    const other = await store.createCharacter("proj-1", "Kai", null);

    const first = await store.addRelation("proj-1", { fromEntity: char.id, toEntity: other.id, label: "Friend of" });
    const second = await store.addRelation("proj-1", { fromEntity: char.id, toEntity: other.id, label: "Rival of" });

    expect(first.id).toBe(second.id);
    expect(second.label).toBe("Friend of"); // original label preserved
    const all = await store.listRelations("proj-1");
    expect(all).toHaveLength(1);
  });

  it("listRelations with entityId returns only edges involving that entity", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "A", null);
    const b = await store.createCharacter("proj-1", "B", null);
    const c = await store.createCharacter("proj-1", "C", null);
    await store.addRelation("proj-1", { fromEntity: a.id, toEntity: b.id, label: "Friend of" });
    await store.addRelation("proj-1", { fromEntity: b.id, toEntity: c.id, label: "Rival of" });

    // A is involved in 1 edge
    const forA = await store.listRelations("proj-1", a.id);
    expect(forA).toHaveLength(1);
    expect(forA[0].fromEntity).toBe(a.id);

    // B is involved in 2 edges (as from and as to)
    const forB = await store.listRelations("proj-1", b.id);
    expect(forB).toHaveLength(2);
  });

  it("listRelations without entityId returns all relations for the project", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "A", null);
    const b = await store.createCharacter("proj-1", "B", null);
    const c = await store.createCharacter("proj-2", "C", null);
    await store.addRelation("proj-1", { fromEntity: a.id, toEntity: b.id, label: "Friend of" });
    await store.addRelation("proj-2", { fromEntity: c.id, toEntity: a.id, label: "Knows" });

    const proj1 = await store.listRelations("proj-1");
    expect(proj1).toHaveLength(1);
    expect(proj1[0].fromEntity).toBe(a.id);
  });

  it("deleteRelation removes the forward edge and its reciprocal", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "A", null);
    const b = await store.createCharacter("proj-1", "B", null);
    const fwd = await store.addRelation("proj-1", { fromEntity: a.id, toEntity: b.id, label: "Parent of", reciprocalLabel: "Child of" });

    await store.deleteRelation(fwd.id);

    const all = await store.listRelations("proj-1");
    expect(all).toHaveLength(0);
  });

  it("deleteRelation on a non-reciprocal edge removes only that edge", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "A", null);
    const b = await store.createCharacter("proj-1", "B", null);
    const rel = await store.addRelation("proj-1", { fromEntity: a.id, toEntity: b.id, label: "Custom label" });

    await store.deleteRelation(rel.id);

    const all = await store.listRelations("proj-1");
    expect(all).toHaveLength(0);
  });

  it("deleteEntity cascades — listRelations returns empty after the referenced entity is deleted", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "A", null);
    const b = await store.createCharacter("proj-1", "B", null);
    await store.addRelation("proj-1", { fromEntity: a.id, toEntity: b.id, label: "Friend of" });

    await store.deleteEntity("character", a.id);

    const remaining = await store.listRelations("proj-1");
    expect(remaining).toHaveLength(0);
  });

  it("updateRelationLabel changes only the targeted edge's label", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "A", null);
    const b = await store.createCharacter("proj-1", "B", null);
    const fwd = await store.addRelation("proj-1", { fromEntity: a.id, toEntity: b.id, label: "Parent of", reciprocalLabel: "Child of" });

    await store.updateRelationLabel(fwd.id, "Ancestor of");

    const all = await store.listRelations("proj-1");
    const updated = all.find((r) => r.id === fwd.id);
    expect(updated?.label).toBe("Ancestor of");
    // reciprocal should be unchanged
    const inv = all.find((r) => r.id === fwd.reciprocalId);
    expect(inv?.label).toBe("Child of");
  });
});
