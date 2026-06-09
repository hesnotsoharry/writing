import { useEffect, useState } from "react";

import { SETTINGS_CHANGED_EVENT } from "../../lib/settings";
import {
  type AccentPalette,
  DEFAULT_ACCENT,
  type Theme,
} from "../../theme/useTheme";

// Re-export so callers that need the type surface can get it from one place.
export type { AccentPalette, Theme };

/** Namespace prefix for all settings keys in localStorage — matches existing `writing.goalTarget`. */
export const SETTINGS_NS = "writing.";

// ── Wave-16 cross-wave key contract ──────────────────────────────────────────
// Wave 16 (Spelling & Grammar) imports these exact constants as its read contract.
// The string values are camelCase — do NOT rename.
export const SPELLCHECK_KEY = "spellCheck";
export const GRAMMAR_KEY = "grammar";
export const STYLEHINTS_KEY = "styleHints";

// ── Tweaks interface ──────────────────────────────────────────────────────────

export interface Tweaks {
  proseFont: string;
  proseSize: number;
  lineSpacing: "cozy" | "normal" | "relaxed";
  editorWidth: "narrow" | "normal" | "wide";
  spellCheck: boolean;
  smartQuotes: boolean;
  typewriter: boolean;
  grammar: boolean;
  styleHints: boolean;
  motion: boolean;
  defaultStatus: "blank" | "outline" | "draft";
  confirmDelete: boolean;
  reopenLast: boolean;
  // ── Auto-link settings (Wave 28 P8) ────────────────────────────────────────
  autolinkOn: boolean;
  autolinkScope: "all" | "first";
  autolinkTypes: string[];
  // ── Snapshot retention (Fix 4) ──────────────────────────────────────────────
  /** 0 = unlimited; positive = keep the N newest auto-snapshots per scene. */
  snapshotAutoLimit: number;
}

export const TWEAK_DEFAULTS: Tweaks = {
  proseFont: "Literata",
  proseSize: 18,
  lineSpacing: "normal",
  editorWidth: "normal",
  spellCheck: true,
  smartQuotes: true,
  typewriter: false,
  grammar: true,
  styleHints: false,
  motion: true,
  defaultStatus: "blank",
  confirmDelete: true,
  reopenLast: true,
  autolinkOn: true,
  autolinkScope: "all",
  autolinkTypes: ["character", "location", "item", "faction", "lore"],
  snapshotAutoLimit: 25,
};

// ── Storage helpers ───────────────────────────────────────────────────────────

/**
 * getTweak — reads a single tweak from localStorage.
 * Returns `fallback` when the key is absent OR the stored JSON is corrupt.
 */
export function getTweak<K extends keyof Tweaks>(
  key: K,
  fallback: Tweaks[K],
): Tweaks[K] {
  const raw = localStorage.getItem(SETTINGS_NS + key);
  if (raw === null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as Tweaks[K];
  } catch {
    return fallback;
  }
}

/**
 * setStoredTweak — persists a single tweak to localStorage.
 */
export function setStoredTweak<K extends keyof Tweaks>(
  key: K,
  value: Tweaks[K],
): void {
  localStorage.setItem(SETTINGS_NS + key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(SETTINGS_CHANGED_EVENT));
}

// ── useSettings hook ──────────────────────────────────────────────────────────

/** Lazy initializer: reads every key from localStorage, falling back to TWEAK_DEFAULTS. */
function readAll(): Tweaks {
  const keys = Object.keys(TWEAK_DEFAULTS) as (keyof Tweaks)[];
  const result = { ...TWEAK_DEFAULTS };
  for (const key of keys) {
    // Casting required: the loop variable is `keyof Tweaks` but TS can't narrow
    // the generic at the call site without an explicit cast.
    (result as Record<keyof Tweaks, Tweaks[keyof Tweaks]>)[key] = getTweak(
      key,
      TWEAK_DEFAULTS[key],
    );
  }
  return result;
}

export function useSettings(): {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
} {
  const [tweaks, setTweaks] = useState<Tweaks>(readAll);

  function setTweak<K extends keyof Tweaks>(key: K, value: Tweaks[K]): void {
    setStoredTweak(key, value);
    setTweaks((prev) => ({ ...prev, [key]: value }));
  }

  return { tweaks, setTweak };
}

// Keep DEFAULT_ACCENT in scope (imported above) so it's available for callers
// who need to compare against the accent default without importing useTheme directly.
export { DEFAULT_ACCENT };

// ── useAutolinkSettings ───────────────────────────────────────────────────────
// Reactive subscription to the three autolink tweaks.
// Re-reads on every SETTINGS_CHANGED_EVENT so the editor plugin updates live.

export interface AutolinkSettings {
  autolinkOn: boolean;
  autolinkScope: "all" | "first";
  autolinkTypes: string[];
}

function readAutolinkSettings(): AutolinkSettings {
  return {
    autolinkOn: getTweak("autolinkOn", TWEAK_DEFAULTS.autolinkOn),
    autolinkScope: getTweak("autolinkScope", TWEAK_DEFAULTS.autolinkScope),
    autolinkTypes: getTweak("autolinkTypes", TWEAK_DEFAULTS.autolinkTypes),
  };
}

export function useAutolinkSettings(): AutolinkSettings {
  const [settings, setSettings] = useState<AutolinkSettings>(readAutolinkSettings);
  useEffect(() => {
    const h = () => setSettings(readAutolinkSettings());
    window.addEventListener(SETTINGS_CHANGED_EVENT, h);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, h);
  }, []);
  return settings;
}
