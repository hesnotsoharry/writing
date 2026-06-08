// ---------------------------------------------------------------------------
// Settings read-side — Decision D (wave 16).
// Keys + event name are the cross-lane contract between the Settings UI
// (Wave 15, write side) and the editor (Wave 16, read side).
// NO storage-event reliance: same-tab Tauri windows do not fire it.
// ---------------------------------------------------------------------------

export const SETTINGS_KEYS = {
  spellCheck: "writing.spellCheck",
  grammar: "writing.grammar",
  styleHints: "writing.styleHints",
} as const;

export const SETTINGS_CHANGED_EVENT = "writing:settings-changed";

/**
 * Dispatched after any goal mutation (create, edit, delete) so components
 * that read from the goals DB (e.g. useInspectorGoals) can re-fetch.
 */
export const GOALS_CHANGED_EVENT = "writing:goals-changed";

/**
 * Read a boolean setting from localStorage.
 * Returns `defaultValue` when the key is absent;
 * returns `true` only when the stored string is exactly `"true"`;
 * any other string (including `"false"`, `""`, `"1"`) returns `false`.
 */
export function readBoolSetting(key: string, defaultValue: boolean): boolean {
  const raw = localStorage.getItem(key);
  return raw === null ? defaultValue : raw === "true";
}
