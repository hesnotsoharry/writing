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

import { createBoardCard, getCardText } from "../features/brainstorm/boardDoc";
import { AI_ASK_FROM_EDITOR } from "../features/settings/settings.store";

// ── Mirror of the handleAskAi logic in BoardCanvasBody ───────────────────────
// Extracted to a pure function so it can be unit-tested without rendering React.

function makeAskAiHandler(doc: Y.Doc) {
  return (cardId: string) => {
    const t = getCardText(doc, cardId);
    if (!t.trim()) return;
    window.dispatchEvent(
      new CustomEvent(AI_ASK_FROM_EDITOR, {
        detail: { verb: "ask", sel: { text: t, words: t.trim().split(/\s+/).filter(Boolean).length } },
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
});
