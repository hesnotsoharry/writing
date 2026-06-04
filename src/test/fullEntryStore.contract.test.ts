// ORCHESTRATOR-OWNED ACCEPTANCE TEST (Wave 24, Phase 1 — Full Entry store seam).
// Locks the additive StoryBibleStore contract: getEntity, entity_fields CRUD (with the
// dedup invariant that is the load-bearing fix for the attack-decision BLOCK), entity_links
// directional CRUD (+ dedup), portrait path get/set/clear, and delete-cascade across both
// new tables. Runs against InMemoryStoryBibleStore only — per the existing pattern.
//
// The implementer MUST make this pass and MAY NOT modify this file. The two "exactly one row
// after a repeated write" cases are the dedup contract: a UUID-PK INSERT OR IGNORE is inert,
// so the impl must enforce uniqueness on the LOGICAL key (entity_fields: entity_id+kind+key;
// entity_links: from_id+to_id). See roadmap/wave-24-full-entry.md Locked Decisions 1 & 2.
import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/storyBibleStore";

describe("Full Entry store contract (Wave 24)", () => {
  // ── getEntity ────────────────────────────────────────────────────────────
  it("getEntity returns the entity with portraitPath null for a fresh character", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("proj-1", "Maren", "notes here");

    const got = await store.getEntity("character", char.id);

    expect(got).not.toBeNull();
    expect(got).toMatchObject({
      id: char.id,
      projectId: "proj-1",
      type: "character",
      name: "Maren",
      notes: "notes here",
      portraitPath: null,
    });
  });

  it("getEntity returns null for an unknown id", async () => {
    const store = new InMemoryStoryBibleStore();
    expect(await store.getEntity("character", "nope")).toBeNull();
  });

  // ── entity_fields ────────────────────────────────────────────────────────
  it("setEntityField then getEntityFields returns the stored value", async () => {
    const store = new InMemoryStoryBibleStore();
    const c = await store.createCharacter("proj-1", "Maren", null);

    await store.setEntityField(c.id, "fact", "Age", "34");

    const fields = await store.getEntityFields(c.id);
    const age = fields.find((f) => f.kind === "fact" && f.key === "Age");
    expect(age?.value).toBe("34");
  });

  it("setEntityField is an UPSERT — a repeated write on the same (entity,kind,key) leaves EXACTLY ONE row", async () => {
    const store = new InMemoryStoryBibleStore();
    const c = await store.createCharacter("proj-1", "Maren", null);

    await store.setEntityField(c.id, "section", "backstory", "first");
    await store.setEntityField(c.id, "section", "backstory", "second");
    await store.setEntityField(c.id, "section", "backstory", "third");

    const matching = (await store.getEntityFields(c.id)).filter(
      (f) => f.kind === "section" && f.key === "backstory"
    );
    expect(matching).toHaveLength(1);
    expect(matching[0].value).toBe("third");
  });

  it("the same key under different kinds does NOT collide (kind is part of the logical key)", async () => {
    const store = new InMemoryStoryBibleStore();
    const c = await store.createCharacter("proj-1", "Maren", null);

    await store.setEntityField(c.id, "fact", "history", "a fact");
    await store.setEntityField(c.id, "section", "history", "a section");

    const fields = await store.getEntityFields(c.id);
    expect(fields.filter((f) => f.key === "history")).toHaveLength(2);
  });

  it("addEntityField creates a new empty custom field and returns it; deleteEntityField removes it", async () => {
    const store = new InMemoryStoryBibleStore();
    const c = await store.createCharacter("proj-1", "Maren", null);

    const created = await store.addEntityField(c.id, "fact", "Hometown");
    expect(created.entityId).toBe(c.id);
    expect(created.key).toBe("Hometown");
    expect(created.value).toBe("");
    expect(typeof created.id).toBe("string");

    await store.deleteEntityField(created.id);
    expect((await store.getEntityFields(c.id)).find((f) => f.id === created.id)).toBeUndefined();
  });

  // ── entity_links (directional) ─────────────────────────────────────────────
  it("addLink then listLinksFor(from) round-trips the directional link", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "Maren", null);
    const b = await store.createCharacter("proj-1", "Edda", null);

    const link = await store.addLink(a.id, b.id, "Grandmother");

    expect(link.fromId).toBe(a.id);
    expect(link.toId).toBe(b.id);
    expect(link.relation).toBe("Grandmother");

    const fromA = await store.listLinksFor(a.id);
    expect(fromA).toHaveLength(1);
    expect(fromA[0].toId).toBe(b.id);
    // Directional: the reverse direction is not implied.
    expect(await store.listLinksFor(b.id)).toHaveLength(0);
  });

  it("addLink is dedup-safe — a repeated (from,to) leaves EXACTLY ONE row", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "Maren", null);
    const b = await store.createCharacter("proj-1", "Edda", null);

    await store.addLink(a.id, b.id, "Grandmother");
    await store.addLink(a.id, b.id, "Grandmother");

    expect(await store.listLinksFor(a.id)).toHaveLength(1);
  });

  it("updateLinkRelation changes the label; removeLink deletes the link", async () => {
    const store = new InMemoryStoryBibleStore();
    const a = await store.createCharacter("proj-1", "Maren", null);
    const b = await store.createCharacter("proj-1", "Tomas", null);

    const link = await store.addLink(a.id, b.id, "Ally");
    await store.updateLinkRelation(link.id, "Wary ally");
    expect((await store.listLinksFor(a.id))[0].relation).toBe("Wary ally");

    await store.removeLink(link.id);
    expect(await store.listLinksFor(a.id)).toHaveLength(0);
  });

  // ── portrait ───────────────────────────────────────────────────────────────
  it("setPortrait then getEntity returns the path; clearPortrait resets it to null", async () => {
    const store = new InMemoryStoryBibleStore();
    const c = await store.createCharacter("proj-1", "Maren", null);

    await store.setPortrait("character", c.id, "/data/portraits/x.jpg");
    expect((await store.getEntity("character", c.id))?.portraitPath).toBe("/data/portraits/x.jpg");

    await store.clearPortrait("character", c.id);
    expect((await store.getEntity("character", c.id))?.portraitPath).toBeNull();
  });

  // ── delete-cascade across the new tables ────────────────────────────────────
  it("deleteEntity purges the entity's fields AND all links referencing it (from_id OR to_id)", async () => {
    const store = new InMemoryStoryBibleStore();
    const doomed = await store.createCharacter("proj-1", "Doomed", null);
    const other = await store.createCharacter("proj-1", "Other", null);

    await store.setEntityField(doomed.id, "fact", "Age", "40");
    await store.addLink(doomed.id, other.id, "knows"); // doomed as from
    await store.addLink(other.id, doomed.id, "knows"); // doomed as to

    await store.deleteEntity("character", doomed.id);

    expect(await store.getEntityFields(doomed.id)).toHaveLength(0);
    expect(await store.listLinksFor(doomed.id)).toHaveLength(0);
    // The link that pointed AT doomed (from `other`) must also be gone.
    expect(await store.listLinksFor(other.id)).toHaveLength(0);
  });

  // ── addEntityField idempotency + reorder (panel-flag coverage, Wave 24 Phase 1) ──
  it("addEntityField is idempotent on a duplicate (entity,kind,key) — returns the existing row, never clobbers its value or creates a second row", async () => {
    const store = new InMemoryStoryBibleStore();
    const c = await store.createCharacter("proj-1", "Maren", null);

    const first = await store.addEntityField(c.id, "fact", "Age");
    await store.setEntityField(c.id, "fact", "Age", "34");
    const second = await store.addEntityField(c.id, "fact", "Age");

    expect(second.id).toBe(first.id);
    const ageRows = (await store.getEntityFields(c.id)).filter(
      (f) => f.kind === "fact" && f.key === "Age"
    );
    expect(ageRows).toHaveLength(1);
    expect(ageRows[0].value).toBe("34"); // must NOT be reset to ""
  });

  it("reorderEntityFields updates the sort value for each given id", async () => {
    const store = new InMemoryStoryBibleStore();
    const c = await store.createCharacter("proj-1", "Maren", null);
    const a = await store.addEntityField(c.id, "fact", "Age");
    const b = await store.addEntityField(c.id, "fact", "Job");

    await store.reorderEntityFields([
      { id: a.id, sort: 5 },
      { id: b.id, sort: 2 },
    ]);

    const fields = await store.getEntityFields(c.id);
    expect(fields.find((f) => f.id === a.id)?.sort).toBe(5);
    expect(fields.find((f) => f.id === b.id)?.sort).toBe(2);
  });
});
