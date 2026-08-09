import { useEffect } from "react";

import { getTweak, TWEAK_DEFAULTS } from "./features/settings/settings.store";
import { SETTINGS_CHANGED_EVENT } from "./lib/settings";
import { setAiConversationsSyncEnabled, syncEngine } from "./sync/desktopEngine";

export function useSyncCallbacks(
  selectedSceneId: string | null,
  reloadTree: () => void,
  selectScene: (sceneId: string) => void,
): void {
  useEffect(() => {
    const refresh = () => setAiConversationsSyncEnabled(getTweak(
      "syncAiConversations", TWEAK_DEFAULTS.syncAiConversations,
    ));
    refresh();
    window.addEventListener(SETTINGS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, refresh);
  }, []);
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
