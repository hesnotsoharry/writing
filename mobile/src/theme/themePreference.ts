import { getMobileDb } from "../db/database";
import type { ThemeName } from "./tokens";

/** What Settings' segmented control offers: follow the OS, or pin a theme. */
export type ThemePreference = "system" | ThemeName;

/**
 * The theme preference is a per-device display choice, not synced state, so it
 * lives in `app_meta` beside the relay override rather than in the project
 * meta doc. Same table, same access shape as `mobileRelayUrl.ts`.
 */
const THEME_KEY = "ui_theme";

const VALID = new Set<string>(["system", "light", "dark"]);

function parse(row: unknown): ThemePreference | null {
  if (typeof row !== "object" || row === null) return null;
  const value = (row as Record<string, unknown>).value;
  if (typeof value !== "string" || !VALID.has(value)) return null;
  return value as ThemePreference;
}

export async function readThemePreference(): Promise<ThemePreference | null> {
  try {
    const db = await getMobileDb();
    const rows = await db.select<unknown[]>(
      "SELECT value FROM app_meta WHERE key = ?",
      [THEME_KEY],
    );
    return parse(rows[0]);
  } catch {
    // A theme lookup must never block boot — the OS scheme is a fine default.
    return null;
  }
}

export async function writeThemePreference(preference: ThemePreference): Promise<void> {
  const db = await getMobileDb();
  await db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
    THEME_KEY,
    preference,
  ]);
}
