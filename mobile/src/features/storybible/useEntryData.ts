import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";

import { getBinderStore, getStoryBibleStore } from "../../db/stores";
import type { AppearsInRow } from "../../shared/fullEntryDefs";
import { buildAppearsIn } from "../../shared/fullEntryDefs";
import type {
  CustomEntityType, Entity, EntityField, EntityWithPortrait, Relation, StoryBibleStore,
} from "../../shared/storyBibleStore";

export interface EntryData {
  entity: EntityWithPortrait | null;
  fields: EntityField[];
  customTypes: CustomEntityType[];
  entities: Entity[];
  relations: Relation[];
  appearsIn: AppearsInRow[];
  store: StoryBibleStore | null;
  loading: boolean;
  reload: () => void;
}

type LoadedEntry = Omit<EntryData, "store" | "loading" | "reload">;

async function loadEntry(store: StoryBibleStore, projectId: string, entityId: string,
  entityType: string): Promise<LoadedEntry> {
  const binder = await getBinderStore();
  const [entity, fields, customTypes, entities, relations, sceneIds, tree] = await Promise.all([
    store.getEntity(entityType, entityId), store.getEntityFields(entityId),
    store.listCustomTypes(projectId), store.listEntities(projectId),
    store.listRelations(projectId, entityId), store.findScenesForEntity(entityId),
    binder.loadProject(projectId),
  ]);
  return {
    entity, fields, customTypes, entities, relations,
    appearsIn: buildAppearsIn(sceneIds, tree.folders, tree.scenes),
  };
}

const EMPTY: LoadedEntry = {
  entity: null, fields: [], customTypes: [], entities: [], relations: [], appearsIn: [],
};

export function useEntryData(projectId: string, entityId: string, entityType: string): EntryData {
  const [store, setStore] = useState<StoryBibleStore | null>(null);
  const [data, setData] = useState<LoadedEntry>(EMPTY);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getStoryBibleStore().then(setStore); }, []);
  const reload = useCallback(() => {
    if (!store) return;
    void loadEntry(store, projectId, entityId, entityType)
      .then(setData).finally(() => setLoading(false));
  }, [entityId, entityType, projectId, store]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useEffect(() => store?.subscribeEntityChanges?.(reload), [reload, store]);
  return { ...data, store, loading, reload };
}
