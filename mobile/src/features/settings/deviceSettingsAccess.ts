import { getMobileDb } from "../../db/database";
import { DeviceSettingsStore } from "./deviceSettings";

let store: Promise<DeviceSettingsStore> | null = null;

export function getDeviceSettingsStore(): Promise<DeviceSettingsStore> {
  store ??= getMobileDb().then((db) => new DeviceSettingsStore(db));
  return store;
}
