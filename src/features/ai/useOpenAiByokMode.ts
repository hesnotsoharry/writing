/**
 * useOpenAiByokMode — returns true when a BYOK OpenAI key is stored in the OS
 * keychain. Initialises via `byokOpenAiHasKey()` on mount; re-syncs on the
 * `byok:openai-key-changed` CustomEvent dispatched by the Settings BYOK row after
 * save/remove.
 *
 * Mirrors `useByokMode.ts` (Anthropic path) but targets the OpenAI keychain slot.
 * The two providers fire distinct events so they cannot cross-trigger.
 *
 * W49 Phase 1 provisional — Phase 3 folds this into the provider discriminant.
 */
import { useEffect, useState } from "react";

import { byokOpenAiHasKey } from "./byok.openai.client";

export function useOpenAiByokMode(): boolean {
  const [openaiByokMode, setOpenaiByokMode] = useState(false);
  useEffect(() => {
    let cancelled = false;
    // A keychain read failure (e.g. no Tauri runtime) safely means "no key" —
    // never leave the promise unhandled, which would reject in jsdom and prod alike.
    const sync = () => {
      byokOpenAiHasKey()
        .then((has) => { if (!cancelled) setOpenaiByokMode(has); })
        .catch(() => { if (!cancelled) setOpenaiByokMode(false); });
    };
    sync();
    window.addEventListener("byok:openai-key-changed", sync);
    return () => { cancelled = true; window.removeEventListener("byok:openai-key-changed", sync); };
  }, []);
  return openaiByokMode;
}
