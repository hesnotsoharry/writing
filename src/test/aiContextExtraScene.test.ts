/**
 * aiContextExtraScene — W52 Phase 2 extra-scene redaction oracle.
 *
 * Verifies that extra-scene text fed through assembleContext carries
 * AI_HIDDEN_PLACEHOLDER in place of aiExclude-marked prose.
 *
 * The redaction happens inside sqliteGetSceneText (which now calls
 * extractAiSafeText instead of extractPlainText). The mock here simulates
 * what sqliteGetSceneText returns so the assembleContext pipeline is exercised
 * without needing a live Tauri SQLite DB.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { StoryBibleStore } from "../db/storyBibleStore";
import { assembleContext, SCENE_EXCERPT_CHARS } from "../features/ai/ai.context";
import type { AiCtxConfig } from "../features/ai/ai.types";
import { AI_HIDDEN_PLACEHOLDER, extractAiSafeText } from "../yjs/serialize";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Y.Doc with plain text + an aiExclude-marked range (TipTap-style via format()). */
function makeDocWithMark(plain1: string, marked: string, plain2: string): Y.Doc {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("content");
  doc.transact(() => {
    const para = new Y.XmlElement("p");
    const xt = new Y.XmlText();
    para.push([xt]);
    frag.push([para]);
    xt.insert(0, plain1 + marked + plain2, undefined);
    xt.format(plain1.length, marked.length, { aiExclude: true });
  });
  return doc;
}

/**
 * Minimal mock: only getSceneText + loadSceneEntities + getManuscriptAbout needed.
 * getSceneText returns text already extracted via extractAiSafeText — mirrors
 * what sqliteGetSceneText now does (W52 P2 fix).
 */
function mockStoreWithExtraScene(extraId: string, doc: Y.Doc): StoryBibleStore {
  return {
    loadSceneEntities: async () => [],
    getManuscriptAbout: async () => ({ synopsis: "", genre: "", tone: "", pov: "", notes: "" }),
    getSceneText: async (id: string) => {
      if (id !== extraId) return null;
      return { title: "Extra Scene", text: extractAiSafeText(doc) };
    },
  } as unknown as StoryBibleStore;
}

function cfg(extraSceneIds: string[]): AiCtxConfig {
  return { extraSceneIds, offEntityNames: [], about: false, boundary: null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("assembleContext — extra-scene aiExclude redaction (W52 Phase 2)", () => {
  it("replaces aiExclude-marked prose in an extra scene with the placeholder", async () => {
    const doc = makeDocWithMark("Before. ", "SECRET", " After.");
    const store = mockStoreWithExtraScene("extra-1", doc);

    const ctx = await assembleContext({
      verb: "ask",
      cfg: cfg(["extra-1"]),
      sceneTitle: "Current Scene",
      sceneId: "current",
      doc: null,
      store,
      projectId: "p1",
      selectionText: null,
    });

    expect(ctx.extraScenes).toHaveLength(1);
    const excerpt = ctx.extraScenes[0].excerpt;
    expect(excerpt).toContain(AI_HIDDEN_PLACEHOLDER);
    expect(excerpt).toContain("Before.");
    expect(excerpt).toContain("After.");
    expect(excerpt).not.toContain("SECRET");
  });

  it("passes plain extra-scene text through unchanged when no marks present", async () => {
    const doc = new Y.Doc();
    const frag = doc.getXmlFragment("content");
    const para = new Y.XmlElement("p");
    const xt = new Y.XmlText();
    xt.insert(0, "Plain extra content.");
    para.push([xt]);
    frag.push([para]);

    const store = mockStoreWithExtraScene("extra-2", doc);

    const ctx = await assembleContext({
      verb: "ask",
      cfg: cfg(["extra-2"]),
      sceneTitle: "Current Scene",
      sceneId: "current",
      doc: null,
      store,
      projectId: "p1",
      selectionText: null,
    });

    expect(ctx.extraScenes).toHaveLength(1);
    expect(ctx.extraScenes[0].excerpt).toContain("Plain extra content.");
    expect(ctx.extraScenes[0].excerpt).not.toContain(AI_HIDDEN_PLACEHOLDER);
  });

  it("slices extra-scene excerpt to SCENE_EXCERPT_CHARS after redaction", async () => {
    // Marked content is short; plain content is long — slice happens post-redaction.
    const longPlain = "X".repeat(SCENE_EXCERPT_CHARS);
    const doc = makeDocWithMark("", "SECRET", longPlain);
    const store = mockStoreWithExtraScene("extra-3", doc);

    const ctx = await assembleContext({
      verb: "ask",
      cfg: cfg(["extra-3"]),
      sceneTitle: "Current Scene",
      sceneId: "current",
      doc: null,
      store,
      projectId: "p1",
      selectionText: null,
    });

    const excerpt = ctx.extraScenes[0].excerpt;
    expect(excerpt.length).toBeLessThanOrEqual(SCENE_EXCERPT_CHARS);
    expect(excerpt).not.toContain("SECRET");
  });
});
