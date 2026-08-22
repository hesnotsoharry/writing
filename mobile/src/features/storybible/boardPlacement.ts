/**
 * Where a card created on a phone lands on the desktop's canvas.
 *
 * Desktop boards are an unbounded 2D canvas; a phone has no meaningful
 * coordinate space to author into. Letting mobile pick a free-form x/y would
 * drop cards in arbitrary places relative to the desktop user's cluster, so
 * mobile never authors positions directly: it fills the next free slot of a
 * grid anchored to the top-left extent of the cards already on the board.
 *
 * The footprint is deliberately the *widest* desktop card (`.card-node` is
 * `min-width: 168px; max-width: 264px` in src/styles/app.css) so the overlap
 * test errs towards skipping a slot rather than stacking two cards.
 */

export interface CardPoint { x: number; y: number }

/** Widest/tallest a desktop card can render — used as the collision box. */
export const BOARD_CARD_FOOTPRINT = { width: 264, height: 140 } as const;
/** Breathing room between two neighbouring slots. */
export const BOARD_GRID_GAP = 24;
/** Slots per row before the grid wraps downward. */
export const BOARD_GRID_COLUMNS = 3;
/**
 * Where the very first card on an empty board goes. Matches the position
 * desktop's own starter card uses (`BoardView.tsx` → `createBoardCard(…, {x: 120, y: 120})`).
 */
export const BOARD_GRID_ORIGIN: CardPoint = { x: 120, y: 120 };

const COLUMN_PITCH = BOARD_CARD_FOOTPRINT.width + BOARD_GRID_GAP;
const ROW_PITCH = BOARD_CARD_FOOTPRINT.height + BOARD_GRID_GAP;

/** Axis-aligned overlap of two equal-footprint boxes anchored at their top-left. */
function overlaps(a: CardPoint, b: CardPoint): boolean {
  return Math.abs(a.x - b.x) < BOARD_CARD_FOOTPRINT.width
    && Math.abs(a.y - b.y) < BOARD_CARD_FOOTPRINT.height;
}

/**
 * The first grid slot that collides with nothing already on the board.
 *
 * Row-major from the existing cards' top-left extent. A card can block at most
 * two columns and two rows (its footprint is smaller than one pitch in each
 * axis), so `2n + 3` rows of three columns always contains a free slot for any
 * n existing cards; the trailing return only guards against a future change to
 * the pitch/footprint ratio.
 */
export function nextCardSlot(existing: readonly CardPoint[]): CardPoint {
  if (existing.length === 0) return { ...BOARD_GRID_ORIGIN };
  const anchorX = Math.min(...existing.map((card) => card.x));
  const anchorY = Math.min(...existing.map((card) => card.y));
  const maxRows = existing.length * 2 + 3;
  for (let row = 0; row < maxRows; row += 1) {
    for (let column = 0; column < BOARD_GRID_COLUMNS; column += 1) {
      const slot = { x: anchorX + column * COLUMN_PITCH, y: anchorY + row * ROW_PITCH };
      if (!existing.some((card) => overlaps(slot, card))) return slot;
    }
  }
  return { x: anchorX, y: Math.max(...existing.map((card) => card.y)) + ROW_PITCH };
}
