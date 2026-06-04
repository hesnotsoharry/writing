/**
 * useEditorStyle — applies prose typography CSS custom properties to
 * `document.documentElement` whenever settings change.
 *
 * Properties set:
 *   --font-prose     ← proseFont (resolved to full font-family stack)
 *   --prose-size     ← proseSize in px
 *   --prose-leading  ← lineSpacing mapped to a line-height value
 *   --prose-measure  ← editorWidth mapped to a max-width value
 *
 * Source of truth: design-reference/app.jsx lines 22-29, 92-95.
 * Mount once in App.content.tsx; it registers its own SETTINGS_CHANGED_EVENT
 * listener so Lane 21's settings UI drives changes automatically.
 */

import { useEffect } from "react";

import { getTweak, TWEAK_DEFAULTS } from "../features/settings/settings.store";
import { SETTINGS_CHANGED_EVENT } from "../lib/settings";

// ── Lookup tables (design-reference/app.jsx) ──────────────────────────────────

const PROSE_FONTS: Record<string, string> = {
  "Literata":     '"Literata", Georgia, serif',
  "Newsreader":   '"Newsreader", Georgia, serif',
  "Source Serif": '"Source Serif 4", Georgia, serif',
  "iA Mono":      '"IBM Plex Mono", ui-monospace, monospace',
};

const LINE_SPACING: Record<string, string> = {
  cozy:    "1.55",
  normal:  "1.75",
  relaxed: "2.05",
};

const EDITOR_WIDTH: Record<string, string> = {
  narrow: "32rem",
  normal: "38rem",
  wide:   "46rem",
};

// ── Apply helper ──────────────────────────────────────────────────────────────

function applyEditorStyle(): void {
  const proseFont   = getTweak("proseFont",   TWEAK_DEFAULTS.proseFont);
  const proseSize   = getTweak("proseSize",   TWEAK_DEFAULTS.proseSize);
  const lineSpacing = getTweak("lineSpacing", TWEAK_DEFAULTS.lineSpacing);
  const editorWidth = getTweak("editorWidth", TWEAK_DEFAULTS.editorWidth);

  const root = document.documentElement;
  root.style.setProperty("--font-prose",    PROSE_FONTS[proseFont]   ?? PROSE_FONTS["Literata"]);
  root.style.setProperty("--prose-size",    String(proseSize) + "px");
  root.style.setProperty("--prose-leading", LINE_SPACING[lineSpacing] ?? "1.75");
  root.style.setProperty("--prose-measure", EDITOR_WIDTH[editorWidth] ?? "38rem");
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Mount once (in App.content.tsx). Applies on mount and re-applies whenever
 * the settings store fires SETTINGS_CHANGED_EVENT (same-tab, no storage event).
 */
export function useEditorStyle(): void {
  useEffect(() => {
    // Apply immediately on mount.
    applyEditorStyle();

    // Re-apply on every settings change (wave-16 cross-lane contract).
    const handler = () => applyEditorStyle();
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);
}
