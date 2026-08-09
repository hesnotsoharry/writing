import type { Folder, Scene, SceneStatus } from "../../shared/binderStore";

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

export function buildOutlineGroups(folders: readonly Folder[], scenes: readonly Scene[]): OutlineGroup[] {
  const groups = folders.map((folder) => {
    const rows = scenes.filter((scene) => scene.folder_id === folder.id);
    return { id: folder.id, title: folder.title, scenes: rows, wordTotal: rows.reduce((sum, scene) => sum + scene.word_count, 0) };
  });
  const short = scenes.filter((scene) => scene.folder_id === null);
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

export function outlinerDropIndex(fromIndex: number, translationY: number, count: number, rowHeight = 102): number {
  return Math.max(0, Math.min(count - 1, fromIndex + Math.round(translationY / rowHeight)));
}

