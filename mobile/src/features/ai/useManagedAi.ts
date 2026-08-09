import { useCallback, useEffect, useState } from "react";

import { type ManagedModel } from "../../shared/aiCatalog";
import { type LiveBalance } from "./aiLogic";
import {
  getManagedAiAccess, type ManagedAiAvailability, updateManagedModel,
} from "./credentialHandoff";
import { mobileAiClient } from "./mobileAiClient";

interface ManagedAiView {
  access: ManagedAiAvailability | null;
  balance: LiveBalance | null;
  error: string | null;
  refresh(): void;
  selectModel(model: ManagedModel): Promise<void>;
}

export function useManagedAi(): ManagedAiView {
  const [refreshKey, setRefreshKey] = useState(0);
  const [access, setAccess] = useState<ManagedAiAvailability | null>(null);
  const [balance, setBalance] = useState<LiveBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getManagedAiAccess().then(async (next) => {
      if (!active) return;
      setAccess(next); setError(null);
      if (next.state !== "available") { setBalance(null); return; }
      const live = await mobileAiClient.getBalance(next.session.token);
      if (active) setBalance(live);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Managed AI is unavailable");
    });
    return () => { active = false; };
  }, [refreshKey]);
  const refresh = useCallback(() => { setRefreshKey((key) => key + 1); }, []);
  const selectModel = useCallback(async (model: ManagedModel) => {
    await updateManagedModel(model); refresh();
  }, [refresh]);
  return { access, balance, error, refresh, selectModel };
}
