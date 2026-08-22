import { platform } from "@tauri-apps/plugin-os";

/**
 * Whether the app is running on macOS. Gates per-platform chrome (e.g. the
 * title bar and traffic-light window controls reserved for a later phase of the
 * macOS-prep wave) without affecting Windows — a pure read, never a mutation.
 *
 * `platform()` is synchronous in Tauri v2: it reads a value injected into
 * `window.__TAURI_OS_PLUGIN_INTERNALS__` at load, with no IPC round-trip. That
 * object is absent under jsdom/vitest (no Tauri runtime), where the underlying
 * access would throw, so the call is wrapped to return `false` instead. Never
 * throws. Safe to call in non-Tauri contexts.
 */
export function isMac(): boolean {
  try {
    return platform() === "macos";
  } catch {
    return false;
  }
}

/** A display label for this device's OS, for the sync device list. Same
 *  never-throws contract as `isMac` — under jsdom there is no OS plugin, and a
 *  missing label must degrade the list, not break sync startup. */
export function platformLabel(): string | null {
  try {
    const labels: Record<string, string> = {
      macos: "macOS", windows: "Windows", linux: "Linux",
      android: "Android", ios: "iOS",
    };
    return labels[platform()] ?? null;
  } catch {
    return null;
  }
}
