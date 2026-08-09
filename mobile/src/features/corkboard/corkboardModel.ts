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

export function buildCorkGroups(folders: readonly Folder[], scenes: readonly Scene[]): CorkGroup[] {
  const groups = folders.map((folder) => ({
    id: folder.id,
    title: folder.title,
    scenes: scenes.filter((scene) => scene.folder_id === folder.id),
  }));
  const shortPieces = scenes.filter((scene) => scene.folder_id === null);
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

