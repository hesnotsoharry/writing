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
    // A keychain read failure (e.g. no Tauri runtime) safely means "no key" —
    // never leave the promise unhandled, which would reject in jsdom and prod alike.
    const sync = () => {
      byokHasKey()
        .then((has) => { if (!cancelled) setByokMode(has); })
        .catch(() => { if (!cancelled) setByokMode(false); });
    };
    sync();
    window.addEventListener("byok:key-changed", sync);
    return () => { cancelled = true; window.removeEventListener("byok:key-changed", sync); };
  }, []);
  return byokMode;
}
