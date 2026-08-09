import { useCallback, useEffect, useState } from "react";

import { getBinderStore, getLabelStore } from "../../db/stores";
import type { Folder, Scene } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";

export interface OutlinerData {
  folders: Folder[];
  scenes: Scene[];
  labels: Label[];
  sceneLabels: Record<string, Label[]>;
  loading: boolean;
  reload: () => void;
}

async function loadOutliner(projectId: string) {
  const [binder, labelStore] = await Promise.all([getBinderStore(), getLabelStore()]);
  const [tree, labels, sceneLabels] = await Promise.all([
    binder.loadProject(projectId), labelStore.listLabels(projectId), labelStore.getAllSceneLabels(),
  ]);
  return { ...tree, labels, sceneLabels };
}

export function useOutlinerData(projectId: string): OutlinerData {
  const [data, setData] = useState<Omit<OutlinerData, "loading" | "reload">>({ folders: [], scenes: [], labels: [], sceneLabels: {} });
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    void loadOutliner(projectId).then((next) => { setData(next); setLoading(false); });
  }, [projectId]);
  useEffect(reload, [reload]);
  useEffect(() => subscribeMobileStructureChanged(reload), [reload]);
  return { ...data, loading, reload };
}

