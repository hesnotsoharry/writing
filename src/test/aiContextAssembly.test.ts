import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import type { StoryBibleStore } from "../db/storyBibleStore";
import { assembleContext, SCENE_EXCERPT_CHARS } from "../features/ai/ai.context";
import type { AiCtxConfig } from "../features/ai/ai.types";

// Orchestrator-authored Phase E acceptance test (Wave 35). Implementer extends
// src/features/ai/ai.context.ts with `assembleContext(input)` and may NOT modify
// this file. LOCKED ARCHITECTURE (Decision): both exclusion filters —
// `entities.exclude_from_ai` (persistent shield) AND per-ask `cfg.offEntityNames`
// — are applied INSIDE assembleContext, not silently in the store. The store
// returns raw entities (with the exclude_from_ai flag surfaced); assembleContext
// is the single auditable place where shielded/off entities are dropped before
// anything is sent to the proxy (D4 privacy guarantee).

const ABOUT = {
  synopsis: "A keeper guards a tidal causeway.",
  genre: "literary",
  tone: "quiet",
  pov: "first",
  notes: "UK spelling.",
};

// Minimal StoryBibleStore mock: only the methods assembleContext consumes.
// `exclude_from_ai` is surfaced raw on each entity; assembleContext does the filtering.
function mockStore(): StoryBibleStore {
  const groups = [
    {
      type: "character",
      entities: [
        { id: "e1", projectId: "p1", type: "character", name: "Maren", notes: "the keeper", aliases: null, exclude_from_ai: false },
        { id: "e2", projectId: "p1", type: "character", name: "Tomas", notes: "the boatman", aliases: null, exclude_from_ai: false },
        { id: "e3", projectId: "p1", type: "character", name: "SecretTwin", notes: "spoiler entity", aliases: null, exclude_from_ai: true },
      ],
    },
  ];
  return {
    loadSceneEntities: async () => groups,
    getManuscriptAbout: async () => ABOUT,
  } as unknown as StoryBibleStore;
}

function baseInput(cfg: Partial<AiCtxConfig>, extra?: Record<string, unknown>) {
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
    store: mockStore(),
    projectId: "p1",
    selectionText: null,
    ...extra,
  };
}

describe("assembleContext — entity exclusion (D4 privacy guarantee)", () => {
  it("drops entities flagged exclude_from_ai from the assembled context", async () => {
    const ctx = await assembleContext(baseInput({}));
    const names = ctx.entitySummaries.map((e) => e.name);
    expect(names).toContain("Maren");
    expect(names).toContain("Tomas");
    // The shielded entity must never reach the assembled context (nothing
    // about it is sent to the proxy).
    expect(names).not.toContain("SecretTwin");
    const serialized = JSON.stringify(ctx);
    expect(serialized).not.toContain("SecretTwin");
    expect(serialized).not.toContain("spoiler entity");
  });

  it("drops per-ask off-entities named in cfg.offEntityNames", async () => {
    const ctx = await assembleContext(baseInput({ offEntityNames: ["Tomas"] }));
    const names = ctx.entitySummaries.map((e) => e.name);
    expect(names).toContain("Maren");
    expect(names).not.toContain("Tomas");
    // exclude_from_ai still applies on top of the per-ask filter.
    expect(names).not.toContain("SecretTwin");
  });
});

describe("assembleContext — About this manuscript", () => {
  it("includes About fields when cfg.about is true", async () => {
    const ctx = await assembleContext(baseInput({ about: true }));
    expect(ctx.about).not.toBeNull();
    expect(ctx.about?.synopsis).toBe(ABOUT.synopsis);
    expect(ctx.about?.genre).toBe(ABOUT.genre);
  });

  it("omits About when cfg.about is false", async () => {
    const ctx = await assembleContext(baseInput({ about: false }));
    expect(ctx.about).toBeNull();
  });
});

describe("assembleContext — selection", () => {
  it("includes selection text when one is attached", async () => {
    const ctx = await assembleContext(baseInput({}, { selectionText: "the tide came in fast" }));
    expect(ctx.selectionText).toBe("the tide came in fast");
  });

  it("selectionText is null when nothing is attached", async () => {
    const ctx = await assembleContext(baseInput({}));
    expect(ctx.selectionText).toBeNull();
  });
});

describe("assembleContext — spoiler boundary", () => {
  it("emits a boundary line naming the chapter when cfg.boundary is set", async () => {
    const ctx = await assembleContext(baseInput({ boundary: "ch-12" }));
    expect(ctx.boundaryLine).not.toBeNull();
    // The line must instruct the model to behave as if it has not read past
    // the boundary chapter (exact wording is the implementer's, but it must
    // reference the boundary).
    expect(ctx.boundaryLine).toContain("ch-12");
  });

  it("boundaryLine is null when no boundary is set", async () => {
    const ctx = await assembleContext(baseInput({ boundary: null }));
    expect(ctx.boundaryLine).toBeNull();
  });
});

describe("assembleContext — scene identity", () => {
  it("carries the open scene title through", async () => {
    const ctx = await assembleContext(baseInput({}));
    expect(ctx.sceneTitle).toBe("Chapter One");
  });
});

// ── Wave 37 Phase 2 — sceneExcerptTruncated flag ──────────────────────────────

/** Build a Y.Doc with a single paragraph containing `text`. */
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

describe("assembleContext — sceneExcerptTruncated (Wave 37 P2)", () => {
  it("sets sceneExcerptTruncated to true when scene text exceeds SCENE_EXCERPT_CHARS", async () => {
    const doc = makeDocWithText("A".repeat(SCENE_EXCERPT_CHARS + 1));
    const ctx = await assembleContext(baseInput({}, { doc }));
    expect(ctx.sceneExcerptTruncated).toBe(true);
  });

  it("sets sceneExcerptTruncated to false when scene text is exactly SCENE_EXCERPT_CHARS", async () => {
    const doc = makeDocWithText("A".repeat(SCENE_EXCERPT_CHARS));
    const ctx = await assembleContext(baseInput({}, { doc }));
    expect(ctx.sceneExcerptTruncated).toBe(false);
  });

  it("sets sceneExcerptTruncated to false when scene text is shorter than the cap", async () => {
    const doc = makeDocWithText("Short scene.");
    const ctx = await assembleContext(baseInput({}, { doc }));
    expect(ctx.sceneExcerptTruncated).toBe(false);
  });

  it("sets sceneExcerptTruncated to false when doc is null (empty scene)", async () => {
    const ctx = await assembleContext(baseInput({}));
    expect(ctx.sceneExcerptTruncated).toBe(false);
  });
});
