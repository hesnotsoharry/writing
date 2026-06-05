/**
 * useFocusSettings — per-option localStorage-backed focus-mode toggles.
 *
 * Keys:
 *   focus.typewriter   — typewriter scroll (cursor-centred)
 *   focus.dimParagraphs — dim non-active paragraphs
 *   focus.hud          — fading HUD overlay
 *   focus.timer        — session timer in HUD
 *
 * All default ON. Reads on mount; writes on toggle.
 * No setState in useEffect — initial values derived at render time (lazy
 * initialiser on useState avoids the re-render).
 */

import { useCallback, useState } from "react";

export interface FocusSettings {
  typewriter: boolean;
  dimParagraphs: boolean;
  hud: boolean;
  timer: boolean;
}

const KEYS = {
  typewriter: "focus.typewriter",
  dimParagraphs: "focus.dimParagraphs",
  hud: "focus.hud",
  timer: "focus.timer",
} as const satisfies Record<keyof FocusSettings, string>;

function readBool(key: string, fallback = true): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "true";
}

function readAll(): FocusSettings {
  return {
    typewriter: readBool(KEYS.typewriter),
    dimParagraphs: readBool(KEYS.dimParagraphs),
    hud: readBool(KEYS.hud),
    timer: readBool(KEYS.timer),
  };
}

export interface FocusSettingsHook {
  settings: FocusSettings;
  toggle: (key: keyof FocusSettings) => void;
}

export function useFocusSettings(): FocusSettingsHook {
  // Lazy initialiser — runs once on mount; no setState-in-useEffect.
  const [settings, setSettings] = useState<FocusSettings>(readAll);

  const toggle = useCallback((key: keyof FocusSettings) => {
    setSettings((prev) => {
      const next = !prev[key];
      localStorage.setItem(KEYS[key], String(next));
      return { ...prev, [key]: next };
    });
  }, []);

  return { settings, toggle };
}
