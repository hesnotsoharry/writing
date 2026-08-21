import type { Folder, Scene } from "../../shared/binderStore";
import { computeReorder } from "../../shared/computeReorder";

export interface CorkGroup {
  id: string | null;
  title: string;
  scenes: Scene[];
}

export interface CardLayout {
  columns: 1 | 2;
  contentWidth: number;
  gutter: number;
  cardWidth: number;
}

/**
 * Short pieces are scenes with `folder_id` NULL plus any scene whose
 * `folder_id` names a folder this project does not have. Same rescue rule as
 * the binder's `buildBinderTree` — a dropped orphan here is prose the writer
 * cannot reach from the corkboard at all.
 */
export function buildCorkGroups(folders: readonly Folder[], scenes: readonly Scene[]): CorkGroup[] {
  const known = new Set(folders.map((folder) => folder.id));
  const groups = folders.map((folder) => ({
    id: folder.id,
    title: folder.title,
    scenes: scenes.filter((scene) => scene.folder_id === folder.id),
  }));
  const shortPieces = scenes.filter((scene) => scene.folder_id === null || !known.has(scene.folder_id));
  return shortPieces.length > 0 ? [...groups, { id: null, title: "Short pieces", scenes: shortPieces }] : groups;
}

export function getCardLayout(viewportWidth: number, columns: 1 | 2): CardLayout {
  const contentWidth = Math.max(0, viewportWidth - 36);
  const gutter = columns === 1 ? 16 : 12;
  return { columns, contentWidth, gutter, cardWidth: (contentWidth - gutter * (columns - 1)) / columns };
}

export function dragTargetIndex(input: {
  fromIndex: number; translationX: number; translationY: number;
  count: number; columns: 1 | 2; cardWidth: number; rowHeight: number; gutter: number;
}): number {
  const startRow = Math.floor(input.fromIndex / input.columns);
  const startColumn = input.fromIndex % input.columns;
  const columnDelta = Math.round(input.translationX / (input.cardWidth + input.gutter));
  const rowDelta = Math.round(input.translationY / (input.rowHeight + input.gutter));
  const column = Math.max(0, Math.min(input.columns - 1, startColumn + columnDelta));
  const raw = (startRow + rowDelta) * input.columns + column;
  return Math.max(0, Math.min(input.count - 1, raw));
}

export function reorderPreview(scenes: readonly Scene[], sceneId: string, toIndex: number): Scene[] {
  const updates = computeReorder(scenes.map(({ id }) => ({ id })), sceneId, toIndex);
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  return updates.map(({ id }) => byId.get(id)).filter((scene): scene is Scene => scene !== undefined);
}


export interface DragOffset {
  dx: number;
  dy: number;
}

export interface DragPreviewInput {
  heights: readonly number[];
  columns: 1 | 2;
  cardWidth: number;
  gutter: number;
  from: number;
  to: number;
}

interface SlotOrigin {
  x: number;
  y: number;
}

const NO_OFFSET: DragOffset = { dx: 0, dy: 0 };

/**
 * Slot the card currently at `index` ends up in once the card at `from` is
 * spliced out and re-inserted at `to` — the same remove-then-insert rule
 * `computeReorder` applies when the drop is written.
 */
export function previewSlotIndex(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < to) return index > from && index <= to ? index - 1 : index;
  return index >= to && index < from ? index + 1 : index;
}

function moveHeight(heights: readonly number[], from: number, to: number): number[] {
  const rest = heights.filter((_, index) => index !== from);
  rest.splice(Math.max(0, Math.min(to, rest.length)), 0, heights[from]);
  return rest;
}

/**
 * Origin of every slot in the wrap grid. Columns are fixed-width, and a wrap
 * line is as tall as its tallest card because RN stretches wrap lines — so a
 * row's height is the max of the measured cards in it, never a nominal value.
 */
function slotOrigins(heights: readonly number[], columns: number, cardWidth: number, gutter: number): SlotOrigin[] {
  const origins: SlotOrigin[] = [];
  let y = 0;
  for (let start = 0; start < heights.length; start += columns) {
    let rowHeight = 0;
    for (let column = 0; column < columns && start + column < heights.length; column += 1) {
      origins.push({ x: column * (cardWidth + gutter), y });
      rowHeight = Math.max(rowHeight, heights[start + column]);
    }
    y += rowHeight + gutter;
  }
  return origins;
}

/**
 * How far each card must slide so the grid reads as if the drop had already
 * happened: the dragged card lands on its target slot and everything it
 * displaces opens a gap for it. Offsets are the difference between each card's
 * current slot origin and the origin it would have in the reordered grid, so
 * they stay exact when cards have different heights.
 */
export function dragPreviewOffsets(input: DragPreviewInput): DragOffset[] {
  const { cardWidth, columns, from, gutter, heights, to } = input;
  if (from < 0 || from >= heights.length || from === to) return heights.map(() => NO_OFFSET);
  const current = slotOrigins(heights, columns, cardWidth, gutter);
  const next = slotOrigins(moveHeight(heights, from, to), columns, cardWidth, gutter);
  return heights.map((_, index) => {
    const target = next[previewSlotIndex(index, from, to)];
    return target === undefined ? NO_OFFSET : { dx: target.x - current[index].x, dy: target.y - current[index].y };
  });
}
