/**
 * license.gate — useLicenseGate hook for the boot-path activation check.
 *
 * Wave 30, Phase 3. Decision D4: activation record in SQLite app_meta; DEV
 * bypass via localStorage so tauri dev + CDP smoke of unrelated features
 * works without clearing the activation record every session.
 */
import { useCallback, useEffect, useState } from "react";

import { loadActivation } from "./license.store";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Gate lifecycle:
 *   'checking' — DB may not be ready yet; activation not yet queried.
 *   'needed'   — no activation record found; show the ActivationGate UI.
 *   'cleared'  — record present (or DEV bypass active); show the main app.
 */
export type GateStatus = "checking" | "needed" | "cleared";

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Boot-path activation check.
 *
 * @param dbReady - true once the DB init (initializeProjectTree) has completed;
 *   false while still loading. The hook defers its SQLite read until this flag
 *   flips to true so it never races the migration runner.
 *
 * DEV bypass: when import.meta.env.DEV is true AND
 *   localStorage['writing.devLicenseBypass'] === '1', the gate is skipped
 *   without a network call or SQLite read. This is compile-time dead in
 *   production bundles (Vite tree-shakes the DEV branch).
 */
/** Returns true when the DEV gate bypass is active. Always false in production. */
function isDevBypassed(): boolean {
  return (
    import.meta.env.DEV &&
    localStorage.getItem("writing.devLicenseBypass") === "1"
  );
}

export function useLicenseGate(
  dbReady: boolean,
): { gateStatus: GateStatus; onActivated: () => void } {
  // Compute bypass at hook creation so the initial state is already 'cleared'
  // when the flag is set — avoids a synchronous setState inside an effect.
  const bypassed = isDevBypassed();
  const [gateStatus, setGateStatus] = useState<GateStatus>(
    bypassed ? "cleared" : "checking",
  );

  useEffect(() => {
    if (!dbReady || bypassed) return;
    loadActivation()
      .then((rec) => setGateStatus(rec !== null ? "cleared" : "needed"))
      .catch(() => setGateStatus("needed"));
  }, [dbReady, bypassed]);

  const onActivated = useCallback(() => setGateStatus("cleared"), []);
  return { gateStatus, onActivated };
}
