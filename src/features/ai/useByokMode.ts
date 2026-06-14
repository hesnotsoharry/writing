/**
 * useByokMode — returns true when a BYOK Anthropic key is stored in the OS
 * keychain. Initialises via `byokHasKey()` on mount; re-syncs on the
 * `byok:key-changed` CustomEvent dispatched by the Settings BYOK row after
 * save/remove.
 *
 * Colocated here (not in AssistantPanel.hooks.ts) to keep each file under the
 * 300-line ESLint gate.
 */
import { useEffect, useState } from "react";

import { byokHasKey } from "./byok.client";

export function useByokMode(): boolean {
  const [byokMode, setByokMode] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void byokHasKey().then((has) => { if (!cancelled) setByokMode(has); });
    const onChanged = () => { void byokHasKey().then((has) => { if (!cancelled) setByokMode(has); }); };
    window.addEventListener("byok:key-changed", onChanged);
    return () => { cancelled = true; window.removeEventListener("byok:key-changed", onChanged); };
  }, []);
  return byokMode;
}
