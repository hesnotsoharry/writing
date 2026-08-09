import { useCallback, useEffect, useState } from "react";

import { DEVICE_SETTINGS_DEFAULTS } from "../settings/deviceSettings";
import { getDeviceSettingsStore } from "../settings/deviceSettingsAccess";

export interface FocusSettings {
  dimParagraphs: boolean;
  typewriter: boolean;
  keepAwake: boolean;
  sessionGoal: number;
}

const DEFAULTS: FocusSettings = {
  dimParagraphs: DEVICE_SETTINGS_DEFAULTS.focusDimParagraphs,
  typewriter: DEVICE_SETTINGS_DEFAULTS.focusTypewriter,
  keepAwake: DEVICE_SETTINGS_DEFAULTS.focusKeepAwake,
  sessionGoal: DEVICE_SETTINGS_DEFAULTS.focusSessionGoal,
};

export function useFocusSettings() {
  const [settings, setSettings] = useState<FocusSettings>(DEFAULTS);
  useEffect(() => { void getDeviceSettingsStore().then((store) => store.read()).then((value) => setSettings({
    dimParagraphs: value.focusDimParagraphs, typewriter: value.focusTypewriter,
    keepAwake: value.focusKeepAwake, sessionGoal: value.focusSessionGoal,
  })); }, []);
  const update = useCallback(<K extends keyof FocusSettings>(key: K, value: FocusSettings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      void getDeviceSettingsStore().then(async (store) => {
        const device = await store.read();
        await store.write({ ...device, focusDimParagraphs: next.dimParagraphs,
          focusTypewriter: next.typewriter, focusKeepAwake: next.keepAwake,
          focusSessionGoal: next.sessionGoal });
      });
      return next;
    });
  }, []);
  return { settings, update };
}
