import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { StoryBibleStore } from "../db/storyBibleStore";
import { assembleContext } from "../features/ai/ai.context";
import type { AiCtxConfig } from "../features/ai/ai.types";

// Pre-impl oracle test (Wave TBD) — pins the contract for scene-level exclude-from-AI.
// Implementer MUST add `getSceneExcludedFromAi(sceneId: string): Promise<boolean>` to
// StoryBibleStore and modify assembleContext to apply it (replacing sceneExcerpt with
// the placeholder when true). This test SHOULD FAIL today — that is correct.
// CONTRACT: when a scene is excluded, sceneExcerpt must be EXACTLY "[this scene was
// withheld by the author]" — not truncated, not decorated, not leaked with any real prose.

const SCENE_EXCLUDE_PLACEHOLDER = "[this scene was withheld by the author]";

/** Build a minimal mock store with scene exclusion support. */
function mockStoreWithExclusions(
  excludedSceneIds: Set<string> = new Set(),
  extraSceneExclusions: Record<string, boolean> = {},
): StoryBibleStore {
  return {
    loadSceneEntities: async () => [],
    getManuscriptAbout: async () => ({
      synopsis: "",
      genre: "",
      tone: "",
      pov: "",
      notes: "",
    }),
    getSceneExcludedFromAi: async (sceneId: string) => {
      return excludedSceneIds.has(sceneId) || (extraSceneExclusions[sceneId] === true);
    },
    getSceneText: async (sceneId: string) => {
      // Mock always returns real text; it's assembleContext's job to check
      // getSceneExcludedFromAi and apply the placeholder if needed.
      return {
        title: `Scene ${sceneId}`,
        text: `Content of scene ${sceneId}. This is the real prose that must not leak if excluded.`,
      };
    },
  } as unknown as StoryBibleStore;
}

/** Assemble a minimal base input for testing scene exclusion. */
function baseInput(
  cfg: Partial<AiCtxConfig>,
  extra?: Record<string, unknown>,
) {
  const fullCfg: AiCtxConfig = {
    extraSceneIds: [],
    offEntityNames: [],
    about: false,
    boundary: null,
    ...cfg,
  };
  return {
    verb: "brainstorm" as const,
    cfg: fullCfg,
    sceneTitle: "Chapter One",
    sceneId: "s1",
    doc: null,
    store: mockStoreWithExclusions(),
    projectId: "p1",
    selectionText: null,
    ...extra,
  };
}

/** Build a Y.Doc with a single paragraph containing text. */
function makeDocWithText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  const para = new Y.XmlElement("paragraph");
  const xt = new Y.XmlText();
  xt.insert(0, text);
  para.insert(0, [xt]);
  frag.insert(0, [para]);
  return doc;
}

describe("assembleContext — scene-level exclude-from-AI (Wave TBD)", () => {
  it("includes real scene prose when sceneId is not excluded (control)", async () => {
    const proseText = "The secret tower hummed with ancient power.";
    const doc = makeDocWithText(proseText);
    const store = mockStoreWithExclusions(new Set()); // No exclusions
    const input = baseInput({}, { doc, store, sceneId: "s1" });

    const ctx = await assembleContext(input);

    // The real prose must be present in the assembled context.
    expect(ctx.sceneExcerpt).toContain("secret tower");
    expect(ctx.sceneExcerpt).toContain("ancient power");
    // And it must NOT be replaced with the placeholder.
    expect(ctx.sceneExcerpt).not.toBe(SCENE_EXCLUDE_PLACEHOLDER);
  });

  it("replaces scene prose with placeholder when sceneId is excluded", async () => {
    const proseText = "The secret tower hummed with ancient power.";
    const doc = makeDocWithText(proseText);
    const store = mockStoreWithExclusions(new Set(["s1"])); // s1 is excluded
    const input = baseInput({}, { doc, store, sceneId: "s1" });

    const ctx = await assembleContext(input);

    // The sceneExcerpt MUST be EXACTLY the placeholder — no real prose leaked.
    expect(ctx.sceneExcerpt).toBe(SCENE_EXCLUDE_PLACEHOLDER);
    expect(ctx.sceneExcerpt).not.toContain("secret tower");
    expect(ctx.sceneExcerpt).not.toContain("ancient power");
  });

  it("replaces extra-scene excerpt with placeholder when that scene is excluded", async () => {
    const doc = makeDocWithText("Main scene text.");
    const store = mockStoreWithExclusions(
      new Set(), // Main scene not excluded
      { extra1: true }, // But extra1 IS excluded
    );
    const input = baseInput(
      { extraSceneIds: ["extra1"] },
      { doc, store, sceneId: "s1" },
    );

    const ctx = await assembleContext(input);

    // The main scene excerpt should be normal.
    expect(ctx.sceneExcerpt).toContain("Main scene text");
    // The extra scene's excerpt must be the placeholder.
    expect(ctx.extraScenes).toHaveLength(1);
    expect(ctx.extraScenes[0].excerpt).toBe(SCENE_EXCLUDE_PLACEHOLDER);
    expect(ctx.extraScenes[0].excerpt).not.toContain("Content of scene extra1");
  });

  it("does not throw and does not call getSceneExcludedFromAi when sceneId is null", async () => {
    const doc = makeDocWithText("Some text.");
    const store = mockStoreWithExclusions(new Set()); // Track calls
    let wasCalledWithNull = false;

    // Wrap the mock to detect null calls (should never happen).
    const originalGetExcluded = store.getSceneExcludedFromAi;
    store.getSceneExcludedFromAi = async (sceneId: string) => {
      if (sceneId === null || sceneId === "") {
        wasCalledWithNull = true;
      }
      return originalGetExcluded!(sceneId);
    };

    const input = baseInput({}, { doc, store, sceneId: null });

    // Should not throw.
    const ctx = await assembleContext(input);

    // Must not have called getSceneExcludedFromAi with null/empty.
    expect(wasCalledWithNull).toBe(false);
    // The context should assemble gracefully with null sceneId.
    expect(ctx).toBeDefined();
  });

  it("does not leak excluded scene prose in serialized context", async () => {
    const proseText = "CLASSIFIED: The emperor's real name is Aldous Sneetches.";
    const doc = makeDocWithText(proseText);
    const store = mockStoreWithExclusions(new Set(["s1"])); // Excluded
    const input = baseInput({}, { doc, store, sceneId: "s1" });

    const ctx = await assembleContext(input);

    // Serialize the entire context and ensure the classified prose is not present.
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain("CLASSIFIED");
    expect(serialized).not.toContain("Aldous Sneetches");
    // Only the placeholder should appear.
    expect(serialized).toContain(SCENE_EXCLUDE_PLACEHOLDER);
  });
});
