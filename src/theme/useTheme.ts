import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

// AccentPalette: [hero, deep, tint] — matches the design's accent array shape.
// hero  → --accent (primary interactive colour)
// deep  → --accent-deep (deeper shade for hover / pressed states)
// tint  → used to derive --accent-tint (soft fill); the rgba wash/ring/selection
//          are computed from the hero channel values at fixed opacities.
export type AccentPalette = [string, string, string];

export type Theme = "light" | "dark";

export interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  accent: AccentPalette;
  setAccent: (a: AccentPalette) => void;
}

// Default accent: clay / terracotta — matches the design's TWEAK_DEFAULTS.
export const DEFAULT_ACCENT: AccentPalette = ["#b25a38", "#99492b", "#f1e2d8"];

export const THEME_KEY = "writing.theme";
export const ACCENT_KEY = "writing.accent";

function readPersisted<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/** Parse a hex colour (#rgb or #rrggbb) to "r,g,b" for rgba() expressions. */
function rgbOf(hex: string): string {
  let h = hex.replace("#", "");
  // Expand 3-digit short form (#abc → #aabbcc) before channel parsing.
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16))
    .join(",");
}

/**
 * Convert a hex colour (#rgb or #rrggbb) to a Win32 COLORREF (0x00BBGGRR byte
 * order — the reverse of web RGB), for the DWM `set_border_color` command.
 * Returns null for unparseable input so the caller can skip the native call.
 */
function hexToColorref(hex: string): number | null {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (b << 16) | (g << 8) | r;
}

/**
 * Match the Win11 native window border (the thin OS line around the frame) to the
 * active theme's titlebar colour, replacing the cold default near-white line.
 * Runs on theme change; reads --titlebar AFTER useTheme's data-theme effect has
 * applied, so the computed value already reflects the new theme. Guarded on the
 * Tauri runtime so jsdom tests (and any non-Tauri host) skip the native invoke.
 */
function useNativeBorderColor(theme: Theme): void {
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const titlebar = getComputedStyle(document.documentElement)
      .getPropertyValue("--titlebar")
      .trim();
    const color = hexToColorref(titlebar);
    if (color === null) return;
    void invoke("set_border_color", { color }).catch(() => {
      /* border colour is cosmetic — ignore failures (e.g. pre-Win11 builds) */
    });
  }, [theme]);
}

/**
 * useTheme — owns theme + accent state and writes the design tokens to
 * document.documentElement on every change.
 *
 * Applies:
 *   - data-theme attribute  ("light" clears it back to root defaults;
 *     "dark" activates the [data-theme="dark"] block in tokens.css)
 *   - --accent-* CSS custom properties derived from the accent palette
 *
 * Persistence seam: plug localStorage / Tauri store read here before the
 * initial useState call, and write on every setTheme / setAccent call.
 */
export function useTheme(): ThemeState {
  const [theme, setTheme] = useState<Theme>(() => readPersisted(THEME_KEY, "light"));
  const [accent, setAccent] = useState<AccentPalette>(() => readPersisted(ACCENT_KEY, DEFAULT_ACCENT));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  }, [theme]);

  // Keep the Win11 native window border matched to the active theme (see hook).
  useNativeBorderColor(theme);

  useEffect(() => {
    const root = document.documentElement;
    const [hero, deep, tint] = accent;
    const rgb = rgbOf(hero);
    root.style.setProperty("--accent", hero);
    root.style.setProperty("--accent-deep", deep);
    root.style.setProperty("--character", hero);
    if (theme === "dark") {
      // In dark mode, let tokens.css [data-theme="dark"] define the tint/wash/ring/selection
      // values — they need dark-context colours that cannot be derived from the light palette.
      // Removing the inline style unblocks the CSS cascade so the dark-token values win.
      root.style.removeProperty("--accent-tint");
      root.style.removeProperty("--accent-wash");
      root.style.removeProperty("--accent-ring");
      root.style.removeProperty("--selection");
      root.style.removeProperty("--character-tint");
    } else {
      root.style.setProperty("--accent-tint", tint);
      root.style.setProperty("--accent-wash", `rgba(${rgb},0.10)`);
      root.style.setProperty("--accent-ring", `rgba(${rgb},0.30)`);
      root.style.setProperty("--selection", `rgba(${rgb},0.16)`);
      root.style.setProperty("--character-tint", tint);
    }
    localStorage.setItem(ACCENT_KEY, JSON.stringify(accent));
  }, [accent, theme]);

  return { theme, setTheme, accent, setAccent };
}
