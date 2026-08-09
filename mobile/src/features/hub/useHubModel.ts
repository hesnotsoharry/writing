import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";

import { mobileLocalWrites } from "../../db/mobileLocalWriteBridge";
import { getStoryBibleStore } from "../../db/stores";
import { mobileEngine, subscribeMobileStructureChanged } from "../../sync/mobileEngine";
import { loadHubModel } from "./hubData";
import type { HubModel } from "./hubModel";

export interface HubModelState {
  model: HubModel | null;
  loading: boolean;
  error: boolean;
  reload: () => void;
}

export function useHubModel(projectId: string): HubModelState {
  const [model, setModel] = useState<HubModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const reload = useCallback(() => {
    void loadHubModel(projectId)
      .then((next) => { setModel(next); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [projectId]);
  useFocusEffect(useCallback(() => {
    reload();
    // SyncEngine has no remote row-applied event yet. Keep LWW-backed tile
    // counts live while focused in addition to the event subscriptions below.
    const timer = setInterval(reload, 2_000);
    return () => clearInterval(timer);
  }, [reload]));
  useEffect(() => subscribeMobileStructureChanged(reload), [reload]);
  useEffect(() => mobileEngine.subscribe(reload), [reload]);
  useEffect(() => mobileLocalWrites.subscribe((write) => {
    if (write.projectId === projectId) reload();
  }), [projectId, reload]);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void getStoryBibleStore().then((store) => { unsubscribe = store.subscribeEntityChanges?.(reload); });
    return () => unsubscribe?.();
  }, [reload]);
  return { model, loading, error, reload };
}
