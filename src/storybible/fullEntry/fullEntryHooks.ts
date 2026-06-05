/**
 * Custom hooks for FullEntry — extracted to keep FullEntry.tsx within the 300-line limit.
 */
import { useEffect, useState } from "react";

import type {
  Entity,
  EntityField,
  Relation,
  StoryBibleStore,
} from "../../db/storyBibleStore";

// ── useEntityDetail ───────────────────────────────────────────────────────────

export interface EntityDetail {
  fields: EntityField[];
  sceneIds: string[];
  refresh: () => void;
}

export function useEntityDetail(
  store: StoryBibleStore | undefined,
  entityId: string | undefined
): EntityDetail {
  const [fields, setFields] = useState<EntityField[]>([]);
  const [sceneIds, setSceneIds] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!store || !entityId) return;
    let alive = true;
    void Promise.all([
      store.getEntityFields(entityId),
      store.findScenesForEntity(entityId),
    ]).then(([f, s]) => {
      if (!alive) return;
      setFields(f);
      setSceneIds(s);
    });
    return () => { alive = false; };
  }, [store, entityId, version]);

  function refresh() { setVersion((v) => v + 1); }
  return { fields, sceneIds, refresh };
}

// ── useRelations ──────────────────────────────────────────────────────────────

export interface EntityRelationsData {
  relations: Relation[];
  allEntities: Entity[];
  relVersion: number;
  refreshRelations: () => void;
}

export function useRelations(
  store: StoryBibleStore | undefined,
  projectId: string | undefined,
  entityId: string | undefined
): EntityRelationsData {
  const [relations, setRelations] = useState<Relation[]>([]);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [relVersion, setRelVersion] = useState(0);

  useEffect(() => {
    if (!store || !projectId || !entityId) return;
    let alive = true;
    void Promise.all([
      store.listRelations(projectId, entityId),
      store.listEntities(projectId),
    ]).then(([rels, ents]) => {
      if (!alive) return;
      setRelations(rels);
      setAllEntities(ents);
    });
    return () => { alive = false; };
  }, [store, projectId, entityId, relVersion]);

  function refreshRelations() { setRelVersion((v) => v + 1); }
  return { relations, allEntities, relVersion, refreshRelations };
}
