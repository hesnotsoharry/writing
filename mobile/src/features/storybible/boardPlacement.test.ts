import { describe, expect, it } from "vitest";

import { BOARD_CARD_FOOTPRINT, BOARD_GRID_COLUMNS, BOARD_GRID_GAP, BOARD_GRID_ORIGIN, type CardPoint, nextCardSlot } from "./boardPlacement";

const PITCH_X = BOARD_CARD_FOOTPRINT.width + BOARD_GRID_GAP;
const PITCH_Y = BOARD_CARD_FOOTPRINT.height + BOARD_GRID_GAP;

function overlapping(a: CardPoint, b: CardPoint): boolean {
  return Math.abs(a.x - b.x) < BOARD_CARD_FOOTPRINT.width
    && Math.abs(a.y - b.y) < BOARD_CARD_FOOTPRINT.height;
}

describe("nextCardSlot", () => {
  it("puts the first card of an empty board where desktop's own starter card goes", () => {
    expect(nextCardSlot([])).toEqual(BOARD_GRID_ORIGIN);
    // A fresh object each call — callers mutate the result into card metadata.
    expect(nextCardSlot([])).not.toBe(BOARD_GRID_ORIGIN);
  });

  it("anchors the grid on the existing cards' top-left extent, not on the origin", () => {
    const existing = [{ x: 900, y: 640 }, { x: 1400, y: 900 }];
    expect(nextCardSlot(existing)).toEqual({ x: 900 + PITCH_X, y: 640 });
  });

  it("fills a row before wrapping to the next one", () => {
    const cards: CardPoint[] = [{ x: 0, y: 0 }];
    for (let index = 1; index < BOARD_GRID_COLUMNS; index += 1) {
      cards.push(nextCardSlot(cards));
      expect(cards[index]).toEqual({ x: index * PITCH_X, y: 0 });
    }
    expect(nextCardSlot(cards)).toEqual({ x: 0, y: PITCH_Y });
  });

  it("never returns a slot that overlaps a card already on the board", () => {
    // Deliberately unaligned positions — a desktop user drags cards anywhere.
    const cards: CardPoint[] = [{ x: 40, y: 40 }, { x: 190, y: 105 }, { x: 305, y: 92 }, { x: -60, y: 260 }];
    for (let added = 0; added < 25; added += 1) {
      const slot = nextCardSlot(cards);
      expect(cards.filter((card) => overlapping(slot, card))).toEqual([]);
      cards.push(slot);
    }
  });

  it("is deterministic — the same board always yields the same slot", () => {
    const cards = [{ x: 12, y: 8 }, { x: 12 + PITCH_X, y: 8 }];
    expect(nextCardSlot(cards)).toEqual(nextCardSlot(cards));
  });

  it("stays finite on a board whose cards already blanket the grid", () => {
    const cards: CardPoint[] = [];
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < BOARD_GRID_COLUMNS; column += 1) {
        cards.push({ x: column * PITCH_X, y: row * PITCH_Y });
      }
    }
    const slot = nextCardSlot(cards);
    expect(cards.filter((card) => overlapping(slot, card))).toEqual([]);
    expect(slot).toEqual({ x: 0, y: 6 * PITCH_Y });
  });
});
