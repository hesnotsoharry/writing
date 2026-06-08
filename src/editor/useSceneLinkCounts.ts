import { useEffect, useState } from "react";

import type { StoryBibleStore } from "../db/storyBibleStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SceneLinkCounts {
  characters: number;
  locations: number;
}

const ZERO: SceneLinkCounts = { characters: 0, locations: 0 };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSceneLinkCounts — fetches character and location counts for the active
 * scene from the story-bible store. Re-fetches whenever sceneId or refreshKey
 * changes. Returns { 0, 0 } initially, on null sceneId, and on store error.
 *
 * Race guard: a cancelled ref per effect run prevents a stale async result
 * from overwriting state when sceneId changes before the promise resolves.
 * The null-sceneId reset is handled via synchronous derived state (same
 * pattern as useLiveWordCount) to satisfy react-hooks/set-state-in-effect.
 */
export function useSceneLinkCounts(
  store: StoryBibleStore,
  sceneId: string | null,
  refreshKey: number,
): SceneLinkCounts {
  const [state, setState] = useState<{
    sceneId: string | null;
    counts: SceneLinkCounts;
  }>({ sceneId, counts: ZERO });

  // Synchronous derived-state reset: when sceneId changes to null, reset
  // during the current render before the effect runs.
  if (state.sceneId !== sceneId && sceneId === null) {
    setState({ sceneId: null, counts: ZERO });
  }

  useEffect(() => {
    if (sceneId === null) return;

    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await store.loadSceneEntities(sceneId as string);
        if (!cancelled) {
          setState({ sceneId, counts: { characters: result.characters.length, locations: result.locations.length } });
        }
      } catch {
        // Graceful degradation: keep zeros on store error, never throw.
        if (!cancelled) setState({ sceneId, counts: ZERO });
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [sceneId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // store is stable (class instance from props); omitting avoids spurious re-runs.

  return state.counts;
}
