import type { Folder, Scene, SceneStatus } from "../../shared/binderStore";
import { computeReorder } from "../../shared/computeReorder";
import type { OutlinerColumnVisibility } from "./outlinerColumns";

export interface OutlineGroup {
  id: string | null;
  title: string;
  scenes: Scene[];
  wordTotal: number;
}

export type OutlineItem =
  | { kind: "header"; key: string; group: OutlineGroup }
  | { kind: "scene"; key: string; groupId: string | null; scene: Scene; indexInGroup: number };

export interface OutlineSummary {
  sceneCount: number;
  wordTotal: number;
  status: Record<SceneStatus, number>;
}

/** Vertical row padding, and the minimum comfortable height of one tappable
 *  band. A row stacks one band per field that occupies its own line. */
const ROW_PADDING = 16;
const ROW_BAND = 44;

/** Base rendered row height: the padding plus all three stacked bands (title,
 *  synopsis, labels) — what a row measures with every column turned on. */
export const OUTLINER_ROW_HEIGHT = ROW_PADDING + 3 * ROW_BAND;

/**
 * Nominal row height for the columns currently shown.
 *
 * Only the fields that stack own a band: the status dot and the word count ride
 * inside the title line and cost no height. This is what the drag maths steps
 * by, so hiding the synopsis has to shrink it — otherwise a compact row would
 * need two rows' worth of travel to move one slot.
 */
export function outlinerRowHeight(columns: OutlinerColumnVisibility): number {
  const bands = 1 + (columns.synopsis ? 1 : 0) + (columns.labels ? 1 : 0);
  return ROW_PADDING + bands * ROW_BAND;
}

/**
 * Short pieces are scenes with `folder_id` NULL plus any scene whose
 * `folder_id` names a folder this project does not have. Same rescue rule as
 * the binder's `buildBinderTree` — a dropped orphan here is prose the writer
 * cannot reach from the outliner at all.
 */
export function buildOutlineGroups(folders: readonly Folder[], scenes: readonly Scene[]): OutlineGroup[] {
  const known = new Set(folders.map((folder) => folder.id));
  const groups = folders.map((folder) => {
    const rows = scenes.filter((scene) => scene.folder_id === folder.id);
    return { id: folder.id, title: folder.title, scenes: rows, wordTotal: rows.reduce((sum, scene) => sum + scene.word_count, 0) };
  });
  const short = scenes.filter((scene) => scene.folder_id === null || !known.has(scene.folder_id));
  return short.length === 0 ? groups : [...groups, {
    id: null, title: "Short pieces", scenes: short,
    wordTotal: short.reduce((sum, scene) => sum + scene.word_count, 0),
  }];
}

export function flattenOutline(groups: readonly OutlineGroup[]): OutlineItem[] {
  return groups.flatMap((group) => [
    { kind: "header" as const, key: `header:${group.id ?? "short"}`, group },
    ...group.scenes.map((scene, indexInGroup) => ({ kind: "scene" as const, key: scene.id, groupId: group.id, scene, indexInGroup })),
  ]);
}

export function deriveStickyHeaderIndices(items: readonly OutlineItem[]): number[] {
  return items.flatMap((item, index) => item.kind === "header" ? [index] : []);
}

export function summarizeOutline(scenes: readonly Scene[]): OutlineSummary {
  const status: Record<SceneStatus, number> = { blank: 0, outline: 0, draft: 0, revise: 0, final: 0 };
  scenes.forEach((scene) => { status[scene.status] += 1; });
  return { sceneCount: scenes.length, wordTotal: scenes.reduce((sum, scene) => sum + scene.word_count, 0), status };
}

export function outlinerDropIndex(fromIndex: number, translationY: number, count: number, rowHeight = OUTLINER_ROW_HEIGHT): number {
  return Math.max(0, Math.min(count - 1, fromIndex + Math.round(translationY / rowHeight)));
}

/**
 * Slot the row currently at `index` ends up in once the row at `from` is
 * spliced out and re-inserted at `to` — the same remove-then-insert rule
 * `computeReorder` applies when the drop is written.
 */
export function outlinerPreviewSlot(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < to) return index > from && index <= to ? index - 1 : index;
  return index >= to && index < from ? index + 1 : index;
}

/** Distance the dragged row travels: the combined height of every row it
 *  crosses, signed by direction. */
function draggedSpan(heights: readonly number[], from: number, to: number): number {
  let span = 0;
  if (to > from) {
    for (let index = from + 1; index <= to; index += 1) span += heights[index];
    return span;
  }
  for (let index = to; index < from; index += 1) span -= heights[index];
  return span;
}

/**
 * How far each row must slide so the list reads as if the drop had already
 * happened. Rows the dragged row passes shift by exactly the dragged row's own
 * height — exact even though outliner rows vary in height (the synopsis and the
 * label strip both wrap), which `OUTLINER_ROW_HEIGHT` alone cannot express.
 */
export function outlinerPreviewOffsets(heights: readonly number[], from: number, to: number): number[] {
  if (from < 0 || from >= heights.length || from === to) return heights.map(() => 0);
  const dragged = heights[from];
  return heights.map((_, index) => {
    if (index === from) return draggedSpan(heights, from, to);
    if (from < to) return index > from && index <= to ? -dragged : 0;
    return index >= to && index < from ? dragged : 0;
  });
}

/** The group's scene ids after `sceneId` is dropped at `toIndex` — the exact
 *  order `moveScene` will persist, so the optimistic list cannot disagree. */
export function reorderGroupIds(scenes: readonly Scene[], sceneId: string, toIndex: number): string[] {
  return computeReorder(scenes.map(({ id }) => ({ id })), sceneId, toIndex).map(({ id }) => id);
}

function describesGroup(scenes: readonly Scene[], ids: readonly string[]): boolean {
  if (scenes.length !== ids.length) return false;
  const wanted = new Set(ids);
  return scenes.every(({ id }) => wanted.has(id));
}

/**
 * Re-sorts each group by the order the writer's own drop produced, so the list
 * shows the new arrangement immediately instead of holding the dragged row in
 * mid-air while the SQLite write round-trips.
 *
 * A remembered order is ignored the moment it stops describing its group
 * exactly — a scene added, deleted, or moved to another chapter — so a stale
 * entry can never hide or duplicate a scene. Scene *contents* always come from
 * the freshly loaded rows; only their order is overridden.
 */
export function applyOptimisticOrder(
  groups: readonly OutlineGroup[],
  order: Readonly<Record<string, string[]>>,
): OutlineGroup[] {
  return groups.map((group) => {
    const wanted = order[group.id ?? "short"];
    if (!wanted || !describesGroup(group.scenes, wanted)) return group;
    const rank = new Map(wanted.map((id, index) => [id, index]));
    return { ...group, scenes: [...group.scenes].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) };
  });
}

/**
 * Whether a scene row reserves the hairline that separates it from the next
 * scene in its chapter.
 *
 * The divider belongs to the row *above* the gap and is rendered inside that
 * row's animated wrapper, so it slides with the row during a drag preview
 * instead of being left behind as a stray line across the opening gap. The last
 * row of a chapter reserves nothing: it has no next scene to be told apart
 * from, and the next thing down is a chapter header that carries its own edge.
 *
 * The space is reserved whether or not the line is currently inked, so lifting
 * a row cannot change its height and shunt the whole list up by a pixel.
 */
export function reservesSceneDivider(indexInGroup: number, groupCount: number): boolean {
  return indexInGroup < groupCount - 1;
}

/** ...and that reserved hairline only carries ink while the row is at rest — a
 *  lifted row is one clean shadowed card, with no rule across its bottom edge. */
export function showsSceneDivider(indexInGroup: number, groupCount: number, dragging: boolean): boolean {
  return !dragging && reservesSceneDivider(indexInGroup, groupCount);
}
