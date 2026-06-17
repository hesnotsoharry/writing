// @vitest-environment jsdom
/**
 * brainstormAskAi.test.ts — W53 P4 unit seam
 *
 * Tests the card→AI dispatch logic from BoardCanvasBody.handleAskAi:
 *   - text-bearing card dispatches AI_ASK_FROM_EDITOR with correct text/word-count/verb
 *   - empty / whitespace-only card does NOT dispatch
 *
 * Scope: pure dispatch logic only — no React, no ReactFlow, no Tauri IPC.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { createBoardCard, gatherMultiCardText } from "../features/brainstorm/boardDoc";
import { AI_ASK_FROM_EDITOR } from "../features/settings/settings.store";

// ── Mirror of the handleAskAi logic in BoardCanvasBody ───────────────────────
// Extracted to a pure function so it can be unit-tested without rendering React.
// nodes mirrors the React Flow Node shape minimally: id + optional selected flag.

function makeAskAiHandler(doc: Y.Doc, nodes: { id: string; selected?: boolean }[] = []) {
  return (cardId: string) => {
    const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
    const effectiveIds = selectedIds.length > 1 && selectedIds.includes(cardId) ? selectedIds : [cardId];
    const text = gatherMultiCardText(doc, effectiveIds);
    if (!text.trim()) return;
    window.dispatchEvent(
      new CustomEvent(AI_ASK_FROM_EDITOR, {
        detail: { verb: "ask", sel: { text, words: text.trim().split(/\s+/).filter(Boolean).length } },
      }),
    );
  };
}

// ── Helper: insert plain text into a card's YXmlFragment ─────────────────────

function insertCardText(doc: Y.Doc, cardId: string, content: string): void {
  const frag = doc.getXmlFragment(`card-${cardId}`);
  const para = new Y.XmlElement("paragraph");
  const textNode = new Y.XmlText();
  textNode.insert(0, content);
  para.insert(0, [textNode]);
  frag.insert(0, [para]);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("handleAskAi dispatch logic", () => {
  let doc: Y.Doc;
  let dispatchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    doc = new Y.Doc();
    dispatchSpy = vi.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches AI_ASK_FROM_EDITOR with correct text and word count for a text-bearing card", () => {
    const cardId = "card-abc";
    createBoardCard(doc, cardId, { x: 0, y: 0 });
    insertCardText(doc, cardId, "The tower hummed at dusk");

    const handler = makeAskAiHandler(doc);
    handler(cardId);

    expect(dispatchSpy).toHaveBeenCalledOnce();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe(AI_ASK_FROM_EDITOR);
    expect(event.detail.verb).toBe("ask");
    expect(event.detail.sel.text).toBe("The tower hummed at dusk");
    expect(event.detail.sel.words).toBe(5);
  });

  it("does NOT dispatch when the card has no text (empty fragment)", () => {
    const cardId = "card-empty";
    createBoardCard(doc, cardId, { x: 0, y: 0 });
    // No insertCardText call — fragment is empty

    const handler = makeAskAiHandler(doc);
    handler(cardId);

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("does NOT dispatch when the card contains only whitespace", () => {
    const cardId = "card-whitespace";
    createBoardCard(doc, cardId, { x: 0, y: 0 });
    insertCardText(doc, cardId, "   \n  ");

    const handler = makeAskAiHandler(doc);
    handler(cardId);

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("counts words correctly for multi-word text", () => {
    const cardId = "card-multi";
    createBoardCard(doc, cardId, { x: 0, y: 0 });
    insertCardText(doc, cardId, "one two three");

    const handler = makeAskAiHandler(doc);
    handler(cardId);

    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.sel.words).toBe(3);
    expect(event.detail.sel.text).toBe("one two three");
  });

  // ── Multi-card selection cases (W53 P4 extension) ─────────────────────────

  it("concatenates 3 selected cards with separator when right-clicking a selected card", () => {
    const ids = ["c1", "c2", "c3"];
    ids.forEach((id) => createBoardCard(doc, id, { x: 0, y: 0 }));
    insertCardText(doc, "c1", "First card");
    insertCardText(doc, "c2", "Second card");
    insertCardText(doc, "c3", "Third card");

    const nodes = ids.map((id) => ({ id, selected: true }));
    const handler = makeAskAiHandler(doc, nodes);
    handler("c1"); // right-click on c1, which is in the selection

    expect(dispatchSpy).toHaveBeenCalledOnce();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.sel.text).toBe("First card\n\n---\n\nSecond card\n\n---\n\nThird card");
    // word-count splits on whitespace: 6 content words + 2 "---" separator tokens = 8
    expect(event.detail.sel.words).toBe(8);
    expect(event.detail.verb).toBe("ask");
  });

  it("falls back to single-card when right-clicked card is NOT in the selection", () => {
    createBoardCard(doc, "other-a", { x: 0, y: 0 });
    createBoardCard(doc, "other-b", { x: 0, y: 0 });
    createBoardCard(doc, "target", { x: 0, y: 0 });
    insertCardText(doc, "other-a", "Selected A");
    insertCardText(doc, "other-b", "Selected B");
    insertCardText(doc, "target", "Right-clicked but not selected");

    // other-a and other-b are selected; target is not
    const nodes = [
      { id: "other-a", selected: true },
      { id: "other-b", selected: true },
      { id: "target", selected: false },
    ];
    const handler = makeAskAiHandler(doc, nodes);
    handler("target");

    expect(dispatchSpy).toHaveBeenCalledOnce();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.sel.text).toBe("Right-clicked but not selected");
    expect(event.detail.sel.words).toBe(4);
  });

  it("does NOT dispatch when all selected cards are empty", () => {
    const ids = ["empty-a", "empty-b"];
    ids.forEach((id) => createBoardCard(doc, id, { x: 0, y: 0 }));
    // no insertCardText — both fragments are empty

    const nodes = ids.map((id) => ({ id, selected: true }));
    const handler = makeAskAiHandler(doc, nodes);
    handler("empty-a");

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("falls back to single-card when only one card is selected (even if that card is the right-clicked one)", () => {
    createBoardCard(doc, "solo", { x: 0, y: 0 });
    insertCardText(doc, "solo", "Solo card text");

    // Only one selected node — effectiveIds = [id], same as no-selection path
    const nodes = [{ id: "solo", selected: true }];
    const handler = makeAskAiHandler(doc, nodes);
    handler("solo");

    expect(dispatchSpy).toHaveBeenCalledOnce();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.sel.text).toBe("Solo card text");
  });
});
