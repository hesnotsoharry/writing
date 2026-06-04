import { useEffect, useState } from "react";

import { SqliteQuickNoteStore } from "./SqliteQuickNoteStore";

const defaultStore = new SqliteQuickNoteStore();

/**
 * useQuickCount — live count of unfiled quick notes for the active project.
 *
 * Returns the numeric count (not just a boolean badge) so the binder footer
 * can show the actual number. Returns 0 when no project is active or on error.
 *
 * Injecting `store` is supported for testing without Tauri's SQL backend.
 *
 * Race guard: the cancelled flag prevents a stale async result from overwriting
 * state when activeProjectId changes before the promise resolves.
 * The null-projectId reset uses synchronous derived-state (same pattern as
 * useSceneLinkCounts) to satisfy react-hooks/set-state-in-effect.
 */
export function useQuickCount(
  activeProjectId: string | null,
  store: Pick<SqliteQuickNoteStore, "countUnfiled"> = defaultStore,
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
      .countUnfiled(activeProjectId)
      .then((n) => {
        if (!cancelled) setState({ projectId: activeProjectId, count: n });
      })
      .catch(() => {
        // leave count as-is on error
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, store]);

  return state.count;
}
