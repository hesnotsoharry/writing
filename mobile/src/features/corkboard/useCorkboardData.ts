import { useCallback, useEffect, useState } from "react";

import { getBinderStore, getStoryBibleStore } from "../../db/stores";
import type { Folder, Scene } from "../../shared/binderStore";
import type { Entity } from "../../shared/storyBibleStore";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";

export interface CorkboardData {
  folders: Folder[];
  scenes: Scene[];
  entities: Record<string, Entity[]>;
  bibleAvailable: boolean;
  loading: boolean;
  reload: () => void;
}

async function loadEntities(scenes: readonly Scene[]): Promise<Record<string, Entity[]>> {
  const store = await getStoryBibleStore();
  const pairs = await Promise.all(scenes.map(async (scene) => {
    const groups = await store.loadSceneEntities(scene.id);
    return [scene.id, groups.flatMap(({ entities }) => entities)] as const;
  }));
  return Object.fromEntries(pairs);
}

export function useCorkboardData(projectId: string): CorkboardData {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [entities, setEntities] = useState<Record<string, Entity[]>>({});
  const [bibleAvailable, setBibleAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    void getBinderStore().then((store) => store.loadProject(projectId)).then((data) => {
      setFolders(data.folders); setScenes(data.scenes); setLoading(false);
      return loadEntities(data.scenes);
    }).then((next) => { setEntities(next); setBibleAvailable(true); })
      .catch(() => { setBibleAvailable(false); setLoading(false); });
  }, [projectId]);
  useEffect(reload, [reload]);
  useEffect(() => subscribeMobileStructureChanged(reload), [reload]);
  return { folders, scenes, entities, bibleAvailable, loading, reload };
}

