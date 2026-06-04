import { useEffect, useState } from "react";

import type { BinderStore } from "../../db/binderStore";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";

const defaultStore: Pick<BinderStore, "archivedCount"> = new SqliteBinderStore();

/**
 * useArchivedCount — live count of archived items for the active project.
 *
 * Returns the numeric count (not just a boolean badge) so the binder footer
 * can show the actual number and conditionally render the 'Archived' button.
 * Returns 0 when no project is active or on error.
 *
 * Injecting `store` is supported for testing without Tauri's SQL backend.
 *
 * Race guard: the cancelled flag prevents a stale async result from overwriting
 * state when activeProjectId or version changes before the promise resolves.
 * The null-projectId reset uses synchronous derived-state (same pattern as
 * useQuickCount) to satisfy react-hooks/set-state-in-effect.
 *
 * `version` is a bump counter — increment it to force a re-query after an
 * archive or restore action.
 */
export function useArchivedCount(
  activeProjectId: string | null,
  version: number,
  store: Pick<BinderStore, "archivedCount"> = defaultStore,
): number {
  const [state, setState] = useState<{
    projectId: string | null;
    count: number;
  }>({ projectId: activeProjectId, count: 0 });

  // Synchronous derived-state reset: when activeProjectId becomes null,
  // reset to 0 during the current render before the effect runs.
  if (state.projectId !== activeProjectId && activeProjectId === null) {
    setState({ projectId: null, count: 0 });
  }

  useEffect(() => {
    if (activeProjectId === null) return;

    let cancelled = false;
    store
      .archivedCount(activeProjectId)
      .then((n) => {
        if (!cancelled) setState({ projectId: activeProjectId, count: n });
      })
      .catch(() => {
        // leave count as-is on error
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, version, store]);

  return state.count;
}
