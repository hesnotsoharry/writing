/**
 * useManuscriptWordCount — live manuscript-wide word total.
 *
 * Sums cached `scene.word_count` across all scenes in the active project's
 * binder tree, but substitutes the live editor count for the currently-open
 * scene so the status bar reflects keystrokes without a DB round-trip.
 *
 * Returns 0 when the tree has no scenes (cold start / empty project).
 */

import { useMemo } from "react";

import type { BinderTree } from "../binder/buildTree";

export function useManuscriptWordCount(args: {
  tree: BinderTree;
  activeSceneId: string | null;
  liveActiveWords: number;
}): number {
  const { tree, activeSceneId, liveActiveWords } = args;

  return useMemo(() => {
    const allScenes = [
      ...tree.chapters.flatMap((ch) => ch.scenes),
      ...tree.shortPieces,
    ];
    return allScenes.reduce((sum, scene) => {
      const words =
        scene.id === activeSceneId ? liveActiveWords : scene.word_count;
      return sum + words;
    }, 0);
  }, [tree, activeSceneId, liveActiveWords]);
}
