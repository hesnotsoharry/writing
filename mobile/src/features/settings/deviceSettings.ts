import type { DbClient } from "../../shared/dbClient";

export interface DeviceSettings {
  proseSize: number;
  spellCheck: boolean;
  aiEnabled: boolean;
  syncAiConversations: boolean;
  offlineCopies: boolean;
  focusDimParagraphs: boolean;
  focusTypewriter: boolean;
  focusKeepAwake: boolean;
  focusSessionGoal: number;
}

export const DEVICE_SETTINGS_DEFAULTS: DeviceSettings = {
  proseSize: 18.5,
  spellCheck: true,
  aiEnabled: true,
  syncAiConversations: false,
  offlineCopies: true,
  focusDimParagraphs: true,
  focusTypewriter: true,
  focusKeepAwake: false,
  focusSessionGoal: 500,
};

const KEY = "mobile_device_settings";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseDeviceSettings(raw: string | null): DeviceSettings {
  if (!raw) return { ...DEVICE_SETTINGS_DEFAULTS };
  try {
    const value = JSON.parse(raw) as unknown;
    return isRecord(value) ? { ...DEVICE_SETTINGS_DEFAULTS, ...validFields(value) }
      : { ...DEVICE_SETTINGS_DEFAULTS };
  } catch { return { ...DEVICE_SETTINGS_DEFAULTS }; }
}

function validFields(value: Record<string, unknown>): Partial<DeviceSettings> {
  const result: Partial<DeviceSettings> = {};
  for (const key of Object.keys(DEVICE_SETTINGS_DEFAULTS) as Array<keyof DeviceSettings>) {
    const candidate = value[key];
    const fallback = DEVICE_SETTINGS_DEFAULTS[key];
    if (typeof candidate === typeof fallback) Object.assign(result, { [key]: candidate });
  }
  return result;
}

export class DeviceSettingsStore {
  constructor(private readonly db: DbClient) {}

  async read(): Promise<DeviceSettings> {
    const rows = await this.db.select<Array<{ value: string }>>(
      "SELECT value FROM app_meta WHERE key = ?", [KEY],
    );
    return parseDeviceSettings(rows[0]?.value ?? null);
  }

  async write(settings: DeviceSettings): Promise<void> {
    await this.db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
      KEY, JSON.stringify(settings),
    ]);
  }
}
