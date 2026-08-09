import { useEffect, useRef, useState } from "react";

import type { MobileSearchMatch, MobileSearchOptions } from "../../db/mobileSearchStore";
import { getBinderStore, getSearchStore } from "../../db/stores";
import type { SceneStatus } from "../../shared/binderStore";
import { DebouncedSearch } from "./searchModel";

interface ProjectSearchState {
  results: MobileSearchMatch[];
  statuses: Record<string, SceneStatus>;
  loading: boolean;
}

async function runSearch(projectId: string, query: string, options: MobileSearchOptions, signal: AbortSignal) {
  if (signal.aborted) return [];
  const store = await getSearchStore();
  const results = await store.searchAll(projectId, query, options);
  return signal.aborted ? [] : results;
}

export function useProjectSearch(projectId: string, query: string, options: MobileSearchOptions): ProjectSearchState {
  const [delivered, setDelivered] = useState<{ query: string; results: MobileSearchMatch[] }>({ query: "", results: [] });
  const [statuses, setStatuses] = useState<Record<string, SceneStatus>>({});
  const search = useRef(new DebouncedSearch<MobileSearchMatch[]>(250));
  const { caseSensitive, wholeWord } = options;
  useEffect(() => {
    void getBinderStore().then((store) => store.loadProject(projectId)).then(({ scenes }) => {
      setStatuses(Object.fromEntries(scenes.map((scene) => [scene.id, scene.status])));
    });
  }, [projectId]);
  useEffect(() => {
    const coordinator = search.current;
    if (query.length < 2) { coordinator.cancel(); return; }
    coordinator.schedule(query, (value, signal) => runSearch(projectId, value, { caseSensitive, wholeWord }, signal), (results) => {
      setDelivered({ query, results });
    });
    return () => coordinator.cancel();
  }, [caseSensitive, projectId, query, wholeWord]);
  const ready = query.length >= 2 && delivered.query === query;
  return { results: ready ? delivered.results : [], statuses, loading: query.length >= 2 && !ready };
}
