/**
 * useMotion — returns true when the motion tweak is enabled (and not
 * overridden by `prefers-reduced-motion`).
 *
 * Used by AppContent to stamp `.anim` onto the root `.win` element, which
 * gates all canon CSS animations (view-in fade-up, bar-in selected indicator,
 * card rise, inspector settle, etc.) in `src/styles/app.css`.
 *
 * Pattern mirrors useEditorStyle: reads once on mount, re-reads on every
 * SETTINGS_CHANGED_EVENT so the motion toggle in Settings takes effect
 * immediately without a page reload.
 *
 * Note: the CSS layer (`@media (prefers-reduced-motion: no-preference)`) is
 * the authoritative reduced-motion gate for visual behaviour. We also check it
 * here so the JS class is never set when the OS preference is "reduce" — belt
 * and suspenders.
 */
import { useEffect, useState } from "react";

import { getTweak, TWEAK_DEFAULTS } from "../features/settings/settings.store";
import { SETTINGS_CHANGED_EVENT } from "../lib/settings";

function readMotion(): boolean {
  const motionTweak = getTweak("motion", TWEAK_DEFAULTS.motion);
  if (!motionTweak) return false;
  // Also respect the OS reduced-motion preference at the JS level.
  // Double optional-chain: if window.matchMedia is undefined (e.g. jsdom without
  // a matchMedia stub), the call returns undefined and .matches would throw —
  // chaining ?.matches makes it safely return undefined (falsy) instead.
  const preferReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  return !preferReduced;
}

/**
 * Returns whether motion animations should be enabled for the current session.
 * Re-evaluates when Settings fires SETTINGS_CHANGED_EVENT.
 */
export function useMotion(): boolean {
  const [motion, setMotion] = useState(readMotion);

  useEffect(() => {
    const handler = () => { setMotion(readMotion()); };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);

  return motion;
}
