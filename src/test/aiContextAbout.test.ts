/**
 * Pre-implementation oracle test for manuscript About persistence.
 *
 * Contract: after `store.setManuscriptAbout(projectId, about)`, the About
 * data must be retrievable via `getManuscriptAbout(projectId)` AND must be
 * included in `assembleContext` when the about toggle is enabled.
 *
 * This test FAILS now (setManuscriptAbout does not exist) and will PASS
 * once the write path is implemented.
 */
import { describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import { assembleContext } from "../features/ai/ai.context";
import type { ManuscriptAbout } from "../features/ai/ai.types";
import { EMPTY_ABOUT } from "../features/ai/ai.types";

describe("Manuscript About persistence (oracle: pre-impl)", () => {
  it("round-trip: store.setManuscriptAbout persists and retrieves the About object", async () => {
    // ARRANGE
    const store = new InMemoryStoryBibleStore();
    const projectId = "proj-1";
    const about: ManuscriptAbout = {
      synopsis: "A story about time and tide",
      genre: "Literary Fiction",
      tone: "Melancholic, introspective",
      pov: "Third person limited",
      notes: "Inspired by coastal mythology",
    };

    // ACT
    await store.setManuscriptAbout(projectId, about);
    const retrieved = await store.getManuscriptAbout(projectId);

    // ASSERT
    expect(retrieved).toEqual(about);
  });

  it("missing project returns EMPTY_ABOUT (not undefined)", async () => {
    // ARRANGE
    const store = new InMemoryStoryBibleStore();
    const nonexistentProjectId = "proj-never-written";

    // ACT
    const result = await store.getManuscriptAbout(nonexistentProjectId);

    // ASSERT
    expect(result).toEqual(EMPTY_ABOUT);
  });

  it("injected into assembleContext when about toggle is on and About has been written", async () => {
    // ARRANGE
    const store = new InMemoryStoryBibleStore();
    const projectId = "proj-2";
    const distinctSynopsis = "The lighthouse keeper remembers when the sea forgot her";
    const about: ManuscriptAbout = {
      synopsis: distinctSynopsis,
      genre: "Literary Fiction",
      tone: "Reflective",
      pov: "First person",
      notes: "A meditation on memory and place",
    };

    // Persist the About to the store
    await store.setManuscriptAbout(projectId, about);

    // ACT
    const assembled = await assembleContext({
      verb: "brainstorm",
      cfg: { extraSceneIds: [], offEntityNames: [], about: true, boundary: null },
      sceneTitle: "Opening",
      sceneId: null,
      doc: null,
      store,
      projectId,
      selectionText: null,
    });

    // ASSERT
    // The about field in AssembledContext must contain the written About, not EMPTY_ABOUT.
    expect(assembled.about).not.toEqual(EMPTY_ABOUT);
    expect(assembled.about?.synopsis).toBe(distinctSynopsis);
    expect(assembled.about?.genre).toBe("Literary Fiction");
  });

  it("excluded from assembleContext when about toggle is off", async () => {
    // ARRANGE
    const store = new InMemoryStoryBibleStore();
    const projectId = "proj-3";
    const about: ManuscriptAbout = {
      synopsis: "Should not appear",
      genre: "Horror",
      tone: "Dark",
      pov: "Omniscient",
      notes: "Exclusion test",
    };

    await store.setManuscriptAbout(projectId, about);

    // ACT
    const assembled = await assembleContext({
      verb: "brainstorm",
      cfg: { extraSceneIds: [], offEntityNames: [], about: false, boundary: null },
      sceneTitle: "Scene A",
      sceneId: null,
      doc: null,
      store,
      projectId,
      selectionText: null,
    });

    // ASSERT
    // When about toggle is false, the assembled context's about field should be null
    expect(assembled.about).toBeNull();
  });
});
