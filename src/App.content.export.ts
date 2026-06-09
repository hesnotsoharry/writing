/**
 * useExportActions — stable callbacks for opening the Export overlay.
 * Extracted to keep App.content.tsx under the 300-line file limit.
 */
import { useCallback } from "react";

import type { BinderTree } from "./binder/buildTree";
import type { ExportScope } from "./features/export/types";

export type SetExportTargetFn = (opts: {
  scope: ExportScope;
  sceneId: string | null;
  chapterId: string | null;
}) => void;

/**
 * Returns two stable callbacks:
 * - `onExport(scope, id)` — called by binder / corkboard context-menu items.
 * - `openExport()`        — called by the title-bar button and Cmd+E; defaults
 *                           to scene scope when a scene is selected.
 */
export function useExportActions(
  tree: BinderTree,
  selectedSceneId: string | null,
  setExportTarget: SetExportTargetFn,
  setShowExport: (v: boolean) => void
) {
  const onExport = useCallback((scope: "scene" | "chapter", id: string) => {
    if (scope === "chapter") {
      setExportTarget({ scope: "chapter", sceneId: null, chapterId: id });
    } else {
      const ch = tree.chapters.find((c) => c.scenes.some((s) => s.id === id));
      setExportTarget({ scope: "scene", sceneId: id, chapterId: ch?.folder.id ?? null });
    }
    setShowExport(true);
  }, [tree, setExportTarget, setShowExport]);

  const openExport = useCallback(() => {
    if (selectedSceneId) {
      const ch = tree.chapters.find((c) => c.scenes.some((s) => s.id === selectedSceneId));
      setExportTarget({ scope: "scene", sceneId: selectedSceneId, chapterId: ch?.folder.id ?? null });
    } else {
      setExportTarget({ scope: "manuscript", sceneId: null, chapterId: null });
    }
    setShowExport(true);
  }, [selectedSceneId, tree, setExportTarget, setShowExport]);

  return { onExport, openExport };
}
