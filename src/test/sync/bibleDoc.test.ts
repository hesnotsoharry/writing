import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  buildBibleFromSql, getEntityNotesText, getFieldValueText, readBibleDoc,
  removeRelationPair, setRelationPair, type SqlBibleRows,
} from "../../sync/bible/bibleDoc";

function rows(): SqlBibleRows {
  const entity = (id: string, storage: "character" | "location" | "entity", type: string) => ({
    id, projectId: "p1", storage, entityType: type, name: id,
    notes: `Notes for ${id}`, aliases: `${id}-alias`, excludeFromAi: id === "lore",
  });
  return {
    entities: [
      entity("character", "character", "character"), entity("location", "location", "location"),
      entity("item", "entity", "item"), entity("faction", "entity", "faction"),
      entity("lore", "entity", "lore"), entity("theme", "entity", "theme"),
      entity("custom", "entity", "creature"),
    ],
    entityTypes: [{ id: "creature", projectId: "p1", name: "Creature", icon: "paw",
      color: "#123456", fieldsJson: "[]", sectionsJson: "[]" }],
    fields: [
      { id: "fact", entityId: "character", kind: "fact", fieldKey: "age", fieldValue: "42", sort: 0 },
      { id: "section-a", entityId: "character", kind: "section", fieldKey: "arc",
        fieldValue: "Opening arc", sort: 1 },
      { id: "section-b", entityId: "character", kind: "section", fieldKey: "history",
        fieldValue: "Old history", sort: 2 },
    ],
    sceneLinks: [{ id: "scene-1:character", sceneId: "scene-1", entityType: "character",
      entityId: "character" }],
    entityLinks: [{ id: "legacy-link", fromId: "character", toId: "location", relation: "visits" }],
    relations: [
      { id: "rel-a", projectId: "p1", fromEntity: "character", toEntity: "location",
        relationLabel: "Visits", reciprocalId: "rel-b", createdAt: 10 },
      { id: "rel-b", projectId: "p1", fromEntity: "location", toEntity: "character",
        relationLabel: "Visited by", reciprocalId: "rel-a", createdAt: 10 },
    ],
  };
}

function replicas(): { left: Y.Doc; right: Y.Doc } {
  const base = Y.encodeStateAsUpdate(buildBibleFromSql(rows()));
  const left = new Y.Doc(); const right = new Y.Doc();
  Y.applyUpdate(left, base); Y.applyUpdate(right, base);
  return { left, right };
}

function exchange(left: Y.Doc, right: Y.Doc): void {
  const leftUpdate = Y.encodeStateAsUpdate(left); const rightUpdate = Y.encodeStateAsUpdate(right);
  Y.applyUpdate(left, rightUpdate); Y.applyUpdate(right, leftUpdate);
}

describe("Bible domain doc", () => {
  it("round-trips six built-in entity types plus a custom type with storage discriminators", () => {
    const doc = buildBibleFromSql(rows());
    const state = readBibleDoc(doc);
    expect(state.entities).toHaveLength(7);
    expect(state.entities.find(({ id }) => id === "character")?.storage).toBe("character");
    expect(state.entities.find(({ id }) => id === "location")?.storage).toBe("location");
    expect(state.entities.find(({ id }) => id === "item")?.storage).toBe("entity");
    expect(new Set(state.entities.map(({ entityType }) => entityType))).toEqual(
      new Set(["character", "location", "item", "faction", "lore", "theme", "creature"]),
    );
    expect(state.entityTypes).toEqual(rows().entityTypes);
    expect(state.fields).toEqual(rows().fields);
    expect(state.sceneLinks).toEqual(rows().sceneLinks);
    expect(state.entityLinks).toEqual(rows().entityLinks);
    expect(state.relations).toEqual(rows().relations);
    expect(getEntityNotesText(doc, "character")).toBeInstanceOf(Y.Text);
    expect(getFieldValueText(doc, "section-a")).toBeInstanceOf(Y.Text);
    expect(getFieldValueText(doc, "fact")).toBeNull();
  });

  it("preserves concurrent edits to two different sections", () => {
    const { left, right } = replicas();
    getFieldValueText(left, "section-a")?.insert("Opening arc".length, " expanded");
    getFieldValueText(right, "section-b")?.insert("Old history".length, " recovered");
    exchange(left, right);
    expect(readBibleDoc(left).fields.find(({ id }) => id === "section-a")?.fieldValue)
      .toBe("Opening arc expanded");
    expect(readBibleDoc(left).fields.find(({ id }) => id === "section-b")?.fieldValue)
      .toBe("Old history recovered");
    expect(readBibleDoc(right)).toEqual(readBibleDoc(left));
  });

  it("converges concurrent edits to the same section without losing either insertion", () => {
    const { left, right } = replicas();
    getFieldValueText(left, "section-a")?.insert(0, "Left: ");
    getFieldValueText(right, "section-a")?.insert("Opening arc".length, " :Right");
    exchange(left, right);
    const leftValue = readBibleDoc(left).fields.find(({ id }) => id === "section-a")?.fieldValue;
    const rightValue = readBibleDoc(right).fields.find(({ id }) => id === "section-a")?.fieldValue;
    expect(leftValue).toBe(rightValue);
    expect(leftValue).toContain("Left: ");
    expect(leftValue).toContain(":Right");
  });

  it("emits reciprocal create and delete as one observable Yjs transaction", () => {
    const doc = buildBibleFromSql({ ...rows(), relations: [] });
    const relationEvents: number[] = [];
    doc.getMap("relations").observe(() => relationEvents.push(doc.getMap("relations").size));
    const [first, second] = rows().relations;
    setRelationPair(doc, first, second);
    removeRelationPair(doc, first.id, second.id);
    expect(relationEvents).toEqual([2, 0]);
    expect(Object.keys(readBibleDoc(doc).tombstones)).toEqual(["rel-a", "rel-b"]);
  });
});
