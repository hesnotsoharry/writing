import { useEffect } from "react";

import { getTweak, TWEAK_DEFAULTS } from "./features/settings/settings.store";
import { SETTINGS_CHANGED_EVENT } from "./lib/settings";
import { setAiConversationsSyncEnabled, syncEngine } from "./sync/desktopEngine";
import { PROJECTS_CHANGED_EVENT } from "./sync/syncEvents";

/** Debounce window for PROJECTS_CHANGED_EVENT — a remote meta-doc apply that
 *  touches many folders/scenes dispatches once per row, and the project list
 *  refetch (a single SQL query) doesn't need to run once per row. */
const PROJECTS_REFRESH_DEBOUNCE_MS = 250;

export function useSyncCallbacks(
  selectedSceneId: string | null,
  reloadTree: () => void,
  selectScene: (sceneId: string) => void,
  refreshProjects: () => void,
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
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onChanged = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refreshProjects, PROJECTS_REFRESH_DEBOUNCE_MS);
    };
    window.addEventListener(PROJECTS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(PROJECTS_CHANGED_EVENT, onChanged);
      if (timer) clearTimeout(timer);
    };
  }, [refreshProjects]);
}
