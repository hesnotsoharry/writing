// @vitest-environment jsdom
/**
 * brainstormAddCard.test.ts — W53 P5 integration seam
 *
 * Tests the AI-reply-to-card flow: BRAINSTORM_ADD_CARD event → new card in Yjs doc.
 *   - Dispatching BRAINSTORM_ADD_CARD with reply text creates a new board card
 *   - Card content is persisted to the Yjs doc via plainTextToCardFragment
 *   - Empty / whitespace-only replies do NOT create a card
 *   - Multi-line replies preserve line breaks (blank lines filtered)
 *
 * Scope: pure mutation logic only — test createBoardCard + plainTextToCardFragment
 * as invoked from the useBrainstormAddCard handler. Position calculation is stubbed
 * to a fixed value since it depends on browser geometry (not relevant to the mutation seam).
 */
import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";

import { createBoardCard, getCardText, plainTextToCardFragment } from "../features/brainstorm/boardDoc";

// ── Mirror of the useBrainstormAddCard handler logic ──────────────────────────
// Extracted to a pure function so it can be tested without React or window events.

function createCardFromAiReply(
  doc: Y.Doc,
  cardId: string,
  pos: { x: number; y: number },
  text: string,
): void {
  if (!text?.trim()) return;
  doc.transact(() => {
    createBoardCard(doc, cardId, pos);
    plainTextToCardFragment(doc, cardId, text);
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BRAINSTORM_ADD_CARD event → Yjs doc mutation", () => {
  let doc: Y.Doc;
  const fixedPos = { x: 100, y: 100 };

  beforeEach(() => {
    doc = new Y.Doc();
  });

  it("creates a card with reply text when given non-empty input", () => {
    const cardId = "reply-abc";
    const replyText = "This character feels lost because she cannot find her purpose";

    createCardFromAiReply(doc, cardId, fixedPos, replyText);

    // Verify card metadata exists in the map
    const cards = doc.getMap("cards");
    expect(cards.has(cardId)).toBe(true);
    const meta = cards.get(cardId) as Record<string, unknown>;
    expect(meta.x).toBe(100);
    expect(meta.y).toBe(100);

    // Verify card text was persisted to the fragment
    const retrievedText = getCardText(doc, cardId);
    expect(retrievedText).toBe(replyText);
  });

  it("does NOT create a card when reply text is empty", () => {
    const cardId = "reply-empty";

    createCardFromAiReply(doc, cardId, fixedPos, "");

    const cards = doc.getMap("cards");
    expect(cards.has(cardId)).toBe(false);
  });

  it("does NOT create a card when reply text is only whitespace", () => {
    const cardId = "reply-ws";

    createCardFromAiReply(doc, cardId, fixedPos, "   \n  \t  ");

    const cards = doc.getMap("cards");
    expect(cards.has(cardId)).toBe(false);
  });

  it("preserves multi-line replies with blank lines filtered out", () => {
    const cardId = "reply-multiline";
    const replyText = "Line one\n\nLine two\n  \nLine three";

    createCardFromAiReply(doc, cardId, fixedPos, replyText);

    const retrievedText = getCardText(doc, cardId);
    expect(retrievedText).toBe("Line one\nLine two\nLine three");
  });

  it("creates a card with correct position from the ai reply", () => {
    const cardId = "reply-pos";
    const pos = { x: 250, y: 350 };

    createCardFromAiReply(doc, cardId, pos, "Reply text for a new card");

    const cards = doc.getMap("cards");
    const meta = cards.get(cardId) as Record<string, unknown>;
    expect(meta.x).toBe(250);
    expect(meta.y).toBe(350);
    expect(getCardText(doc, cardId)).toBe("Reply text for a new card");
  });
});
