import { useEffect } from "react";

import { syncEngine } from "./sync/engine";

export function useSyncCallbacks(
  selectedSceneId: string | null,
  reloadTree: () => void,
  selectScene: (sceneId: string) => void,
): void {
  useEffect(() => {
    syncEngine.onStructureChanged(reloadTree);
    syncEngine.onDocReplaced((sceneId) => {
      if (sceneId === selectedSceneId) selectScene(sceneId);
    });
    return () => {
      syncEngine.onStructureChanged(null);
      syncEngine.onDocReplaced(null);
    };
  }, [reloadTree, selectScene, selectedSceneId]);
}
