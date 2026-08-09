import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";

import { getStoryBibleStore } from "../../db/stores";
import type { CustomEntityType, Entity, StoryBibleStore } from "../../shared/storyBibleStore";
import type { BibleListRow } from "./listModel";
import { roleFromFields } from "./listModel";

interface BibleData {
  entries: BibleListRow[];
  customTypes: CustomEntityType[];
  store: StoryBibleStore | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

async function loadRows(store: StoryBibleStore, projectId: string): Promise<{
  entries: BibleListRow[]; customTypes: CustomEntityType[];
}> {
  const [entities, customTypes] = await Promise.all([
    store.listEntities(projectId), store.listCustomTypes(projectId),
  ]);
  const fields = await Promise.all(entities.map((entity) => store.getEntityFields(entity.id)));
  const entries = entities.map((entity: Entity, index) => ({ ...entity, role: roleFromFields(fields[index]) }));
  return { entries, customTypes };
}

export function useBibleData(projectId: string): BibleData {
  const [store, setStore] = useState<StoryBibleStore | null>(null);
  const [entries, setEntries] = useState<BibleListRow[]>([]);
  const [customTypes, setCustomTypes] = useState<CustomEntityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => { void getStoryBibleStore().then(setStore); }, []);
  const reload = useCallback(() => {
    if (!store) return;
    void loadRows(store, projectId).then((next) => {
      setEntries(next.entries); setCustomTypes(next.customTypes); setError(false);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, [projectId, store]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useEffect(() => store?.subscribeEntityChanges?.(reload), [reload, store]);
  return { entries, customTypes, store, loading, error, reload };
}
