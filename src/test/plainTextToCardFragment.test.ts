import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  createBoardCard,
  getCardText,
  plainTextToCardFragment,
} from "../features/brainstorm/boardDoc";

describe("plainTextToCardFragment", () => {
  it("round-trips two-paragraph text via getCardText — both paragraphs present", () => {
    const doc = new Y.Doc();
    const cardId = crypto.randomUUID();
    createBoardCard(doc, cardId, { x: 0, y: 0 });

    plainTextToCardFragment(doc, cardId, "First para.\nSecond para.");
    const result = getCardText(doc, cardId);

    expect(result).toContain("First para.");
    expect(result).toContain("Second para.");
  });

  it("preserves paragraph order in the round-trip", () => {
    const doc = new Y.Doc();
    const cardId = crypto.randomUUID();
    createBoardCard(doc, cardId, { x: 0, y: 0 });

    plainTextToCardFragment(doc, cardId, "Alpha\nBeta\nGamma");
    const result = getCardText(doc, cardId);

    expect(result.indexOf("Alpha")).toBeLessThan(result.indexOf("Beta"));
    expect(result.indexOf("Beta")).toBeLessThan(result.indexOf("Gamma"));
  });

  it("skips whitespace-only lines — empty-string result when all lines are blank", () => {
    const doc = new Y.Doc();
    const cardId = crypto.randomUUID();
    createBoardCard(doc, cardId, { x: 0, y: 0 });

    plainTextToCardFragment(doc, cardId, "   \n\n  \n");

    expect(getCardText(doc, cardId)).toBe("");
  });

  it("creates no paragraphs for empty string input", () => {
    const doc = new Y.Doc();
    const cardId = crypto.randomUUID();
    createBoardCard(doc, cardId, { x: 0, y: 0 });

    plainTextToCardFragment(doc, cardId, "");

    expect(getCardText(doc, cardId)).toBe("");
  });

  it("does not affect other cards in the same doc", () => {
    const doc = new Y.Doc();
    const cardA = crypto.randomUUID();
    const cardB = crypto.randomUUID();
    createBoardCard(doc, cardA, { x: 0, y: 0 });
    createBoardCard(doc, cardB, { x: 100, y: 100 });

    plainTextToCardFragment(doc, cardA, "Only for A");

    expect(getCardText(doc, cardA)).toContain("Only for A");
    expect(getCardText(doc, cardB)).toBe("");
  });
});
