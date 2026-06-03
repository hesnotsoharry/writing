import { describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { InMemorySceneDocStore } from "../db/sceneDocStore";
import { bindPersistence } from "../yjs/bindPersistence";
import { applyEncoded } from "../yjs/serialize";

/**
 * Phase 2 acceptance test (orchestrator-authored — boundary contract).
 *
 * Contract: saving a scene must persist a plaintext projection of the scene's
 * prose alongside the encoded Y.Doc state, extracted from the editor's real
 * storage type — a Y.XmlFragment named "content" (TipTap Collaboration
 * `field: "content"` → `doc.getXmlFragment("content")`). The save path has NO
 * mounted editor, so extraction reads the Y.Doc directly.
 *
 * Guard: an empty extracted projection must NOT overwrite an existing non-empty
 * projection (protects against a transient empty read at scene-open).
 */

/** Build a Y.Doc whose "content" XmlFragment holds the given paragraphs. */
function docWithParagraphs(paragraphs: string[]): Y.Doc {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("content");
  paragraphs.forEach((line, i) => {
    const p = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, line);
    p.insert(0, [text]);
    fragment.insert(i, [p]);
  });
  return doc;
}

describe("scene plaintext projection (save path)", () => {
  it("writes the scene's plaintext to the store on save, extracted from the XmlFragment", async () => {
    vi.useFakeTimers();
    const store = new InMemorySceneDocStore();
    const doc = docWithParagraphs([
      "Mara stood at the salt road.",
      "Thornfield waited to the north.",
    ]);

    const unbind = bindPersistence(doc, "scene-1", store, { debounceMs: 500 });
    // bindPersistence schedules an initial save at bind time; a real edit
    // reschedules it. Nudge a transaction to exercise the debounced path.
    doc.transact(() => {
      const frag = doc.getXmlFragment("content");
      const p = frag.firstChild as Y.XmlElement;
      (p.firstChild as Y.XmlText).insert(0, "");
    });
    await vi.advanceTimersByTimeAsync(500);

    expect(await store.loadProjection("scene-1")).toBe(
      "Mara stood at the salt road.\nThornfield waited to the north."
    );

    unbind();
    vi.useRealTimers();
  });

  it("round-trips the encoded Y.Doc state independently of the projection", async () => {
    vi.useFakeTimers();
    const store = new InMemorySceneDocStore();
    const doc = docWithParagraphs(["Only line."]);

    const unbind = bindPersistence(doc, "scene-2", store, { debounceMs: 500 });
    doc.transact(() => {
      const frag = doc.getXmlFragment("content");
      const p = frag.firstChild as Y.XmlElement;
      (p.firstChild as Y.XmlText).insert(0, "");
    });
    await vi.advanceTimersByTimeAsync(500);

    const restored = new Y.Doc();
    applyEncoded(restored, (await store.load("scene-2"))!);
    const restoredText = (
      restored.getXmlFragment("content").firstChild as Y.XmlElement
    ).firstChild as Y.XmlText;
    expect(restoredText.toString()).toBe("Only line.");

    unbind();
    vi.useRealTimers();
  });
});

describe("scene plaintext projection (empty-projection guard, store contract)", () => {
  it("an empty/null projection does not overwrite an existing non-empty projection", async () => {
    const store = new InMemorySceneDocStore();
    // First save establishes a non-empty projection.
    await store.save("scene-3", "base64-a", "Established prose.");
    expect(await store.loadProjection("scene-3")).toBe("Established prose.");

    // A subsequent save with a null projection updates state but keeps prose.
    await store.save("scene-3", "base64-b", null);
    expect(await store.load("scene-3")).toBe("base64-b");
    expect(await store.loadProjection("scene-3")).toBe("Established prose.");
  });

  it("a provided projection overwrites the previous one", async () => {
    const store = new InMemorySceneDocStore();
    await store.save("scene-4", "b1", "first");
    await store.save("scene-4", "b2", "second");
    expect(await store.loadProjection("scene-4")).toBe("second");
  });
});
