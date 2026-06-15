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
    void byokOpenAiHasKey().then((has) => { if (!cancelled) setOpenaiByokMode(has); });
    const onChanged = () => { void byokOpenAiHasKey().then((has) => { if (!cancelled) setOpenaiByokMode(has); }); };
    window.addEventListener("byok:openai-key-changed", onChanged);
    return () => { cancelled = true; window.removeEventListener("byok:openai-key-changed", onChanged); };
  }, []);
  return openaiByokMode;
}
