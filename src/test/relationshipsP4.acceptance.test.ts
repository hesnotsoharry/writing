/**
 * relationshipsP4.acceptance.test.ts — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 4.
 *
 * ⚠️ Implementers: DO NOT MODIFY THIS FILE. Make it pass without editing it.
 *
 * Locks two of P4's contracts at the unit boundary:
 *   1. Q-PRESETS (LOCKED): RELATION_PRESETS gains per-type vocabularies (not just the '*' catch-all),
 *      with '*' still serving as the fallback for custom types.
 *   2. allRelations alias: the StoryBibleStore exposes allRelations(projectId) returning every relation
 *      for the project (spec surface; delegates to listRelations without an entityId).
 *
 * The remaining P4 effects are runtime/visual and verified by the live CDP smoke for this phase:
 *   - exactly ONE relationships section in the Full Entry (PeopleGroup dropped, RelationshipGroup canon),
 *   - the breadcrumb root returns to the Story Bible (already wired on this branch — smoke confirms),
 *   - editing an edge label then reopening the RelationshipMap shows the new label (useMemo reactivity).
 */
import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import { getPresetsForType, RELATION_PRESETS } from "../db/storyBibleStore";

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
    // Parity with listRelations(projectId) (no entityId).
    const viaList = await store.listRelations("proj-1");
    expect(all).toEqual(viaList);
  });
});
