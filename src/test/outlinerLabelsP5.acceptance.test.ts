/**
 * outlinerLabelsP5.acceptance.test.ts — ORCHESTRATOR-OWNED acceptance test for Wave 28 Phase 5.
 *
 * ⚠️ Implementers: DO NOT MODIFY THIS FILE. Make it pass without editing it.
 *
 * Locks the unit-testable P5 contracts:
 *   1. Q-LABELCAP (LOCKED: curated, cap = 8 hues): the label store rejects a 9th label for a project.
 *   2. reorderLabels(ids): the store reorders labels to the given id order (listLabels reflects it).
 *   3. The 8 --label-<hue>-tint design tokens exist in tokens.css (LabelBadges reads static tints,
 *      not a runtime color-mix()).
 *
 * Runtime/visual effects verified by the live CDP smoke for this phase (not here):
 *   - corkboard cards render tinted LabelBadges pills,
 *   - an empty outliner shows a quiet prompt (not blank),
 *   - the contentEditable synopsis survives a re-render mid-edit,
 *   - status dot: left-click cycles, right-click opens the menu.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { InMemoryLabelStore } from "../db/inMemoryLabelStore";
import type { LabelColor } from "../db/labelStore";

const HUES: LabelColor[] = ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"];

describe("Wave 28 P5 — label cap (Q-LABELCAP: curated, 8 hues)", () => {
  it("allows 8 labels for a project", async () => {
    const store = new InMemoryLabelStore();
    for (let i = 0; i < 8; i++) await store.createLabel("proj-1", `L${i}`, HUES[i]);
    const labels = await store.listLabels("proj-1");
    expect(labels.length).toBe(8);
  });

  it("rejects a 9th label for the same project", async () => {
    const store = new InMemoryLabelStore();
    for (let i = 0; i < 8; i++) await store.createLabel("proj-1", `L${i}`, HUES[i]);
    await expect(store.createLabel("proj-1", "ninth")).rejects.toThrow();
    expect((await store.listLabels("proj-1")).length).toBe(8);
  });

  it("the cap is per-project (a second project can still add labels)", async () => {
    const store = new InMemoryLabelStore();
    for (let i = 0; i < 8; i++) await store.createLabel("proj-1", `L${i}`, HUES[i]);
    const other = await store.createLabel("proj-2", "fresh");
    expect(other.projectId).toBe("proj-2");
    expect((await store.listLabels("proj-2")).length).toBe(1);
  });
});

describe("Wave 28 P5 — reorderLabels", () => {
  it("reorders labels to the given id order", async () => {
    const store = new InMemoryLabelStore();
    const a = await store.createLabel("proj-1", "A", "clay");
    const b = await store.createLabel("proj-1", "B", "sea");
    const c = await store.createLabel("proj-1", "C", "moss");

    await store.reorderLabels([c.id, a.id, b.id]);

    const ordered = (await store.listLabels("proj-1")).map((l) => l.name);
    expect(ordered).toEqual(["C", "A", "B"]);
  });
});

describe("Wave 28 P5 — --label-*-tint design tokens", () => {
  it("defines a static tint token for each of the 8 label hues", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    for (const hue of HUES) {
      expect(css, `tokens.css must define --label-${hue}-tint`).toContain(`--label-${hue}-tint`);
    }
  });
});
